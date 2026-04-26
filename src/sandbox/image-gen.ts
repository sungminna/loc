// image-gen.ts — generate images via Replicate (openai/gpt-image-2).
//
// CLI:
//   bun src/sandbox/image-gen.ts gen \
//     --prompt "..."  \
//     --aspect 2:3 \                     # 1:1 | 3:2 | 2:3 (model-supported set)
//     --count 1 \                        # 1-10
//     --quality auto \                   # low | medium | high | auto
//     --output-format webp \             # webp | png | jpeg
//     --output-compression 90 \          # 0-100
//     --background auto \                # auto | opaque
//     --moderation auto \                # auto | low
//     --input-image https://... \        # repeatable; reference/edit
//     --user-id <userId> \
//     --out-dir data/runs/<runId>/img \
//     --run-id <runId> \
//     --kind image-bg                    # asset.kind enum: image-bg|thumb|threads-jpg|video-frame
//
// Stdout: NDJSON, one line per image: { assetId, r2Key, url, localPath, mime, bytes }

import { mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { uploadFile } from "./upload";
import { api } from "./lib/api";

const REPLICATE_BASE = "https://api.replicate.com/v1";
const MODEL = "openai/gpt-image-2";

interface Args {
  prompt: string;
  aspect: "1:1" | "3:2" | "2:3";
  count: number;
  quality: "low" | "medium" | "high" | "auto";
  outputFormat: "webp" | "png" | "jpeg";
  outputCompression: number;
  background: "auto" | "opaque";
  moderation: "auto" | "low";
  inputImages: string[];
  userId: string | undefined;
  outDir: string;
  runId: string;
  kind: "image-bg" | "thumb" | "threads-jpg" | "video-frame";
}

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  const inputImages: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k?.startsWith("--")) continue;
    const v = argv[++i] ?? "";
    if (k === "--input-image") inputImages.push(v);
    else map.set(k.slice(2), v);
  }
  return {
    prompt: map.get("prompt") ?? "",
    aspect: ((map.get("aspect") ?? "2:3") as Args["aspect"]),
    count: Math.max(1, Math.min(10, Number(map.get("count") ?? "1"))),
    quality: ((map.get("quality") ?? "auto") as Args["quality"]),
    outputFormat: ((map.get("output-format") ?? "webp") as Args["outputFormat"]),
    outputCompression: Math.max(0, Math.min(100, Number(map.get("output-compression") ?? "90"))),
    background: ((map.get("background") ?? "auto") as Args["background"]),
    moderation: ((map.get("moderation") ?? "auto") as Args["moderation"]),
    inputImages,
    userId: map.get("user-id"),
    outDir: map.get("out-dir") ?? "/tmp/image-gen",
    runId: map.get("run-id") ?? "",
    kind: ((map.get("kind") ?? "image-bg") as Args["kind"]),
  };
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string[];
  error?: string | null;
  urls?: { get?: string };
}

async function generate(args: Args): Promise<void> {
  if (!args.prompt) throw new Error("--prompt required");
  if (!args.runId) throw new Error("--run-id required");

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error("REPLICATE_API_TOKEN not set — skipping image generation");
    process.exit(0);
  }

  mkdirSync(args.outDir, { recursive: true });

  const input: Record<string, unknown> = {
    prompt: args.prompt,
    aspect_ratio: args.aspect,
    number_of_images: args.count,
    quality: args.quality,
    output_format: args.outputFormat,
    output_compression: args.outputCompression,
    background: args.background,
    moderation: args.moderation,
  };
  if (args.inputImages.length > 0) input.input_images = args.inputImages;
  if (args.userId) input.user_id = args.userId;

  // Sync mode via Prefer: wait — model usually returns within 30-60s.
  const startRes = await fetch(`${REPLICATE_BASE}/models/${MODEL}/predictions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      prefer: "wait=60",
    },
    body: JSON.stringify({ input }),
  });
  const startText = await startRes.text();
  if (!startRes.ok) throw new Error(`Replicate ${startRes.status}: ${startText.slice(0, 500)}`);
  let prediction = JSON.parse(startText) as ReplicatePrediction;

  // If still processing, poll up to ~5 min.
  const deadline = Date.now() + 5 * 60 * 1000;
  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed" &&
    prediction.status !== "canceled" &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, 2500));
    const pollUrl = prediction.urls?.get ?? `${REPLICATE_BASE}/predictions/${prediction.id}`;
    const pollRes = await fetch(pollUrl, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!pollRes.ok) throw new Error(`Replicate poll ${pollRes.status}: ${(await pollRes.text()).slice(0, 200)}`);
    prediction = (await pollRes.json()) as ReplicatePrediction;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate prediction ${prediction.id} ended ${prediction.status}: ${prediction.error ?? ""}`);
  }
  if (!prediction.output || prediction.output.length === 0) {
    throw new Error(`Replicate prediction ${prediction.id} returned no output`);
  }

  for (let i = 0; i < prediction.output.length; i++) {
    const url = prediction.output[i]!;
    const dl = await fetch(url);
    if (!dl.ok) throw new Error(`download ${url} → ${dl.status}`);
    const bytes = Buffer.from(await dl.arrayBuffer());

    const ext = extFromUrl(url, args.outputFormat);
    const fileName = `${args.kind}-${i.toString().padStart(2, "0")}.${ext}`;
    const localPath = join(args.outDir, fileName);
    writeFileSync(localPath, bytes);

    const r2Key = `runs/${args.runId}/${args.kind}/${fileName}`;
    const { url: pubUrl, bytes: size, mime } = await uploadFile(localPath, r2Key);

    const { asset } = await api.recordAsset({
      runId: args.runId,
      kind: args.kind,
      r2Key,
      mime,
      bytes: size,
      meta: {
        provider: "replicate",
        model: MODEL,
        aspect: args.aspect,
        quality: args.quality,
        prompt: args.prompt,
        prediction_id: prediction.id,
      },
    });

    console.log(JSON.stringify({ assetId: asset.id, r2Key, url: pubUrl, localPath, bytes: size, mime }));
  }
}

function extFromUrl(url: string, fallback: string): string {
  const m = extname(new URL(url).pathname).slice(1).toLowerCase();
  return m || fallback;
}

const cmd = process.argv[2];
const argv = process.argv.slice(3);

if (cmd === "gen") {
  generate(parseArgs(argv)).catch((e) => {
    console.error(e instanceof Error ? e.stack : String(e));
    process.exit(1);
  });
} else {
  console.error(`usage: bun src/sandbox/image-gen.ts gen --prompt ... --aspect 2:3 [...flags] --out-dir ... --run-id ... --kind image-bg

Flags (all optional except --prompt, --run-id, --out-dir):
  --aspect              1:1 | 3:2 | 2:3              (default: 2:3)
  --count               1-10                          (default: 1)
  --quality             low | medium | high | auto    (default: auto)
  --output-format       webp | png | jpeg             (default: webp)
  --output-compression  0-100                         (default: 90)
  --background          auto | opaque                 (default: auto)
  --moderation          auto | low                    (default: auto)
  --input-image <url>   reference image (repeatable)
  --user-id <id>        OpenAI user_id for abuse tracking
  --kind                image-bg | thumb | threads-jpg | video-frame  (asset.kind, default: image-bg)
`);
  process.exit(2);
}
