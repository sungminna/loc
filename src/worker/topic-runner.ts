import { DurableObject } from "cloudflare:workers";
import type { Env } from "@shared/env";

interface LockState {
  runId: string;
  acquiredAt: number;
}

export class TopicRunner extends DurableObject<Env> {
  private lock: LockState | null = null;
  private readonly lockTtlMs = 15 * 60 * 1000;

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/acquire") {
      if (this.lock && Date.now() - this.lock.acquiredAt < this.lockTtlMs) {
        return new Response("locked", { status: 423 });
      }
      const body = (await req.json().catch(() => ({}))) as { runId?: string };
      this.lock = { runId: body.runId ?? "unknown", acquiredAt: Date.now() };
      await this.ctx.storage.setAlarm(Date.now() + this.lockTtlMs);
      return new Response("ok");
    }
    if (url.pathname === "/release") {
      this.lock = null;
      await this.ctx.storage.deleteAlarm();
      return new Response("ok");
    }
    return new Response("not found", { status: 404 });
  }

  override async alarm(): Promise<void> {
    this.lock = null;
  }
}
