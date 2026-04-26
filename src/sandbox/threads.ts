// threads.ts — Threads publishing via graph.threads.net v1.0.
//
// CLI:
//   bun src/sandbox/threads.ts publish \
//     --run-id <runId> \
//     --image-r2-key runs/<runId>/threads.jpg \
//     --text "..." \
//     --lang ko

import { api } from "./lib/api";
import { publicUrl } from "./upload";

const GRAPH = "https://graph.threads.net/v1.0";

interface Args {
  runId: string;
  imageR2Key?: string;
  text: string;
  lang: "ko" | "en";
  audioTrackId?: string;
  templateSlug?: string;
}

function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]?.startsWith("--")) m.set(argv[i]!.slice(2), argv[++i] ?? "");
  }
  return {
    runId: m.get("run-id") ?? "",
    imageR2Key: m.get("image-r2-key"),
    text: m.get("text") ?? "",
    lang: (m.get("lang") ?? "ko") as "ko" | "en",
    audioTrackId: m.get("audio-track-id"),
    templateSlug: m.get("template-slug"),
  };
}

async function publish(args: Args): Promise<void> {
  const userId = process.env.THREADS_USER_ID;
  const accountId = process.env.THREADS_ACCOUNT_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  if (!userId || !accountId || !token) {
    throw new Error("missing THREADS_USER_ID / THREADS_ACCOUNT_ID / THREADS_ACCESS_TOKEN");
  }

  const imageUrl = args.imageR2Key ? publicUrl(args.imageR2Key) : undefined;

  const { post } = await api.recordPost({
    runId: args.runId,
    accountId,
    templateSlug: args.templateSlug,
    platform: "threads",
    mediaType: imageUrl ? "photo" : "text",
    caption: args.text,
    lang: args.lang,
    assetKeys: args.imageR2Key ? [args.imageR2Key] : [],
    audioTrackId: args.audioTrackId,
  });

  try {
    const params = new URLSearchParams({
      media_type: imageUrl ? "IMAGE" : "TEXT",
      text: args.text,
      access_token: token,
    });
    if (imageUrl) params.set("image_url", imageUrl);

    const create = await fetch(`${GRAPH}/${userId}/threads`, {
      method: "POST",
      body: params,
    }).then(jsonOrThrow) as { id: string };

    // Threads recommends ~30s before publish for media containers.
    if (imageUrl) await new Promise((r) => setTimeout(r, 30000));

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
  console.error("usage: bun src/sandbox/threads.ts publish --run-id ... --text ... --image-r2-key ... --lang ko [--audio-track-id ...] [--template-slug ...]");
  process.exit(2);
}
