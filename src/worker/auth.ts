// Auth middleware using Cloudflare Access (Zero Trust) headers.
//
// In production, Cloudflare Access sits in front of the Worker and adds two
// headers we trust:
//   - Cf-Access-Authenticated-User-Email
//   - Cf-Access-Jwt-Assertion (JWT signed by your team's keys)
//
// In dev mode (or when running unauthenticated), we fall back to a single
// dev user keyed off DEV_USER_EMAIL var. To enable: add `DEV_USER_EMAIL`
// to your .dev.vars file.

import { eq } from "drizzle-orm";
import { getDb, type DB } from "@db/client";
import { users, type User } from "@db/schema";
import type { Env } from "@shared/env";

export interface AuthCtx {
  user: User;
  db: DB;
  env: Env;
}

const DEV_FALLBACK_EMAIL = "dev@loc.local";

export async function authenticate(req: Request, env: Env): Promise<AuthCtx | null> {
  const db = getDb(env.DB);

  // 1. Real Cloudflare Access user
  const accessEmail = req.headers.get("cf-access-authenticated-user-email");
  if (accessEmail) {
    const user = await ensureUser(db, accessEmail);
    return { user, db, env };
  }

  // 2. Dev fallback — only if explicitly enabled via DEV_USER_EMAIL var.
  // If DEV_USER_EMAIL is unset, we treat this as unauthenticated.
  const devEmail = (env as unknown as { DEV_USER_EMAIL?: string }).DEV_USER_EMAIL;
  if (devEmail) {
    const user = await ensureUser(db, devEmail, "owner");
    return { user, db, env };
  }

  // 3. As a last-resort during local Wrangler dev only.
  // CRITICAL: do NOT include `*.workers.dev` here — that hostname IS the
  // production worker URL, and treating it as "local" hands the dashboard
  // (with owner role) to anyone on the internet. Loopback only.
  const url = new URL(req.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    const user = await ensureUser(db, DEV_FALLBACK_EMAIL, "owner");
    return { user, db, env };
  }

  return null;
}

async function ensureUser(db: DB, email: string, defaultRole: "owner" | "member" = "member"): Promise<User> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    if (!existing.lastSeenAt || Date.now() - existing.lastSeenAt.getTime() > 60_000) {
      await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, existing.id));
    }
    return existing;
  }
  const isFirst = (await db.select().from(users).limit(1)).length === 0;
  const [created] = await db.insert(users).values({
    email,
    role: isFirst ? "owner" : defaultRole,
    lastSeenAt: new Date(),
  }).returning();
  if (!created) throw new Error("failed to create user");
  return created;
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
