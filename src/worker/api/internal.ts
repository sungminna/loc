// Internal REST API used by the sandbox to read/write D1.
// Auth: Bearer INTERNAL_API_KEY + LOC-Run-Id header.
// All mutations are scoped to the run/user identified by the headers — even
// with a stolen INTERNAL_API_KEY, a sandbox can only touch its own run.

import { eq } from "drizzle-orm";
import { getDb } from "@db/client";
import {
  runs,
  posts,
  assets,
  topics,
  templates,
  audioTracks,
  researchNotes,
  RUN_STATUSES,
  type RunStatus,
} from "@db/schema";
import type { Env } from "@shared/env";

interface SandboxIdentity {
  runId: string;
  topicId: string;
  userId: string;
}

export async function handleInternal(req: Request, env: Env, path: string): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.INTERNAL_API_KEY}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const ident = await resolveSandboxIdentity(req, env);
  if (!ident) return new Response("invalid run header", { status: 403 });

  const db = getDb(env.DB);
  const url = new URL(req.url);

  if (req.method === "GET" && path === "/internal/topic") {
    const id = url.searchParams.get("id") ?? ident.topicId;
    if (id !== ident.topicId) return forbidden();
    const t = await db.query.topics.findFirst({ where: eq(topics.id, id) });
    return json({ topic: t });
  }

  if (req.method === "GET" && path === "/internal/run") {
    const id = url.searchParams.get("id") ?? ident.runId;
    if (id !== ident.runId) return forbidden();
    const r = await db.query.runs.findFirst({ where: eq(runs.id, id) });
    return json({ run: r });
  }

  if (req.method === "POST" && path === "/internal/run/status") {
    const body = (await req.json()) as { runId: string; status: RunStatus; error?: string };
    if (body.runId !== ident.runId) return forbidden();
    if (!RUN_STATUSES.includes(body.status)) return json({ error: "bad status" }, 400);
    const update: Partial<typeof runs.$inferInsert> = { status: body.status, updatedAt: new Date() };
    if (body.error) update.error = body.error.slice(0, 4000);
    if (body.status === "done" || body.status === "failed") update.finishedAt = new Date();
    await db.update(runs).set(update).where(eq(runs.id, body.runId));
    return json({ ok: true });
  }

  if (req.method === "POST" && path === "/internal/run/brief") {
    const body = (await req.json()) as { runId: string; brief: Record<string, unknown> };
    if (body.runId !== ident.runId) return forbidden();
    await db.update(runs).set({ briefJson: body.brief, updatedAt: new Date() }).where(eq(runs.id, body.runId));
    return json({ ok: true });
  }

  if (req.method === "POST" && path === "/internal/asset") {
    const body = (await req.json()) as typeof assets.$inferInsert;
    if (body.runId !== ident.runId) return forbidden();
    const [row] = await db.insert(assets).values(body).returning();
    return json({ asset: row });
  }

  if (req.method === "PUT" && path === "/internal/r2/put") {
    // Sandbox-friendly R2 upload: streams body to MEDIA bucket.
    // Auth: same Bearer + LOC-Run-Id as the rest of /internal.
    const key = url.searchParams.get("key");
    if (!key) return json({ error: "key required" }, 400);
    if (!key.startsWith(`runs/${ident.runId}/`) && !key.startsWith(`audio/`)) {
      return forbidden();
    }
    if (!req.body) return json({ error: "no body" }, 400);
    const mime = req.headers.get("content-type") ?? "application/octet-stream";
    await env.MEDIA.put(key, req.body, {
      httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000" },
    });
    return json({ key, url: `${env.R2_PUBLIC_BASE}/${key}` });
  }

  if (req.method === "POST" && path === "/internal/post") {
    const body = (await req.json()) as Omit<typeof posts.$inferInsert, "userId"> & { runId: string };
    if (body.runId !== ident.runId) return forbidden();
    const [row] = await db.insert(posts).values({ ...body, userId: ident.userId }).returning();
    return json({ post: row });
  }

  if (req.method === "POST" && path === "/internal/post/update") {
    const body = (await req.json()) as Partial<typeof posts.$inferInsert> & { id: string };
    const owned = await db.query.posts.findFirst({ where: eq(posts.id, body.id) });
    if (!owned || owned.runId !== ident.runId) return forbidden();
    const { id, ...rest } = body;
    await db.update(posts).set({ ...rest, updatedAt: new Date() }).where(eq(posts.id, id));
    return json({ ok: true });
  }

  if (req.method === "POST" && path === "/internal/research-note") {
    const body = (await req.json()) as typeof researchNotes.$inferInsert;
    if (body.topicId !== ident.topicId) return forbidden();
    const [row] = await db.insert(researchNotes).values({ ...body, runId: ident.runId }).returning();
    return json({ note: row });
  }

  if (req.method === "GET" && path === "/internal/audio/list") {
    // Tracks owned by the user OR shared (userId = NULL).
    const list = await db.query.audioTracks.findMany();
    const visible = list.filter((t) => t.userId === null || t.userId === ident.userId);
    return json({ tracks: visible });
  }

  if (req.method === "POST" && path === "/internal/audio/touch") {
    const body = (await req.json()) as { id: string };
    const track = await db.query.audioTracks.findFirst({ where: eq(audioTracks.id, body.id) });
    if (!track || (track.userId !== null && track.userId !== ident.userId)) return forbidden();
    await db.update(audioTracks).set({ lastUsedAt: new Date() }).where(eq(audioTracks.id, body.id));
    return json({ ok: true });
  }

  if (req.method === "GET" && path === "/internal/template") {
    const slug = url.searchParams.get("slug");
    if (!slug) return json({ error: "slug required" }, 400);
    const tpl = await db.query.templates.findFirst({ where: eq(templates.slug, slug) });
    if (tpl && tpl.userId !== null && tpl.userId !== ident.userId) return forbidden();
    return json({ template: tpl });
  }

  return new Response("not found", { status: 404 });
}

async function resolveSandboxIdentity(req: Request, env: Env): Promise<SandboxIdentity | null> {
  const runId = req.headers.get("loc-run-id");
  if (!runId) return null;
  const db = getDb(env.DB);
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!run) return null;
  return { runId: run.id, topicId: run.topicId, userId: run.userId };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function forbidden(): Response {
  return json({ error: "forbidden: run scope mismatch" }, 403);
}
