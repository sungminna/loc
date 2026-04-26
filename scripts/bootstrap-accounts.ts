export {};

// Seeds IG + Threads accounts directly from long-lived bootstrap tokens
// (no OAuth dance). Useful for dev / first-run testing.
//
// Reads from .dev.vars (or env): IG_BOOTSTRAP_TOKEN, THREADS_BOOTSTRAP_TOKEN,
// LOC_MASTER_KEY, plus Cloudflare API creds + a target user email.
//
//   CLOUDFLARE_ACCOUNT_ID=... \
//   D1_DATABASE_ID=... \
//   CLOUDFLARE_API_TOKEN=... \
//   KV_TOKENS_NAMESPACE_ID=... \
//   FOR_USER_EMAIL=sungmin@cleave.work \
//   bun scripts/bootstrap-accounts.ts
//
// The Worker auto-provisions a `users` row on first dashboard hit via CF
// Access; this script will refuse to run unless that row exists.

import { readFileSync } from "node:fs";
import { createId } from "@paralleldrive/cuid2";

const env = loadDevVars();
const cf = {
  accountId: required("CLOUDFLARE_ACCOUNT_ID"),
  apiToken: required("CLOUDFLARE_API_TOKEN"),
  d1Id: required("D1_DATABASE_ID"),
  kvId: required("KV_TOKENS_NAMESPACE_ID"),
};
const forUserEmail = required("FOR_USER_EMAIL");
const masterKey = env.LOC_MASTER_KEY ?? required("LOC_MASTER_KEY");
const igTok = env.IG_BOOTSTRAP_TOKEN;
const thTok = env.THREADS_BOOTSTRAP_TOKEN;

if (!igTok && !thTok) {
  console.error("Neither IG_BOOTSTRAP_TOKEN nor THREADS_BOOTSTRAP_TOKEN found in .dev.vars/env. Nothing to seed.");
  process.exit(1);
}

const user = await findUserByEmail(forUserEmail);
if (!user) {
  console.error(`No users row for ${forUserEmail}. Open the dashboard once first so CF Access auto-provisions it (or set DEV_USER_EMAIL=${forUserEmail} and hit the worker locally).`);
  process.exit(2);
}

if (igTok) await seedInstagram(igTok, user.id);
if (thTok) await seedThreads(thTok, user.id);

console.log("\n✓ Bootstrap complete.");

// ── helpers ──────────────────────────────────────────────────────────

async function seedInstagram(token: string, userId: string): Promise<void> {
  console.log("\n[Instagram]");
  // Discover IG Business User via the Page graph (token must have pages_show_list + instagram_business_basic)
  const pages = await fetchJson<{ data: Array<{ id: string; instagram_business_account?: { id: string } }> }>(
    `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,instagram_business_account&access_token=${token}`,
  ).catch((e) => { console.error("  ✗ /me/accounts failed:", e.message); return null; });
  let igUserId: string | null = null;
  if (pages?.data) {
    const page = pages.data.find((p) => p.instagram_business_account?.id);
    igUserId = page?.instagram_business_account?.id ?? null;
  }

  // If the token is from the Instagram-with-Login flow, /me itself is the IG user.
  if (!igUserId) {
    const me = await fetchJson<{ id: string; username: string }>(
      `https://graph.instagram.com/v25.0/me?fields=id,username&access_token=${token}`,
    ).catch((e) => { console.error("  ✗ graph.instagram.com/me failed:", e.message); return null; });
    if (me?.id) igUserId = me.id;
  }
  if (!igUserId) {
    console.error("  ✗ Could not resolve IG user id. Skipping.");
    return;
  }

  const profile = await fetchJson<{ username: string }>(
    `https://graph.instagram.com/v25.0/${igUserId}?fields=username&access_token=${token}`,
  ).catch(() => fetchJson<{ username: string }>(
    `https://graph.facebook.com/v25.0/${igUserId}?fields=username&access_token=${token}`,
  ));

  const accountId = createId();
  const tokenKvKey = `ig/${accountId}/access_token`;
  const encrypted = await encryptToken(token, masterKey);

  await kvPut(tokenKvKey, encrypted);
  await d1Insert(
    `INSERT OR IGNORE INTO accounts
       (id, user_id, platform, handle, ig_user_id, token_kv_key, token_expires_at, refreshed_at, enabled, created_at, updated_at)
     VALUES (?, ?, 'instagram', ?, ?, ?, ?, ?, 1, ?, ?)`,
    [accountId, userId, profile.username, igUserId, tokenKvKey,
     Date.now() + 60 * 24 * 3600 * 1000, Date.now(), Date.now(), Date.now()],
  );
  console.log(`  ✓ Instagram @${profile.username} (ig_user_id=${igUserId}) seeded as account ${accountId}`);
}

async function seedThreads(token: string, userId: string): Promise<void> {
  console.log("\n[Threads]");
  const me = await fetchJson<{ id: string; username: string }>(
    `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${token}`,
  ).catch((e) => { console.error("  ✗ /me failed:", e.message); return null; });
  if (!me?.id) { console.error("  ✗ Could not resolve Threads user. Skipping."); return; }

  const accountId = createId();
  const tokenKvKey = `threads/${accountId}/access_token`;
  const encrypted = await encryptToken(token, masterKey);

  await kvPut(tokenKvKey, encrypted);
  await d1Insert(
    `INSERT OR IGNORE INTO accounts
       (id, user_id, platform, handle, threads_user_id, token_kv_key, token_expires_at, refreshed_at, enabled, created_at, updated_at)
     VALUES (?, ?, 'threads', ?, ?, ?, ?, ?, 1, ?, ?)`,
    [accountId, userId, me.username, me.id, tokenKvKey,
     Date.now() + 60 * 24 * 3600 * 1000, Date.now(), Date.now(), Date.now()],
  );
  console.log(`  ✓ Threads @${me.username} (id=${me.id}) seeded as account ${accountId}`);
}

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  const r = await d1Query<{ id: string }>(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
  return r[0] ?? null;
}

async function d1Query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/d1/database/${cf.d1Id}/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${cf.apiToken}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body = await res.json() as { result?: Array<{ results: T[] }> };
  return body.result?.[0]?.results ?? [];
}

async function d1Insert(sql: string, params: unknown[]): Promise<void> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/d1/database/${cf.d1Id}/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${cf.apiToken}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  if (!res.ok) throw new Error(`D1 ${res.status} ${await res.text()}`);
}

async function kvPut(key: string, value: string): Promise<void> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/storage/kv/namespaces/${cf.kvId}/values/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      headers: { authorization: `Bearer ${cf.apiToken}`, "content-type": "text/plain" },
      body: value,
    },
  );
  if (!res.ok) throw new Error(`KV ${res.status} ${await res.text()}`);
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

async function encryptToken(plain: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(key));
  const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, enc.encode(plain)),
  );
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  let s = "";
  for (let i = 0; i < combined.length; i++) s += String.fromCharCode(combined[i]!);
  return btoa(s);
}

function loadDevVars(): Record<string, string> {
  try {
    const text = readFileSync(".dev.vars", "utf8");
    const out: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && m[1] && m[2] !== undefined) out[m[1]] = m[2];
    }
    return { ...out, ...process.env };
  } catch {
    return process.env as Record<string, string>;
  }
}

function required(name: string): string {
  const v = loadDevVars()[name];
  if (!v) {
    console.error(`${name} env var (or .dev.vars line) is required`);
    process.exit(1);
  }
  return v;
}
