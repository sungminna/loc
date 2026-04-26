// Refreshes Meta (IG/Threads) long-lived tokens before they expire.
// Runs as part of the cron tick. A token is refreshed when it has
// ≤ 7 days left. Fresh exchange yields a new 60-day token.

import { and, eq, isNotNull, lte } from "drizzle-orm";
import { getDb } from "@db/client";
import { accounts } from "@db/schema";
import type { Env } from "@shared/env";
import { decryptToken, encryptToken } from "./crypto";

const REFRESH_WINDOW_MS = 7 * 24 * 3600 * 1000;
const RENEWED_VALIDITY_MS = 60 * 24 * 3600 * 1000;

export async function refreshExpiringTokens(env: Env): Promise<void> {
  const db = getDb(env.DB);
  const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS);

  const due = await db.query.accounts.findMany({
    where: and(
      eq(accounts.enabled, true),
      isNotNull(accounts.tokenExpiresAt),
      lte(accounts.tokenExpiresAt, cutoff),
    ),
  });

  for (const acc of due) {
    try {
      const blob = await env.TOKENS.get(acc.tokenKvKey);
      if (!blob) continue;
      const current = await decryptToken(blob, env.LOC_MASTER_KEY);

      let fresh: string | null = null;
      let newExpires = Date.now() + RENEWED_VALIDITY_MS;

      if (acc.platform === "instagram") {
        // Instagram Login: ig_refresh_token (extends 60d, callable any time
        // after token has been valid ≥24h)
        const r = await fetch(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token` +
            `&access_token=${current}`,
        );
        if (!r.ok) {
          console.error(`refresh ig ${acc.id}: ${r.status} ${await r.text()}`);
          continue;
        }
        const j = (await r.json()) as { access_token: string; expires_in?: number };
        fresh = j.access_token;
        if (j.expires_in) newExpires = Date.now() + j.expires_in * 1000;
      } else if (acc.platform === "threads") {
        // Threads has its own refresh endpoint
        const r = await fetch(
          `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${current}`,
        );
        if (!r.ok) {
          console.error(`refresh threads ${acc.id}: ${r.status} ${await r.text()}`);
          continue;
        }
        const j = (await r.json()) as { access_token: string; expires_in?: number };
        fresh = j.access_token;
        if (j.expires_in) newExpires = Date.now() + j.expires_in * 1000;
      }

      if (!fresh) continue;
      const enc = await encryptToken(fresh, env.LOC_MASTER_KEY);
      await env.TOKENS.put(acc.tokenKvKey, enc);
      await db.update(accounts).set({
        tokenExpiresAt: new Date(newExpires),
        refreshedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(accounts.id, acc.id));
      console.log(`refreshed ${acc.platform} @${acc.handle} → expires ${new Date(newExpires).toISOString()}`);
    } catch (e) {
      console.error(`refresh ${acc.id} threw:`, e instanceof Error ? e.message : String(e));
    }
  }
}
