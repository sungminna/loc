import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getDb } from "@db/client";
import { accounts, oauthStates } from "@db/schema";
import type { Env } from "@shared/env";
import { encryptToken } from "../crypto";
import { authenticate } from "../auth";

const SCOPE = ["threads_basic", "threads_content_publish", "threads_manage_insights"].join(",");

export async function threadsStart(req: Request, env: Env): Promise<Response> {
  const ctx = await authenticate(req, env);
  if (!ctx) return new Response("login required", { status: 401 });

  const url = new URL(req.url);
  const label = url.searchParams.get("label") ?? "default";
  const state = createId();
  const redirectUri = `${env.PUBLIC_WORKER_URL}/oauth/threads/callback`;

  await ctx.db.insert(oauthStates).values({
    state,
    userId: ctx.user.id,
    platform: "threads",
    redirectUri,
    meta: { label },
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const auth = new URL("https://threads.net/oauth/authorize");
  auth.searchParams.set("client_id", env.THREADS_APP_ID);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("scope", SCOPE);
  auth.searchParams.set("state", state);
  auth.searchParams.set("response_type", "code");
  return Response.redirect(auth.toString(), 302);
}

export async function threadsCallback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return new Response("missing code/state", { status: 400 });

  const db = getDb(env.DB);
  const row = await db.query.oauthStates.findFirst({ where: eq(oauthStates.state, state) });
  if (!row || row.platform !== "threads" || row.expiresAt < new Date()) {
    return new Response("invalid state", { status: 400 });
  }
  await db.delete(oauthStates).where(eq(oauthStates.state, state));

  try {
    const formBody = new URLSearchParams({
      client_id: env.THREADS_APP_ID,
      client_secret: env.THREADS_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: row.redirectUri,
      code,
    });
    const shortRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody,
    });
    const shortText = await shortRes.text();
    if (!shortRes.ok) throw new Error(`short token: ${shortRes.status} ${shortText.slice(0, 200)}`);
    const shortToken = JSON.parse(shortText) as { access_token: string; user_id: string };

    const longRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token` +
        `&client_secret=${env.THREADS_APP_SECRET}&access_token=${shortToken.access_token}`,
    );
    const longText = await longRes.text();
    if (!longRes.ok) throw new Error(`long token: ${longRes.status} ${longText.slice(0, 200)}`);
    const longLived = JSON.parse(longText) as { access_token: string; expires_in: number };

    const profileRes = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${longLived.access_token}`,
    );
    const profileText = await profileRes.text();
    if (!profileRes.ok) throw new Error(`profile: ${profileRes.status} ${profileText.slice(0, 200)}`);
    const profile = JSON.parse(profileText) as { id: string; username: string };

    const accountId = createId();
    const tokenKvKey = `threads/${accountId}/access_token`;
    const encrypted = await encryptToken(longLived.access_token, env.LOC_MASTER_KEY);
    await env.TOKENS.put(tokenKvKey, encrypted);

    await db.insert(accounts).values({
      id: accountId,
      userId: row.userId,
      platform: "threads",
      handle: profile.username,
      threadsUserId: profile.id,
      tokenKvKey,
      tokenExpiresAt: new Date(Date.now() + longLived.expires_in * 1000),
      refreshedAt: new Date(),
      enabled: true,
    });

    return successPage(`Threads @${profile.username} 연결 완료`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorPage(`OAuth 실패: ${msg.slice(0, 200)}`);
  }
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
