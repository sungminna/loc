// threads.ts — Threads publishing via graph.threads.net v1.0.
//
// CLI:
//   bun src/sandbox/threads.ts publish \
//     --run-id <runId> \
//     [--image-r2-key runs/<runId>/threads.jpg] \
//     --text-body "..." \
//     [--hashtags "tag1,tag2"] \
//     [--topic-tag "ai"] \
//     [--reply-control everyone] \
//     [--link-attachment "https://..."] \
//     [--alt-text "..."] \
//     [--attribution "..."] \
//     --lang ko

import { api } from "./lib/api";
import { publicUrl } from "./upload";

const GRAPH = "https://graph.threads.net/v1.0";
const THREADS_TEXT_MAX = 500;
const REPLY_CONTROLS = ["everyone", "accounts_you_follow", "mentioned_only"] as const;
type ReplyControl = (typeof REPLY_CONTROLS)[number];

interface Args {
  runId: string;
  imageR2Key?: string;
  textBody: string;
  hashtags: string[];
  topicTag?: string;
  replyControl?: ReplyControl;
  linkAttachment?: string;
  altText?: string;
  attribution?: string;
  lang: "ko" | "en";
  audioTrackId?: string;
  templateSlug?: string;
}

function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]?.startsWith("--")) m.set(argv[i]!.slice(2), argv[++i] ?? "");
  }
  const replyRaw = m.get("reply-control");
  return {
    runId: m.get("run-id") ?? "",
    imageR2Key: m.get("image-r2-key") || undefined,
    textBody: m.get("text-body") ?? m.get("text") ?? "",
    hashtags: parseTagList(m.get("hashtags")),
    topicTag: m.get("topic-tag")?.replace(/^#+/, "") || undefined,
    replyControl: replyRaw && (REPLY_CONTROLS as readonly string[]).includes(replyRaw)
      ? (replyRaw as ReplyControl)
      : undefined,
    linkAttachment: m.get("link-attachment") || undefined,
    altText: m.get("alt-text") || undefined,
    attribution: m.get("attribution") || undefined,
    lang: (m.get("lang") ?? "ko") as "ko" | "en",
    audioTrackId: m.get("audio-track-id"),
    templateSlug: m.get("template-slug"),
  };
}

function parseTagList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/^#+/, ""))
    .filter(Boolean);
}

function composeText(args: Args): string {
  // Threads inline hashtags live inside the text body. We add a tag line
  // only if it fits under the 500-char hard limit; otherwise we drop tags
  // first, then truncate body.
  const tags = Array.from(new Set(args.hashtags));
  const tagLine = tags.length ? tags.map((t) => `#${t}`).join(" ") : "";
  const parts = [args.textBody.trim()];
  if (args.attribution) parts.push(`🎵 ${args.attribution}`);
  if (tagLine) parts.push(tagLine);
  let text = parts.filter(Boolean).join("\n\n");
  if (text.length > THREADS_TEXT_MAX) {
    text = parts.slice(0, -1).filter(Boolean).join("\n\n");
  }
  if (text.length > THREADS_TEXT_MAX) text = text.slice(0, THREADS_TEXT_MAX);
  return text;
}

async function publish(args: Args): Promise<void> {
  const userId = process.env.THREADS_USER_ID;
  const accountId = process.env.THREADS_ACCOUNT_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  if (!userId || !accountId || !token) {
    throw new Error("missing THREADS_USER_ID / THREADS_ACCOUNT_ID / THREADS_ACCESS_TOKEN");
  }

  const text = composeText(args);
  const imageUrl = args.imageR2Key ? publicUrl(args.imageR2Key) : undefined;
  const isImage = Boolean(imageUrl);

  const { post } = await api.recordPost({
    runId: args.runId,
    accountId,
    templateSlug: args.templateSlug,
    platform: "threads",
    mediaType: isImage ? "photo" : "text",
    caption: text,
    lang: args.lang,
    assetKeys: args.imageR2Key ? [args.imageR2Key] : [],
    audioTrackId: args.audioTrackId,
  });

  try {
    const params = new URLSearchParams({
      media_type: isImage ? "IMAGE" : "TEXT",
      text,
      access_token: token,
    });
    if (imageUrl) params.set("image_url", imageUrl);
    if (args.replyControl) params.set("reply_control", args.replyControl);
    if (args.topicTag) params.set("topic_tag", args.topicTag);
    if (args.altText && isImage) params.set("alt_text", args.altText);
    // link_attachment is TEXT-only; sending it on IMAGE/VIDEO containers 400s.
    if (args.linkAttachment && !isImage) params.set("link_attachment", args.linkAttachment);

    const create = await fetch(`${GRAPH}/${userId}/threads`, {
      method: "POST",
      body: params,
    }).then(jsonOrThrow) as { id: string };

    if (isImage) await waitForContainer(create.id, token);

    const pub = await fetch(
      `${GRAPH}/${userId}/threads_publish?creation_id=${create.id}&access_token=${token}`,
      { method: "POST" },
    ).then(jsonOrThrow) as { id: string };

    const detail = await fetch(
      `${GRAPH}/${pub.id}?fields=permalink&access_token=${token}`,
    ).then(jsonOrThrow) as { permalink: string };

    await api.updatePost({
      id: post.id,
      remoteId: pub.id,
      permalink: detail.permalink,
      status: "published",
      publishedAt: Date.now(),
    });

    console.log(JSON.stringify({ postId: post.id, remoteId: pub.id, permalink: detail.permalink }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await api.updatePost({ id: post.id, status: "failed", errorMessage: msg.slice(0, 500) });
    throw e;
  }
}

interface ContainerStatus {
  status?: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";
  error_message?: string;
}

async function waitForContainer(creationId: string, token: string): Promise<void> {
  // Threads requires media containers to be FINISHED before publish; the
  // docs recommend ~30s but real-world latency varies. Poll until ready
  // or 5 min, whichever comes first.
  const deadline = Date.now() + 5 * 60 * 1000;
  let delay = 5000;
  // Initial wait — Meta will return IN_PROGRESS immediately otherwise.
  await new Promise((r) => setTimeout(r, 5000));
  while (Date.now() < deadline) {
    const s = await fetch(
      `${GRAPH}/${creationId}?fields=status,error_message&access_token=${token}`,
    ).then(jsonOrThrow) as ContainerStatus;
    if (s.status === "FINISHED") return;
    if (s.status === "ERROR" || s.status === "EXPIRED") {
      throw new Error(`Threads container ${creationId} status=${s.status}` +
        (s.error_message ? ` — ${s.error_message}` : ""));
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 20000);
  }
  throw new Error(`Threads container ${creationId} did not finish within 5 min`);
}

async function jsonOrThrow(r: Response): Promise<unknown> {
  const text = await r.text();
  if (!r.ok) throw new Error(`Threads API ${r.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

const cmd = process.argv[2];
const argv = process.argv.slice(3);

if (cmd === "publish") {
  publish(parseArgs(argv)).catch((e) => {
    console.error(e instanceof Error ? e.stack : String(e));
    process.exit(1);
  });
} else {
  console.error(
    "usage: bun src/sandbox/threads.ts publish " +
    "--run-id ... --text-body \"...\" --lang ko " +
    "[--image-r2-key ...] [--hashtags \"a,b\"] [--topic-tag \"ai\"] " +
    "[--reply-control everyone|accounts_you_follow|mentioned_only] " +
    "[--link-attachment \"https://...\"] [--alt-text \"...\"] " +
    "[--attribution \"...\"] [--audio-track-id ...] [--template-slug ...]",
  );
  process.exit(2);
}
