// Instagram Login (Instagram Business with Instagram Login) OAuth flow.
// Modern path — does NOT require a Facebook Page. Tokens are issued by
// Instagram directly and used against graph.instagram.com.
//
// Docs: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/getting-started

import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getDb } from "@db/client";
import { accounts, oauthStates } from "@db/schema";
import type { Env } from "@shared/env";
import { encryptToken } from "../crypto";
import { authenticate } from "../auth";
import {
  disableProviderUser,
  extractSignedRequest,
  parseSignedRequest,
  purgeProviderUser,
} from "./signed-request";

// Minimal scopes for posting + comments. Add more once approved in app.
const SCOPE = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
].join(",");

function igAppCreds(env: Env): { id: string; secret: string } {
  // Instagram Login uses Instagram-app credentials (NOT Meta app)
  const id = env.IG_APP_ID ?? env.META_APP_ID;
  const secret = env.IG_APP_SECRET ?? env.META_APP_SECRET;
  return { id, secret };
}

export async function igStart(req: Request, env: Env): Promise<Response> {
  const ctx = await authenticate(req, env);
  if (!ctx) return new Response("login required", { status: 401 });

  const url = new URL(req.url);
  const label = url.searchParams.get("label") ?? "default";
  const state = createId();
  const redirectUri = `${env.PUBLIC_WORKER_URL}/oauth/ig/callback`;

  await ctx.db.insert(oauthStates).values({
    state,
    userId: ctx.user.id,
    platform: "instagram",
    redirectUri,
    meta: { label },
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const { id } = igAppCreds(env);
  const auth = new URL("https://www.instagram.com/oauth/authorize");
  auth.searchParams.set("client_id", id);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("scope", SCOPE);
  auth.searchParams.set("state", state);
  auth.searchParams.set("response_type", "code");
  return Response.redirect(auth.toString(), 302);
}

export async function igCallback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  // Meta webhook verify handshake (when this URL is also configured as a
  // Webhook Callback URL). Echo back hub.challenge if verify_token matches.
  const hubMode = url.searchParams.get("hub.mode") ?? url.searchParams.get("hub_mode");
  if (hubMode === "subscribe") {
    if (!env.WEBHOOK_VERIFY_TOKEN) {
      // Refuse to fall back to a default — the verify token is the only
      // thing keeping a stranger from registering this URL as their webhook.
      return new Response("WEBHOOK_VERIFY_TOKEN not configured", { status: 503 });
    }
    const challenge = url.searchParams.get("hub.challenge") ?? url.searchParams.get("hub_challenge") ?? "";
    const verify = url.searchParams.get("hub.verify_token") ?? url.searchParams.get("hub_verify_token") ?? "";
    if (verify === env.WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge, { headers: { "content-type": "text/plain" } });
    }
    return new Response("verify token mismatch", { status: 403 });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return errorPage("missing code/state");

  const db = getDb(env.DB);
  const row = await db.query.oauthStates.findFirst({ where: eq(oauthStates.state, state) });
  if (!row || row.platform !== "instagram" || row.expiresAt < new Date()) {
    return errorPage("invalid state");
  }
  await db.delete(oauthStates).where(eq(oauthStates.state, state));

  try {
    const { id, secret } = igAppCreds(env);

    // Step 1: short-lived token via api.instagram.com
    const tokenForm = new URLSearchParams({
      client_id: id,
      client_secret: secret,
      grant_type: "authorization_code",
      redirect_uri: row.redirectUri,
      code,
    });
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: tokenForm,
    });
    const shortText = await shortRes.text();
    if (!shortRes.ok) throw new Error(`short token: ${shortRes.status} ${shortText.slice(0, 300)}`);
    const shortToken = JSON.parse(shortText) as { access_token: string; user_id: number | string };

    // Step 2: exchange for long-lived (60d) via graph.instagram.com
    const llRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token` +
        `&client_secret=${secret}&access_token=${shortToken.access_token}`,
    );
    const llText = await llRes.text();
    if (!llRes.ok) throw new Error(`long-lived: ${llRes.status} ${llText.slice(0, 300)}`);
    const longLived = JSON.parse(llText) as { access_token: string; expires_in: number };

    // Step 3: profile lookup
    const profileRes = await fetch(
      `https://graph.instagram.com/v25.0/me?fields=id,username&access_token=${longLived.access_token}`,
    );
    const profileText = await profileRes.text();
    if (!profileRes.ok) throw new Error(`profile: ${profileRes.status} ${profileText.slice(0, 300)}`);
    const profile = JSON.parse(profileText) as { id: string; username: string };

    const accountId = createId();
    const tokenKvKey = `ig/${accountId}/access_token`;
    const encrypted = await encryptToken(longLived.access_token, env.LOC_MASTER_KEY);
    await env.TOKENS.put(tokenKvKey, encrypted);

    await db.insert(accounts).values({
      id: accountId,
      userId: row.userId,
      platform: "instagram",
      handle: profile.username,
      igUserId: profile.id,
      tokenKvKey,
      tokenExpiresAt: new Date(Date.now() + longLived.expires_in * 1000),
      refreshedAt: new Date(),
      enabled: true,
      meta: { flow: "instagram-login" },
    });

    return successPage(`Instagram @${profile.username} 연결 완료 (60일 토큰)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorPage(`OAuth 실패: ${msg.slice(0, 300)}`);
  }
}

// ─── Meta-required webhooks ──────────────────────────────────────────
//
// Instagram Login uses the Instagram-app credentials (IG_APP_SECRET, falling
// back to META_APP_SECRET — same pair we use for the OAuth flow above).

export async function igDeauth(req: Request, env: Env): Promise<Response> {
  const { secret } = igAppCreds(env);
  const raw = await extractSignedRequest(req);
  const payload = await parseSignedRequest(raw, secret);
  if (!payload) return jsonRes({ error: "invalid signed_request" }, 400);
  await disableProviderUser(env, "instagram", payload.user_id);
  return jsonRes({ success: true });
}

export async function igDelete(req: Request, env: Env): Promise<Response> {
  const { secret } = igAppCreds(env);
  const raw = await extractSignedRequest(req);
  const payload = await parseSignedRequest(raw, secret);
  if (!payload) return jsonRes({ error: "invalid signed_request" }, 400);
  const removed = await purgeProviderUser(env, "instagram", payload.user_id);
  const code = `ig-${payload.user_id}-${Date.now()}`;
  return jsonRes({
    url: `${env.PUBLIC_WORKER_URL}/oauth/ig/delete-status?code=${encodeURIComponent(code)}`,
    confirmation_code: code,
    removed,
  });
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function successPage(msg: string): Response {
  return new Response(htmlShell("✅ 연결 완료", msg, "#34d399"), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
function errorPage(msg: string): Response {
  return new Response(htmlShell("⚠️ 연결 실패", msg, "#f87171"), {
    status: 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
function htmlShell(title: string, msg: string, color: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#09090b;color:#fafafa;margin:0;padding:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}.card{max-width:480px;text-align:center;background:#18181b;border:1px solid #27272a;border-radius:24px;padding:48px}.title{color:${color};font-size:24px;margin:0 0 16px}.msg{color:#a1a1aa;line-height:1.6}.back{display:inline-block;margin-top:32px;padding:10px 20px;background:#fde047;color:#09090b;border-radius:10px;text-decoration:none;font-weight:600}</style>
</head><body><div class="card"><h1 class="title">${title}</h1><p class="msg">${msg}</p><a class="back" href="/accounts">대시보드로</a></div></body></html>`;
}
