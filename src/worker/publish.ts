// Manual publish from the dashboard. Mirrors the sandbox-side
// src/sandbox/ig.ts / src/sandbox/threads.ts publish flows but runs in the
// Worker so the user can re-publish a finished run without spinning up a
// container. All token reads + KV decryption + Graph API calls happen here.

import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "@db/client";
import { accounts, assets, audioTracks, posts, runs, topics, type Run, type Topic, type Account } from "@db/schema";
import type { Env } from "@shared/env";
import { decryptToken } from "./crypto";

const IG_GRAPH = "https://graph.instagram.com/v25.0";
const THREADS_GRAPH = "https://graph.threads.net/v1.0";
const IG_CAPTION_MAX = 2200;
const IG_HASHTAG_MAX = 30;
const THREADS_TEXT_MAX = 500;

interface BriefShape {
  caption?: { instagram?: string; threads?: string };
  threads?: { text?: string };
  hashtags?: string[];
  threadsTopicTag?: string;
}

export async function publishRunToInstagram(
  env: Env,
  run: Run,
): Promise<{ postId: string; remoteId: string; permalink: string }> {
  assertRunPublishable(run);
  const db = getDb(env.DB);
  const topic = await db.query.topics.findFirst({ where: eq(topics.id, run.topicId) });
  if (!topic) throw new TRPCError({ code: "NOT_FOUND", message: "topic missing" });
  const accountId = topic.targetAccounts.instagram;
  if (!accountId) throw new TRPCError({ code: "BAD_REQUEST", message: "토픽에 Instagram 계정이 연결되어 있지 않습니다" });

  const account = await loadAccount(db, accountId, run.userId, "instagram");
  const token = await readToken(env, account.tokenKvKey);
  if (!account.igUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "계정에 igUserId가 없습니다 — 다시 OAuth 연결하세요" });

  const reel = await findAsset(db, run.id, "reel-mp4");
  if (!reel) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "이 실행에 reel-mp4 자산이 없습니다 — 렌더가 완료되지 않았습니다" });
  const cover = await findAsset(db, run.id, "thumb");

  const brief = (run.briefJson ?? {}) as BriefShape;
  const hashtags = composeHashtags(topic, brief);
  const attribution = await loadAudioAttribution(db, run.id);
  const caption = composeIgCaption(brief.caption?.instagram ?? "", hashtags, attribution);

  const assetKeys = [reel.r2Key, ...(cover ? [cover.r2Key] : [])];
  const post = await upsertPostRow(db, {
    runId: run.id,
    userId: run.userId,
    accountId: account.id,
    platform: "instagram",
    mediaType: "reel",
    caption,
    lang: postLang(topic.lang),
    assetKeys,
    audioTrackId: await loadAudioTrackId(db, run.id) ?? null,
  });

  try {
    // Route through the Worker `/media/` proxy — IG's Reels fetcher refuses
    // `*.r2.dev` URLs because of Cloudflare's default robots policy.
    const workerBase = env.PUBLIC_WORKER_URL.replace(/\/$/, "");
    const mediaUrl = (key: string) =>
      `${workerBase}/media/${key.split("/").map(encodeURIComponent).join("/")}`;
    const videoUrl = mediaUrl(reel.r2Key);
    const coverUrl = cover ? mediaUrl(cover.r2Key) : undefined;

    const params = new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      share_to_feed: "true",
      access_token: token,
    });
    if (coverUrl) params.set("cover_url", coverUrl);

    const create = await fetch(`${IG_GRAPH}/${account.igUserId}/media`, {
      method: "POST",
      body: params,
    }).then(r => jsonOrThrow(r, "Instagram")) as { id: string };

    await pollIgContainer(create.id, token);

    const publish = await fetch(
      `${IG_GRAPH}/${account.igUserId}/media_publish?creation_id=${create.id}&access_token=${encodeURIComponent(token)}`,
      { method: "POST" },
    ).then(r => jsonOrThrow(r, "Instagram")) as { id: string };

    const detail = await fetch(
      `${IG_GRAPH}/${publish.id}?fields=permalink&access_token=${encodeURIComponent(token)}`,
    ).then(r => jsonOrThrow(r, "Instagram")) as { permalink: string };

    await db.update(posts).set({
      remoteId: publish.id,
      permalink: detail.permalink,
      status: "published",
      publishedAt: new Date(),
      errorMessage: null,
      updatedAt: new Date(),
    }).where(eq(posts.id, post.id));

    return { postId: post.id, remoteId: publish.id, permalink: detail.permalink };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(posts).set({
      status: "failed",
      errorMessage: msg.slice(0, 500),
      updatedAt: new Date(),
    }).where(eq(posts.id, post.id));
    throw e instanceof TRPCError ? e : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
  }
}

export async function publishRunToThreads(
  env: Env,
  run: Run,
): Promise<{ postId: string; remoteId: string; permalink: string }> {
  assertRunPublishable(run);
  const db = getDb(env.DB);
  const topic = await db.query.topics.findFirst({ where: eq(topics.id, run.topicId) });
  if (!topic) throw new TRPCError({ code: "NOT_FOUND", message: "topic missing" });
  const accountId = topic.targetAccounts.threads;
  if (!accountId) throw new TRPCError({ code: "BAD_REQUEST", message: "토픽에 Threads 계정이 연결되어 있지 않습니다" });

  const account = await loadAccount(db, accountId, run.userId, "threads");
  const token = await readToken(env, account.tokenKvKey);
  if (!account.threadsUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "계정에 threadsUserId가 없습니다 — 다시 OAuth 연결하세요" });

  const brief = (run.briefJson ?? {}) as BriefShape;
  const hashtags = composeHashtags(topic, brief);
  const attribution = await loadAudioAttribution(db, run.id);
  const bodyText = brief.threads?.text ?? brief.caption?.threads ?? "";
  const text = composeThreadsText(bodyText, hashtags, attribution);

  // Image is optional — if topic.threadsFormat = "text", or no JPG was rendered.
  const wantImage = topic.threadsFormat === "image";
  const image = wantImage ? await findAsset(db, run.id, "threads-jpg") : null;
  const isImage = Boolean(image);

  const post = await upsertPostRow(db, {
    runId: run.id,
    userId: run.userId,
    accountId: account.id,
    platform: "threads",
    mediaType: isImage ? "photo" : "text",
    caption: text,
    lang: postLang(topic.lang),
    assetKeys: image ? [image.r2Key] : [],
    audioTrackId: await loadAudioTrackId(db, run.id) ?? null,
  });

  try {
    const params = new URLSearchParams({
      media_type: isImage ? "IMAGE" : "TEXT",
      text,
      access_token: token,
    });
    if (image) params.set("image_url", `${env.R2_PUBLIC_BASE}/${image.r2Key}`);
    if (brief.threadsTopicTag) params.set("topic_tag", brief.threadsTopicTag.replace(/^#+/, ""));

    const create = await fetch(`${THREADS_GRAPH}/${account.threadsUserId}/threads`, {
      method: "POST",
      body: params,
    }).then(r => jsonOrThrow(r, "Threads")) as { id: string };

    if (isImage) await pollThreadsContainer(create.id, token);

    const pub = await fetch(
      `${THREADS_GRAPH}/${account.threadsUserId}/threads_publish?creation_id=${create.id}&access_token=${encodeURIComponent(token)}`,
      { method: "POST" },
    ).then(r => jsonOrThrow(r, "Threads")) as { id: string };

    const detail = await fetch(
      `${THREADS_GRAPH}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`,
    ).then(r => jsonOrThrow(r, "Threads")) as { permalink: string };

    await db.update(posts).set({
      remoteId: pub.id,
      permalink: detail.permalink,
      status: "published",
      publishedAt: new Date(),
      errorMessage: null,
      updatedAt: new Date(),
    }).where(eq(posts.id, post.id));

    return { postId: post.id, remoteId: pub.id, permalink: detail.permalink };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(posts).set({
      status: "failed",
      errorMessage: msg.slice(0, 500),
      updatedAt: new Date(),
    }).where(eq(posts.id, post.id));
    throw e instanceof TRPCError ? e : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
  }
}

// ─── helpers ──────────────────────────────────────────────────────────

async function loadAccount(
  db: ReturnType<typeof getDb>,
  accountId: string,
  userId: string,
  platform: "instagram" | "threads",
): Promise<Account> {
  const row = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  if (!row || row.userId !== userId) throw new TRPCError({ code: "NOT_FOUND", message: "account not found" });
  if (row.platform !== platform) throw new TRPCError({ code: "BAD_REQUEST", message: `account is for ${row.platform}, not ${platform}` });
  if (!row.enabled) throw new TRPCError({ code: "BAD_REQUEST", message: "account is disabled" });
  return row;
}

async function readToken(env: Env, kvKey: string): Promise<string> {
  const blob = await env.TOKENS.get(kvKey);
  if (!blob) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "토큰이 없습니다 — 계정을 다시 연결하세요" });
  try {
    return await decryptToken(blob, env.LOC_MASTER_KEY);
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "토큰 복호화 실패" });
  }
}

async function findAsset(db: ReturnType<typeof getDb>, runId: string, kind: typeof assets.$inferSelect["kind"]) {
  const rows = await db.query.assets.findMany({
    where: and(eq(assets.runId, runId), eq(assets.kind, kind)),
    orderBy: [desc(assets.createdAt)],
    limit: 1,
  });
  return rows[0] ?? null;
}

async function loadAudioTrackId(db: ReturnType<typeof getDb>, runId: string): Promise<string | null> {
  // Reuse audioTrackId from any prior post for this run, so manual republish
  // doesn't lose the BGM attribution linkage.
  const prior = await db.query.posts.findFirst({
    where: eq(posts.runId, runId),
    orderBy: [desc(posts.createdAt)],
  });
  return prior?.audioTrackId ?? null;
}

async function loadAudioAttribution(db: ReturnType<typeof getDb>, runId: string): Promise<string | undefined> {
  const trackId = await loadAudioTrackId(db, runId);
  if (!trackId) return undefined;
  const track = await db.query.audioTracks.findFirst({ where: eq(audioTracks.id, trackId) });
  return track?.attributionText ?? undefined;
}

function composeHashtags(topic: Topic, brief: BriefShape): string[] {
  const ai = (brief.hashtags ?? []).map(s => s.replace(/^#+/, "")).filter(Boolean);
  const fixed = (topic.fixedHashtags ?? []).map(s => s.replace(/^#+/, "")).filter(Boolean);
  let out: string[];
  if (topic.hashtagMode === "fixed") out = fixed;
  else if (topic.hashtagMode === "mixed") out = Array.from(new Set([...ai, ...fixed]));
  else out = ai;
  return out.slice(0, IG_HASHTAG_MAX);
}

function composeIgCaption(body: string, hashtags: string[], attribution: string | undefined): string {
  const tagLine = hashtags.length ? hashtags.map(t => `#${t}`).join(" ") : "";
  const parts = [body.trim()];
  if (attribution) parts.push(`🎵 Music: ${attribution}`);
  if (tagLine) parts.push(tagLine);
  let caption = parts.filter(Boolean).join("\n\n");
  if (caption.length > IG_CAPTION_MAX) {
    caption = parts.slice(0, -1).filter(Boolean).join("\n\n").slice(0, IG_CAPTION_MAX);
  }
  return caption;
}

function composeThreadsText(body: string, hashtags: string[], attribution: string | undefined): string {
  const tags = hashtags.slice(0, 5);
  const tagLine = tags.length ? tags.map(t => `#${t}`).join(" ") : "";
  const parts = [body.trim()];
  if (attribution) parts.push(`🎵 ${attribution}`);
  if (tagLine) parts.push(tagLine);
  let text = parts.filter(Boolean).join("\n\n");
  if (text.length > THREADS_TEXT_MAX) {
    text = parts.slice(0, -1).filter(Boolean).join("\n\n");
  }
  if (text.length > THREADS_TEXT_MAX) text = text.slice(0, THREADS_TEXT_MAX);
  return text;
}

interface UpsertPost {
  runId: string;
  userId: string;
  accountId: string;
  platform: "instagram" | "threads";
  mediaType: "reel" | "photo" | "carousel" | "text";
  caption: string;
  lang: "ko" | "en";
  assetKeys: string[];
  audioTrackId: string | null;
}

async function upsertPostRow(
  db: ReturnType<typeof getDb>,
  data: UpsertPost,
): Promise<typeof posts.$inferSelect> {
  // Reuse a non-published row for this (run, platform) so retries don't pile
  // up duplicate failed/pending records. If the most recent is `published`
  // we still allow inserting a new row — that's a deliberate re-post.
  const existing = await db.query.posts.findFirst({
    where: and(eq(posts.runId, data.runId), eq(posts.platform, data.platform)),
    orderBy: [desc(posts.createdAt)],
  });
  if (existing && existing.status !== "published") {
    await db.update(posts).set({
      caption: data.caption,
      assetKeys: data.assetKeys,
      mediaType: data.mediaType,
      audioTrackId: data.audioTrackId,
      status: "pending",
      errorMessage: null,
      updatedAt: new Date(),
    }).where(eq(posts.id, existing.id));
    const row = await db.query.posts.findFirst({ where: eq(posts.id, existing.id) });
    if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return row;
  }
  const [row] = await db.insert(posts).values({
    runId: data.runId,
    userId: data.userId,
    accountId: data.accountId,
    platform: data.platform,
    mediaType: data.mediaType,
    caption: data.caption,
    lang: data.lang,
    assetKeys: data.assetKeys,
    audioTrackId: data.audioTrackId,
    status: "pending",
  }).returning();
  if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return row;
}

interface IgContainerStatus {
  status_code: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";
  status?: string;
  error_message?: string;
}

async function pollIgContainer(creationId: string, token: string): Promise<void> {
  const deadline = Date.now() + 5 * 60 * 1000;
  let delay = 4000;
  while (Date.now() < deadline) {
    const status = await fetch(
      `${IG_GRAPH}/${creationId}?fields=status_code,status,error_message&access_token=${encodeURIComponent(token)}`,
    ).then(r => jsonOrThrow(r, "Instagram")) as IgContainerStatus;
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(
        `IG container ${creationId} status=${status.status_code}` +
        (status.error_message ? ` — ${status.error_message}` : ""),
      );
    }
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 20000);
  }
  throw new Error(`IG container ${creationId} did not finish within 5 min`);
}

interface ThreadsContainerStatus {
  status?: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";
  error_message?: string;
}

async function pollThreadsContainer(creationId: string, token: string): Promise<void> {
  const deadline = Date.now() + 5 * 60 * 1000;
  let delay = 5000;
  await new Promise(r => setTimeout(r, 5000));
  while (Date.now() < deadline) {
    const s = await fetch(
      `${THREADS_GRAPH}/${creationId}?fields=status,error_message&access_token=${encodeURIComponent(token)}`,
    ).then(r => jsonOrThrow(r, "Threads")) as ThreadsContainerStatus;
    if (s.status === "FINISHED") return;
    if (s.status === "ERROR" || s.status === "EXPIRED") {
      throw new Error(`Threads container ${creationId} status=${s.status}` +
        (s.error_message ? ` — ${s.error_message}` : ""));
    }
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 20000);
  }
  throw new Error(`Threads container ${creationId} did not finish within 5 min`);
}

async function jsonOrThrow(r: Response, label: string): Promise<unknown> {
  const text = await r.text();
  if (!r.ok) throw new Error(`${label} API ${r.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

// Re-publish a specific post row by looking up its run.platform and
// dispatching to the right helper. Used by the dashboard's "다시 시도" button.
//
// Only retries failed/pending posts. Once a post is `published` we refuse —
// otherwise a double-click would create a duplicate Meta post (the
// underlying publish helpers insert a fresh row when the latest one is
// already published, on purpose for deliberate re-posts).
export async function retryPostById(env: Env, postId: string, userId: string): Promise<{ permalink: string }> {
  const db = getDb(env.DB);
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post || post.userId !== userId) throw new TRPCError({ code: "NOT_FOUND" });
  if (post.status === "published") {
    throw new TRPCError({ code: "CONFLICT", message: "이미 게시된 포스트입니다 — 새 포스트를 만들려면 토픽을 다시 실행하세요." });
  }
  const run = await db.query.runs.findFirst({ where: eq(runs.id, post.runId) });
  if (!run || run.userId !== userId) throw new TRPCError({ code: "NOT_FOUND" });
  assertRunPublishable(run);
  const out = post.platform === "instagram"
    ? await publishRunToInstagram(env, run)
    : await publishRunToThreads(env, run);
  return { permalink: out.permalink };
}

// Run statuses where a manual publish is unsafe — the sandbox is mid-flight
// and may insert its own posts row, leading to a duplicate IG/Threads post.
// Only `done` (everything finished) or `failed` (sandbox bailed) are safe.
const NON_PUBLISHABLE_RUN_STATUSES = new Set([
  "planned",
  "researching",
  "planning",
  "generating",
  "rendering",
  "publishing",
]);

export function assertRunPublishable(run: Run): void {
  if (NON_PUBLISHABLE_RUN_STATUSES.has(run.status)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `실행이 아직 진행 중입니다 (${run.status}). 'done' 또는 'failed' 상태가 된 후 다시 시도하세요.`,
    });
  }
}

function postLang(topicLang: "ko" | "en" | "ko+en"): "ko" | "en" {
  // posts.lang only allows ko/en; ko+en topics default to ko since their
  // captions are written in Korean by content-plan with English subtitles.
  return topicLang === "en" ? "en" : "ko";
}
