import type { Env, RunMessage } from "@shared/env";
import { dispatch, consume } from "./scheduler";
import { handleTrpc } from "./api/trpc";
import { handleInternal } from "./api/internal";
import { handleAudioUpload } from "./api/audio-upload";
import { igStart, igCallback } from "./oauth/instagram";
import { threadsStart, threadsCallback } from "./oauth/threads";

export { TopicRunner } from "./topic-runner";
export { Sandbox } from "@cloudflare/sandbox";

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(dispatch(env));
  },

  async queue(batch, env, ctx) {
    await consume(batch as MessageBatch<RunMessage>, env, ctx);
  },

  async fetch(req, env, _ctx) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/health") return new Response("ok");

    if (p.startsWith("/api/trpc")) return handleTrpc(req, env);
    if (p.startsWith("/internal/")) return handleInternal(req, env, p);
    if (p === "/api/audio/upload") return handleAudioUpload(req, env);

    if (p === "/oauth/ig/start") return igStart(req, env);
    if (p === "/oauth/ig/callback") return igCallback(req, env);
    if (p === "/oauth/threads/start") return threadsStart(req, env);
    if (p === "/oauth/threads/callback") return threadsCallback(req, env);

    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
