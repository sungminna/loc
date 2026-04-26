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
//     [--duration-sec 18]

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
}

function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]?.startsWith("--")) m.set(argv[i]!.slice(2), argv[++i] ?? "");
  }
  const runId = m.get("run-id") ?? "";
  return {
    runId,
    composition: m.get("composition") ?? "CardNews",
    briefPath: m.get("brief") ?? `data/runs/${runId}/brief.json`,
    audioUrl: m.get("audio-url"),
    audioAttribution: m.get("audio-attribution"),
    outDir: m.get("out-dir") ?? `data/runs/${runId}`,
    durationSec: Number(m.get("duration-sec") ?? "18"),
  };
}

interface Brief {
  brand: { handle: string; name: string };
  lang: "ko" | "en";
  reel: {
    slides: Array<{ kicker?: string; headline: string; body?: string; emphasis?: string; bgImageR2Key?: string }>;
  };
}

async function main(args: Args): Promise<void> {
  if (!args.runId) throw new Error("--run-id required");
  mkdirSync(args.outDir, { recursive: true });

  const brief = JSON.parse(readFileSync(args.briefPath, "utf8")) as Brief;

  const inputProps = {
    brand: brief.brand,
    lang: brief.lang,
    slides: brief.reel.slides.map((s) => ({
      kicker: s.kicker,
      headline: s.headline,
      body: s.body,
      emphasis: s.emphasis,
      bgImageUrl: s.bgImageR2Key ? `${process.env.R2_PUBLIC_BASE}/${s.bgImageR2Key}` : undefined,
    })),
    audioUrl: args.audioUrl,
    attribution: args.audioAttribution,
  };

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

main(parseArgs(process.argv.slice(2))).catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
