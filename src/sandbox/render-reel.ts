// render-reel.ts — bundle Remotion, render to MP4, extract cover, upload to R2.
//
// CLI:
//   bun src/sandbox/render-reel.ts \
//     --run-id <runId> \
//     --composition CardNews \
//     --brief data/runs/<runId>/brief.json \
//     [--audio-url <publicUrl>] \
//     [--audio-attribution "..."] \
//     [--out-dir data/runs/<runId>] \
//     [--duration-sec 18] \
//     [--accent "#facc15"]              # template.accentColor — tints kicker / progress / brand

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { uploadFile } from "./upload";
import { api } from "./lib/api";

interface Args {
  runId: string;
  composition: string;
  briefPath: string;
  audioUrl?: string;
  audioAttribution?: string;
  outDir: string;
  durationSec: number;
  accent?: string;
}

function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]?.startsWith("--")) m.set(argv[i]!.slice(2), argv[++i] ?? "");
  }
  const runId = m.get("run-id") ?? "";
  const accentRaw = m.get("accent")?.trim();
  return {
    runId,
    composition: m.get("composition") ?? "CardNews",
    briefPath: m.get("brief") ?? `data/runs/${runId}/brief.json`,
    audioUrl: m.get("audio-url"),
    audioAttribution: m.get("audio-attribution"),
    outDir: m.get("out-dir") ?? `data/runs/${runId}`,
    durationSec: Number(m.get("duration-sec") ?? "18"),
    accent: accentRaw && accentRaw.length > 0 ? accentRaw : undefined,
  };
}

interface CardBrief {
  brand: { handle: string; name: string };
  lang: "ko" | "en";
  reel?: {
    slides: Array<{ kicker?: string; headline: string; body?: string; emphasis?: string; bgImageR2Key?: string;
      attribution?: string; stat?: { value: string; label?: string; suffix?: string } }>;
  };
  // Video reel (SeedanceReel composition)
  video?: {
    scenes: Array<{
      kicker?: string;
      chapter?: string;
      headline?: string;
      body?: string;
      stat?: { value: string; label?: string; suffix?: string };
      durationSec?: number;
      videoR2Key?: string;
    }>;
    accent?: string;
  };
}

const VIDEO_COMPOSITIONS = new Set(["SeedanceReel"]);

async function main(args: Args): Promise<void> {
  if (!args.runId) throw new Error("--run-id required");
  mkdirSync(args.outDir, { recursive: true });

  const brief = JSON.parse(readFileSync(args.briefPath, "utf8")) as CardBrief;
  const isVideo = VIDEO_COMPOSITIONS.has(args.composition);

  const inputProps = isVideo
    ? buildVideoProps(brief, args)
    : buildCardProps(brief, args);

  if (isVideo && (!brief.video?.scenes?.length)) {
    throw new Error(`composition ${args.composition} requires brief.video.scenes[]`);
  }

  const serveUrl = await bundle({
    entryPoint: "src/remotion/Root.tsx",
    webpackOverride: (c) => c,
  });

  const composition = await selectComposition({
    serveUrl,
    id: args.composition,
    inputProps,
  });

  const reelPath = join(args.outDir, "reel.mp4");
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: reelPath,
    inputProps,
    pixelFormat: "yuv420p",
    crf: 20,
    audioCodec: "aac",
    enforceAudioTrack: true,
    chromiumOptions: { gl: "swiftshader" },
  });

  const coverPath = join(args.outDir, "cover.jpg");
  await renderStill({
    serveUrl,
    composition,
    output: coverPath,
    inputProps,
    imageFormat: "jpeg",
    jpegQuality: 88,
    frame: 12,
  });

  // Re-mux to ensure +faststart so IG can stream-fetch metadata.
  // If ffmpeg is missing or fails, fall back to the unmodified reel.
  const fixedPath = join(args.outDir, "reel.fixed.mp4");
  const ff = spawnSync("ffmpeg", [
    "-y", "-i", reelPath,
    "-c", "copy",
    "-movflags", "+faststart",
    "-metadata:s:v", "rotate=0",
    fixedPath,
  ], { stdio: "inherit" });
  const finalReel = ff.status === 0 && existsSync(fixedPath) ? fixedPath : reelPath;
  const reelKey = `runs/${args.runId}/reel.mp4`;
  const coverKey = `runs/${args.runId}/cover.jpg`;

  const reelUp = await uploadFile(finalReel, reelKey);
  const coverUp = await uploadFile(coverPath, coverKey);

  const reelAsset = await api.recordAsset({
    runId: args.runId,
    kind: "reel-mp4",
    r2Key: reelKey,
    mime: reelUp.mime,
    bytes: reelUp.bytes,
    meta: { composition: args.composition, durationSec: args.durationSec },
  });
  const coverAsset = await api.recordAsset({
    runId: args.runId,
    kind: "thumb",
    r2Key: coverKey,
    mime: coverUp.mime,
    bytes: coverUp.bytes,
  });

  console.log(JSON.stringify({
    reel: { r2Key: reelKey, url: reelUp.url, assetId: reelAsset.asset.id },
    cover: { r2Key: coverKey, url: coverUp.url, assetId: coverAsset.asset.id },
  }));
}

function buildCardProps(brief: CardBrief, args: Args) {
  const slides = brief.reel?.slides ?? [];
  return {
    brand: brief.brand,
    lang: brief.lang,
    accent: args.accent,
    slides: slides.map((s) => ({
      kicker: s.kicker,
      headline: s.headline,
      body: s.body,
      emphasis: s.emphasis,
      attribution: s.attribution,
      stat: s.stat,
      bgImageUrl: s.bgImageR2Key ? `${process.env.R2_PUBLIC_BASE}/${s.bgImageR2Key}` : undefined,
    })),
    audioUrl: args.audioUrl,
    attribution: args.audioAttribution,
  };
}

function buildVideoProps(brief: CardBrief, args: Args) {
  const scenes = brief.video?.scenes ?? [];
  return {
    brand: brief.brand,
    lang: brief.lang,
    accent: args.accent ?? brief.video?.accent,
    scenes: scenes.map((s) => ({
      kicker: s.kicker,
      chapter: s.chapter,
      headline: s.headline,
      body: s.body,
      stat: s.stat,
      durationSec: s.durationSec,
      videoR2Key: s.videoR2Key,
      videoUrl: s.videoR2Key ? `${process.env.R2_PUBLIC_BASE}/${s.videoR2Key}` : undefined,
    })),
    audioUrl: args.audioUrl,
    attribution: args.audioAttribution,
  };
}

main(parseArgs(process.argv.slice(2))).catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
