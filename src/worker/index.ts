import type { Env, RunMessage } from "@shared/env";
import { dispatch, consume, consumeDlq } from "./scheduler";
import { handleTrpc } from "./api/trpc";
import { handleInternal } from "./api/internal";
import { handleAudioUpload } from "./api/audio-upload";
import { igStart, igCallback, igDeauth, igDelete } from "./oauth/instagram";
import { threadsStart, threadsCallback, threadsDeauth, threadsDelete } from "./oauth/threads";

export { TopicRunner } from "./topic-runner";
export { Sandbox } from "@cloudflare/sandbox";

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(dispatch(env));
  },

  async queue(batch, env, ctx) {
    // Both `loc-runs` (primary) and `loc-runs-dlq` (dead-letter) point at
    // this same handler — branch on batch.queue so DLQ messages don't try
    // to acquire a TopicRunner lock or spawn a sandbox.
    if (batch.queue === "loc-runs-dlq") {
      await consumeDlq(batch as MessageBatch<RunMessage>, env);
      return;
    }
    await consume(batch as MessageBatch<RunMessage>, env, ctx);
  },

  async fetch(req, env, _ctx) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/health") return new Response("ok");

    // Public R2 streaming proxy. The default `*.r2.dev` URL is blocked by
    // robots.txt, which Meta's video fetcher honors and refuses to download
    // Reels from. Routing through the Worker avoids that — same data, same
    // bucket, different domain. Cached at the edge for 1y.
    if (p.startsWith("/media/")) return handleMedia(req, env, p);

    if (p.startsWith("/api/trpc")) return handleTrpc(req, env);
    if (p.startsWith("/internal/")) return handleInternal(req, env, p);
    if (p === "/api/audio/upload") return handleAudioUpload(req, env);

    if (p === "/oauth/ig/start") return igStart(req, env);
    if (p === "/oauth/ig/callback") return igCallback(req, env);
    if (p === "/oauth/threads/start") return threadsStart(req, env);
    if (p === "/oauth/threads/callback") return threadsCallback(req, env);

    // Meta-required webhook endpoints — signed_request is verified per handler.
    if (p === "/oauth/ig/deauth") return igDeauth(req, env);
    if (p === "/oauth/ig/delete") return igDelete(req, env);
    if (p === "/oauth/threads/deauth") return threadsDeauth(req, env);
    if (p === "/oauth/threads/delete") return threadsDelete(req, env);

    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

async function handleMedia(req: Request, env: Env, path: string): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("method not allowed", { status: 405 });
  }
  const key = decodeURIComponent(path.slice("/media/".length));
  if (!key || key.includes("..")) return new Response("bad key", { status: 400 });

  // R2 binding accepts the request's Range / If-Modified-Since headers directly
  // via `onlyIf` and `range` — passing them through gives us conditional GETs
  // and partial content for free. Cast to `Headers` because the union type
  // forces `length: number` on the object form.
  const rangeHeader = req.headers.get("range");
  const opts: R2GetOptions = { onlyIf: req.headers };
  if (rangeHeader) opts.range = req.headers;
  const obj = await env.MEDIA.get(key, opts);
  if (!obj) return new Response("not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  // Strong robots-allow so Meta's fetcher doesn't refuse the URL.
  headers.set("x-robots-tag", "all");

  // R2GetOptions.onlyIf may have caused R2 to return an R2Object (no body)
  // for an If-None-Match hit — return 304 in that case.
  const body = (obj as R2ObjectBody).body;
  if (!body) return new Response(null, { status: 304, headers });

  if (rangeHeader && obj.range) {
    const r = obj.range as { offset?: number; length?: number; suffix?: number };
    const offset = r.offset ?? (r.suffix ? Math.max(0, obj.size - r.suffix) : 0);
    const length = r.length ?? (obj.size - offset);
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set("content-length", String(length));
    return new Response(body, { status: 206, headers });
  }
  return new Response(body, { headers });
}
