// ig.ts — Instagram Reels publishing via Graph API v25.0.
//
// CLI:
//   bun src/sandbox/ig.ts publish-reel \
//     --run-id <runId> \
//     --video-r2-key runs/<runId>/reel.mp4 \
//     --cover-r2-key runs/<runId>/cover.jpg \
//     --caption "..." \
//     --lang ko
//
// Reads IG_USER_ID, IG_ACCOUNT_ID, IG_ACCESS_TOKEN, R2_PUBLIC_BASE from env.
// Records `posts` row, polls container, calls media_publish.

import { api } from "./lib/api";
import { publicUrl } from "./upload";

const GRAPH = "https://graph.instagram.com/v23.0";

interface Args {
  runId: string;
  videoR2Key: string;
  coverR2Key?: string;
  caption: string;
  lang: "ko" | "en";
  templateSlug?: string;
  audioTrackId?: string;
}

function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]?.startsWith("--")) m.set(argv[i]!.slice(2), argv[++i] ?? "");
  }
  return {
    runId: m.get("run-id") ?? "",
    videoR2Key: m.get("video-r2-key") ?? "",
    coverR2Key: m.get("cover-r2-key"),
    caption: m.get("caption") ?? "",
    lang: (m.get("lang") ?? "ko") as "ko" | "en",
    templateSlug: m.get("template-slug"),
    audioTrackId: m.get("audio-track-id"),
  };
}

async function publishReel(args: Args): Promise<void> {
  const igUserId = process.env.IG_USER_ID;
  const accountId = process.env.IG_ACCOUNT_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !accountId || !token) {
    throw new Error("missing IG_USER_ID / IG_ACCOUNT_ID / IG_ACCESS_TOKEN");
  }

  const videoUrl = publicUrl(args.videoR2Key);
  const coverUrl = args.coverR2Key ? publicUrl(args.coverR2Key) : undefined;

  const { post } = await api.recordPost({
    runId: args.runId,
    accountId,
    templateSlug: args.templateSlug,
    platform: "instagram",
    mediaType: "reel",
    caption: args.caption,
    lang: args.lang,
    assetKeys: [args.videoR2Key, ...(args.coverR2Key ? [args.coverR2Key] : [])],
    audioTrackId: args.audioTrackId,
  });

  try {
    const params = new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption: args.caption,
      share_to_feed: "true",
      access_token: token,
    });
    if (coverUrl) params.set("cover_url", coverUrl);

    const create = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: "POST",
      body: params,
    }).then(jsonOrThrow) as { id: string };

    await pollContainer(create.id, token);

    const publish = await fetch(
      `${GRAPH}/${igUserId}/media_publish?creation_id=${create.id}&access_token=${token}`,
      { method: "POST" },
    ).then(jsonOrThrow) as { id: string };

    const detail = await fetch(
      `${GRAPH}/${publish.id}?fields=permalink&access_token=${token}`,
    ).then(jsonOrThrow) as { permalink: string };

    await api.updatePost({
      id: post.id,
      remoteId: publish.id,
      permalink: detail.permalink,
      status: "published",
      publishedAt: Date.now(),
    });

    console.log(JSON.stringify({ postId: post.id, remoteId: publish.id, permalink: detail.permalink }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await api.updatePost({ id: post.id, status: "failed", errorMessage: msg.slice(0, 500) });
    throw e;
  }
}

async function pollContainer(creationId: string, token: string): Promise<void> {
  const deadline = Date.now() + 5 * 60 * 1000;
  let delay = 4000;
  while (Date.now() < deadline) {
    const status = await fetch(
      `${GRAPH}/${creationId}?fields=status_code&access_token=${token}`,
    ).then(jsonOrThrow) as { status_code: string };
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`IG container ${creationId} status=${status.status_code}`);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 20000);
  }
  throw new Error(`IG container ${creationId} did not finish within 5 min`);
}

async function jsonOrThrow(r: Response): Promise<unknown> {
  const text = await r.text();
  if (!r.ok) throw new Error(`IG API ${r.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

const cmd = process.argv[2];
const argv = process.argv.slice(3);

if (cmd === "publish-reel") {
  publishReel(parseArgs(argv)).catch((e) => {
    console.error(e instanceof Error ? e.stack : String(e));
    process.exit(1);
  });
} else {
  console.error("usage: bun src/sandbox/ig.ts publish-reel --run-id ... --video-r2-key ... --caption ... --lang ko [--audio-track-id ...] [--template-slug ...] [--cover-r2-key ...]");
  process.exit(2);
}
