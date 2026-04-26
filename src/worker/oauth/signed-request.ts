// Meta signed_request parser/verifier.
//
// Format: "<base64url-sig>.<base64url-payload>"
//   sig     = HMAC-SHA256(payload, app_secret)
//   payload = JSON, includes { user_id, algorithm: "HMAC-SHA256", issued_at, ... }
//
// Used by both Instagram and Threads deauth/data-deletion callbacks.
// Spec: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

import { eq, and } from "drizzle-orm";
import { getDb } from "@db/client";
import { accounts } from "@db/schema";
import type { Env } from "@shared/env";

export interface SignedPayload {
  user_id: string;
  algorithm: string;
  issued_at?: number;
  [k: string]: unknown;
}

export async function parseSignedRequest(
  raw: string | null,
  appSecret: string,
): Promise<SignedPayload | null> {
  if (!raw) return null;
  // Without a real secret, HMAC verification is trivially forgeable.
  // Refuse rather than silently accept anything.
  if (!appSecret || appSecret.length < 16) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;

  const sigB64 = raw.slice(0, dot);
  const payloadB64 = raw.slice(dot + 1);
  const expected = await hmacSha256(appSecret, payloadB64);
  let actual: Uint8Array;
  try { actual = b64urlDecodeBytes(sigB64); } catch { return null; }
  if (!constantTimeEqual(actual, expected)) return null;

  try {
    const payloadStr = new TextDecoder().decode(b64urlDecodeBytes(payloadB64));
    const payload = JSON.parse(payloadStr) as SignedPayload;
    if (payload.algorithm !== "HMAC-SHA256") return null;
    if (!payload.user_id) return null;
    // Reject stale signatures (>24h old) to limit replay window. Skipped if
    // the field is absent (legacy senders), since Meta marks it optional.
    if (typeof payload.issued_at === "number") {
      const ageSec = Math.floor(Date.now() / 1000) - payload.issued_at;
      if (ageSec > 86400 || ageSec < -300) return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Read signed_request out of a Meta callback POST. Meta posts it as
// application/x-www-form-urlencoded with a single `signed_request` field.
export async function extractSignedRequest(req: Request): Promise<string | null> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const body = await req.text();
    return new URLSearchParams(body).get("signed_request");
  }
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const v = fd.get("signed_request");
    return typeof v === "string" ? v : null;
  }
  // Some Meta tooling sends as JSON; also accept that.
  if (ct.includes("application/json")) {
    try {
      const j = (await req.json()) as { signed_request?: string };
      return j.signed_request ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

// Disable & purge accounts owned by the provider-side user_id. Returns the
// number of rows touched. Caller decides whether to use this for deauth
// (soft-disable) vs delete (hard-purge + KV cleanup).
export async function purgeProviderUser(env: Env, platform: "instagram" | "threads", providerUserId: string): Promise<number> {
  const db = getDb(env.DB);
  const col = platform === "instagram" ? accounts.igUserId : accounts.threadsUserId;
  const rows = await db.query.accounts.findMany({
    where: and(eq(accounts.platform, platform), eq(col, providerUserId)),
  });
  for (const row of rows) {
    if (row.tokenKvKey) await env.TOKENS.delete(row.tokenKvKey).catch(() => {});
    await db.delete(accounts).where(eq(accounts.id, row.id));
  }
  return rows.length;
}

export async function disableProviderUser(env: Env, platform: "instagram" | "threads", providerUserId: string): Promise<number> {
  const db = getDb(env.DB);
  const col = platform === "instagram" ? accounts.igUserId : accounts.threadsUserId;
  const rows = await db.query.accounts.findMany({
    where: and(eq(accounts.platform, platform), eq(col, providerUserId)),
  });
  for (const row of rows) {
    if (row.tokenKvKey) await env.TOKENS.delete(row.tokenKvKey).catch(() => {});
    await db.update(accounts).set({ enabled: false, updatedAt: new Date() }).where(eq(accounts.id, row.id));
  }
  return rows.length;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function b64urlDecodeBytes(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
