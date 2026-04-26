// video-gen.ts — generate videos via Replicate (bytedance/seedance-2.0).
//
// Seedance 2.0 is multimodal: text-to-video, image-to-video (first/last
// frame), reference images for character consistency, reference videos for
// motion transfer, reference audios for lip-sync. We expose every input
// the model accepts.
//
// CLI:
//   bun src/sandbox/video-gen.ts gen \
//     --prompt "..." \                        # required
//     --aspect-ratio 9:16 \                   # 16:9|4:3|1:1|3:4|9:16|21:9|adaptive
//     --resolution 720p \                     # 480p | 720p
//     --duration 5 \                          # int seconds, or -1 for adaptive
//     --generate-audio true \                 # boolean
//     --seed 123 \                            # optional, for reproducibility
//     --image https://... \                   # first-frame image URL
//     --last-frame-image https://... \        # last-frame image URL (needs --image)
//     --reference-image https://... \         # repeatable, up to 9 (mutually exclusive with --image)
//     --reference-video https://... \         # repeatable, up to 3
//     --reference-audio https://... \         # repeatable, up to 3 (needs ref image/video)
//     --out-dir data/runs/<runId>/video \
//     --run-id <runId> \
//     --kind seedance-mp4                     # asset.kind (default seedance-mp4)
//
// Stdout: NDJSON, one line: { assetId, r2Key, url, localPath, mime, bytes, predictionId }

import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { uploadFile } from "./upload";
import { api } from "./lib/api";

const REPLICATE_BASE = "https://api.replicate.com/v1";
const MODEL = "bytedance/seedance-2.0";

type Aspect = "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive";
type Resolution = "480p" | "720p";

interface Args {
  prompt: string;
  aspectRatio: Aspect;
  resolution: Resolution;
  duration: number;        // seconds, -1 = adaptive
  generateAudio: boolean;
  seed?: number;
  image?: string;
  lastFrameImage?: string;
  referenceImages: string[];
  referenceVideos: string[];
  referenceAudios: string[];
  outDir: string;
  runId: string;
  kind: "seedance-mp4" | "reel-mp4";
  sceneIndex?: number;
}

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  const referenceImages: string[] = [];
  const referenceVideos: string[] = [];
  const referenceAudios: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k?.startsWith("--")) continue;
    const v = argv[++i] ?? "";
    if (k === "--reference-image") referenceImages.push(v);
    else if (k === "--reference-video") referenceVideos.push(v);
    else if (k === "--reference-audio") referenceAudios.push(v);
    else map.set(k.slice(2), v);
  }
  const dur = map.get("duration");
  return {
    prompt: map.get("prompt") ?? "",
    aspectRatio: ((map.get("aspect-ratio") ?? "9:16") as Aspect),
    resolution: ((map.get("resolution") ?? "720p") as Resolution),
    duration: dur === undefined ? 5 : Number(dur),
    generateAudio: parseBool(map.get("generate-audio"), true),
    seed: map.get("seed") ? Number(map.get("seed")) : undefined,
    image: map.get("image") || undefined,
    lastFrameImage: map.get("last-frame-image") || undefined,
    referenceImages: referenceImages.slice(0, 9),
    referenceVideos: referenceVideos.slice(0, 3),
    referenceAudios: referenceAudios.slice(0, 3),
    outDir: map.get("out-dir") ?? "/tmp/video-gen",
    runId: map.get("run-id") ?? "",
    kind: ((map.get("kind") ?? "seedance-mp4") as Args["kind"]),
    sceneIndex: map.get("scene-index") ? Number(map.get("scene-index")) : undefined,
  };
}

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === "") return fallback;
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  // Seedance 2.0 returns a single string (URI), not an array.
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
}

function validateInputs(args: Args): void {
  if (!args.prompt) throw new Error("--prompt required");
  if (!args.runId) throw new Error("--run-id required");

  // first/last frame mode is mutually exclusive with reference images.
  if ((args.image || args.lastFrameImage) && args.referenceImages.length > 0) {
    throw new Error("--image / --last-frame-image cannot be combined with --reference-image");
  }
  if (args.lastFrameImage && !args.image) {
    throw new Error("--last-frame-image requires --image (first frame)");
  }
  if (args.referenceAudios.length > 0 && args.referenceImages.length === 0 && args.referenceVideos.length === 0 && !args.image) {
    throw new Error("--reference-audio requires at least one reference image, reference video, or --image");
  }
  if (!Number.isInteger(args.duration) && args.duration !== -1) {
    throw new Error("--duration must be an integer (or -1 for adaptive)");
  }
}

async function generate(args: Args): Promise<void> {
  validateInputs(args);

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error("REPLICATE_API_TOKEN not set — skipping video generation");
    process.exit(0);
  }

  mkdirSync(args.outDir, { recursive: true });

  // Build input following Seedance 2.0's exact param names.
  const input: Record<string, unknown> = {
    prompt: args.prompt,
    aspect_ratio: args.aspectRatio,
    resolution: args.resolution,
    duration: args.duration,
    generate_audio: args.generateAudio,
  };
  if (typeof args.seed === "number" && Number.isFinite(args.seed)) input.seed = args.seed;
  if (args.image) input.image = args.image;
  if (args.lastFrameImage) input.last_frame_image = args.lastFrameImage;
  if (args.referenceImages.length > 0) input.reference_images = args.referenceImages;
  if (args.referenceVideos.length > 0) input.reference_videos = args.referenceVideos;
  if (args.referenceAudios.length > 0) input.reference_audios = args.referenceAudios;

  // Sync via Prefer: wait — Seedance 2.0 typically returns within 60-180s
  // for 5-8s clips. The header just makes Replicate stream the response
  // when ready instead of returning starting/processing immediately.
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

  // Poll up to 10 minutes. Seedance 2.0 with 9 ref-images + audio can
  // legitimately take 4-5 minutes on warm capacity.
  const deadline = Date.now() + 10 * 60 * 1000;
  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed" &&
    prediction.status !== "canceled" &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollUrl = prediction.urls?.get ?? `${REPLICATE_BASE}/predictions/${prediction.id}`;
    const pollRes = await fetch(pollUrl, { headers: { authorization: `Bearer ${token}` } });
    if (!pollRes.ok) throw new Error(`Replicate poll ${pollRes.status}: ${(await pollRes.text()).slice(0, 200)}`);
    prediction = (await pollRes.json()) as ReplicatePrediction;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate prediction ${prediction.id} ended ${prediction.status}: ${prediction.error ?? ""}`);
  }
  const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!outputUrl) throw new Error(`Replicate prediction ${prediction.id} returned no output`);

  // Download MP4
  const dl = await fetch(outputUrl);
  if (!dl.ok) throw new Error(`download ${outputUrl} → ${dl.status}`);
  const bytes = Buffer.from(await dl.arrayBuffer());
  const fileName = args.sceneIndex !== undefined
    ? `${args.kind}-scene-${args.sceneIndex.toString().padStart(2, "0")}.mp4`
    : `${args.kind}-${prediction.id.slice(0, 8)}.mp4`;
  const localPath = join(args.outDir, fileName);
  writeFileSync(localPath, bytes);

  const r2Key = `runs/${args.runId}/${args.kind}/${fileName}`;
  const { url: pubUrl, bytes: size, mime } = await uploadFile(localPath, r2Key);
  const localBytes = statSync(localPath).size;

  const { asset } = await api.recordAsset({
    runId: args.runId,
    kind: args.kind,
    r2Key,
    mime,
    bytes: size || localBytes,
    meta: {
      provider: "replicate",
      model: MODEL,
      prediction_id: prediction.id,
      input,
    },
  });

  console.log(JSON.stringify({
    assetId: asset.id,
    r2Key,
    url: pubUrl,
    localPath,
    bytes: size || localBytes,
    mime,
    predictionId: prediction.id,
    sceneIndex: args.sceneIndex,
  }));
}

const cmd = process.argv[2];
const argv = process.argv.slice(3);

if (cmd === "gen") {
  generate(parseArgs(argv)).catch((e) => {
    console.error(e instanceof Error ? e.stack : String(e));
    process.exit(1);
  });
} else {
  console.error(`usage: bun src/sandbox/video-gen.ts gen --prompt ... [...flags] --out-dir ... --run-id ...

Required:
  --prompt              video prompt (use double-quoted dialogue for lip-sync)
  --run-id              run id
  --out-dir             local output directory

Seedance 2.0 inputs:
  --aspect-ratio        16:9 | 4:3 | 1:1 | 3:4 | 9:16 | 21:9 | adaptive  (default: 9:16)
  --resolution          480p | 720p                                       (default: 720p)
  --duration            int seconds, or -1 for adaptive                   (default: 5)
  --generate-audio      true | false                                      (default: true)
  --seed                int, for reproducibility                          (default: omitted)

Image-to-video (mutually exclusive with --reference-image):
  --image               first-frame image URL
  --last-frame-image    last-frame image URL (needs --image)

Multimodal references (label them in the prompt as [Image1], [Video1], [Audio1]):
  --reference-image     up to 9, repeatable
  --reference-video     up to 3, total ≤15s, repeatable
  --reference-audio     up to 3, total ≤15s, repeatable; needs at least 1 ref image/video or --image

Asset metadata:
  --kind                seedance-mp4 | reel-mp4         (default: seedance-mp4)
  --scene-index         int, names the file scene-NN.mp4 (optional)
`);
  process.exit(2);
}
