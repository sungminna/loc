// PUT /api/audio/upload?key=audio/u-<userId>/<file>
// Streams the request body to R2. Authenticated via Cloudflare Access.

import type { Env } from "@shared/env";
import { authenticate } from "../auth";

const ALLOWED_MIME = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"]);
const MAX_BYTES = 25 * 1024 * 1024;

export async function handleAudioUpload(req: Request, env: Env): Promise<Response> {
  if (req.method !== "PUT" && req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  const ctx = await authenticate(req, env);
  if (!ctx) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return json({ error: "key required" }, 400);

  // Enforce that the key belongs to this user's namespace
  if (!key.startsWith(`audio/u-${ctx.user.id}/`) && !key.startsWith("audio/ncs/")) {
    return json({ error: "key must live under audio/u-<yourId>/" }, 403);
  }

  const mime = req.headers.get("content-type") ?? "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return json({ error: `mime ${mime} not allowed (use mp3/m4a/wav)` }, 415);
  }
  const lengthHeader = req.headers.get("content-length");
  const length = lengthHeader ? Number(lengthHeader) : undefined;
  if (length !== undefined && length > MAX_BYTES) {
    return json({ error: `too large (max ${MAX_BYTES})` }, 413);
  }
  if (!req.body) return json({ error: "no body" }, 400);

  await env.MEDIA.put(key, req.body, {
    httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000" },
  });

  return json({ key, url: `${env.R2_PUBLIC_BASE}/${key}` });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
