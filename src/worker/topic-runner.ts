import { DurableObject } from "cloudflare:workers";
import type { Env } from "@shared/env";

interface LockState {
  runId: string;
  acquiredAt: number;
}

const STORAGE_KEY = "lock";

// Per-topic mutex backed by Durable Object storage. Storage is required —
// the DO can hibernate and lose `this.<field>` between activations, which
// would let a second sandbox spawn for the same topic. The 15-min alarm is
// the recovery path if the holder crashes before /release.
export class TopicRunner extends DurableObject<Env> {
  private readonly lockTtlMs = 15 * 60 * 1000;

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/acquire") {
      const cur = await this.ctx.storage.get<LockState>(STORAGE_KEY);
      if (cur && Date.now() - cur.acquiredAt < this.lockTtlMs) {
        return new Response(JSON.stringify({ held: true, runId: cur.runId }), {
          status: 423,
          headers: { "content-type": "application/json" },
        });
      }
      const body = (await req.json().catch(() => ({}))) as { runId?: string };
      const next: LockState = { runId: body.runId ?? "unknown", acquiredAt: Date.now() };
      await this.ctx.storage.put(STORAGE_KEY, next);
      await this.ctx.storage.setAlarm(Date.now() + this.lockTtlMs);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/release") {
      await this.ctx.storage.delete(STORAGE_KEY);
      await this.ctx.storage.deleteAlarm();
      return new Response("ok");
    }
    if (url.pathname === "/status") {
      const cur = await this.ctx.storage.get<LockState>(STORAGE_KEY);
      return new Response(JSON.stringify(cur ?? null), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }

  override async alarm(): Promise<void> {
    // Holder didn't release within the TTL. Drop the lock so a future run
    // for this topic can proceed.
    await this.ctx.storage.delete(STORAGE_KEY);
  }
}
