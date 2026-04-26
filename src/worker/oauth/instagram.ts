import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getDb } from "@db/client";
import { accounts, oauthStates } from "@db/schema";
import type { Env } from "@shared/env";
import { encryptToken } from "../crypto";
import { authenticate } from "../auth";

const SCOPE = ["instagram_business_basic", "instagram_business_content_publish", "pages_show_list"].join(",");

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

  const auth = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  auth.searchParams.set("client_id", env.META_APP_ID);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("scope", SCOPE);
  auth.searchParams.set("state", state);
  auth.searchParams.set("response_type", "code");
  return Response.redirect(auth.toString(), 302);
}

export async function igCallback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return new Response("missing code/state", { status: 400 });

  const db = getDb(env.DB);
  const row = await db.query.oauthStates.findFirst({ where: eq(oauthStates.state, state) });
  if (!row || row.platform !== "instagram" || row.expiresAt < new Date()) {
    return new Response("invalid state", { status: 400 });
  }
  await db.delete(oauthStates).where(eq(oauthStates.state, state));

  try {
    const tokenResp = await fetchJson(
      `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${env.META_APP_ID}` +
        `&client_secret=${env.META_APP_SECRET}` +
        `&redirect_uri=${encodeURIComponent(row.redirectUri)}&code=${code}`,
    ) as { access_token: string };

    const longLived = await fetchJson(
      `https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token` +
        `&client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}` +
        `&fb_exchange_token=${tokenResp.access_token}`,
    ) as { access_token: string; expires_in?: number };

    const pages = await fetchJson(
      `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,instagram_business_account&access_token=${longLived.access_token}`,
    ) as { data: Array<{ id: string; name: string; instagram_business_account?: { id: string } }> };

    const candidates = pages.data.filter((p) => p.instagram_business_account?.id);
    if (candidates.length === 0) {
      return errorPage("Instagram Business 계정이 연결된 Facebook Page가 없습니다. Meta Business Suite에서 연결 후 다시 시도하세요.");
    }
    const page = candidates[0]!;
    const igUserId = page.instagram_business_account!.id;

    const profile = await fetchJson(
      `https://graph.facebook.com/v25.0/${igUserId}?fields=username&access_token=${longLived.access_token}`,
    ) as { username: string };

    const accountId = createId();
    const tokenKvKey = `ig/${accountId}/access_token`;
    const encrypted = await encryptToken(longLived.access_token, env.LOC_MASTER_KEY);
    await env.TOKENS.put(tokenKvKey, encrypted);

    const expiresAt = new Date(Date.now() + (longLived.expires_in ?? 60 * 24 * 3600) * 1000);

    await db.insert(accounts).values({
      id: accountId,
      userId: row.userId,
      platform: "instagram",
      handle: profile.username,
      igUserId,
      tokenKvKey,
      tokenExpiresAt: expiresAt,
      refreshedAt: new Date(),
      enabled: true,
      meta: { pageId: page.id, candidatePages: candidates.length },
    });

    return successPage(`Instagram @${profile.username} 연결 완료${candidates.length > 1 ? ` (${candidates.length}개 페이지 중 첫 번째 선택)` : ""}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorPage(`OAuth 실패: ${msg.slice(0, 200)}`);
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { method: url.includes("oauth/access_token") ? "POST" : "GET" });
  const text = await r.text();
  if (!r.ok) throw new Error(`Meta ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
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
