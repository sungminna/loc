// Local MP4 verification — renders one composition end-to-end through
// the same renderMedia call render-reel.ts uses, but without R2 upload
// or internal-API hooks. Confirms codec / fps / pixel-format / CRF land
// correctly and the file plays.
//
// Usage:
//   bun scripts/qa-render-mp4.ts            # default: Aurora finance brief
//   bun scripts/qa-render-mp4.ts Kinetic    # render a specific comp

import { mkdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import type { CardSlideProps } from "../src/remotion/types";

const OUT = resolve("qa/mp4");
mkdirSync(OUT, { recursive: true });

// Public CC0 audio for the BGM mux check. SoundHelix #1 has been a
// standard Remotion test track for years; if it 404s, the brief still
// renders (the Audio element guards on `audioUrl ? ... : null`).
const TEST_BGM = process.env.QA_AUDIO_URL ?? "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

// One realistic 5-slide Korean brief — short enough to keep render time
// under a minute, long enough that motion (entrance, rest, exit, marquee
// loops) gets exercised across multiple slides.
const BRIEF: CardSlideProps = {
  brand: { handle: "@dossier.fin", name: "Dossier · Fin" },
  lang: "ko",
  audioUrl: TEST_BGM,
  attribution: 'Music: SoundHelix #1 (test)',
  slides: [
    { kicker: "FILE 07.A", headline: "관찰 보고서", body: "한 분기를 가로지른 미세 변화의 기록.", bgImageUrl: "https://picsum.photos/id/180/1080/1920", stat: { value: "37.5665", label: "LAT" } },
    { kicker: "FILE 07.B", headline: "표본 단면", body: "32건 중 28건이 같은 방향을 가리켰다.", stat: { value: "39.2조", label: "신용잔고" } },
    { kicker: "FILE 07.C", headline: "교차 검증", body: "단일 지표로는 약한 신호도 세 축으로 보면 분명해진다.", bgImageUrl: "https://picsum.photos/id/20/1080/1920" },
    { kicker: "FILE 07.D", headline: "다음 측정", body: "다음 호 발행: 2026-05-23." },
    { kicker: "ARCHIVE", headline: "정리하기", emphasis: "☉" },
  ],
};

const compId = process.argv[2] ?? "Dossier";

console.log(`→ bundling Remotion (composition: ${compId})…`);
const serveUrl = await bundle({
  entryPoint: resolve("src/remotion/Root.tsx"),
  webpackOverride: (c) => c,
});
console.log("✓ bundled.");

const composition = await selectComposition({
  serveUrl,
  id: compId,
  inputProps: BRIEF as unknown as Record<string, unknown>,
});

console.log(`→ ${compId}: ${composition.width}×${composition.height} @ ${composition.fps}fps, ${composition.durationInFrames} frames (${(composition.durationInFrames / composition.fps).toFixed(1)}s)`);

const out = join(OUT, `${compId}.mp4`);
const t0 = Date.now();
await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  outputLocation: out,
  inputProps: BRIEF as unknown as Record<string, unknown>,
  pixelFormat: "yuv420p",
  crf: 20,
  // Mirror render-reel.ts so this QA pass uses the production audio
  // settings — IG Reels accepts AAC LC stereo.
  audioCodec: "aac",
  enforceAudioTrack: true,
  chromiumOptions: { gl: "swiftshader" },
});
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const sizeMb = (statSync(out).size / 1024 / 1024).toFixed(2);
console.log(`✓ rendered ${out} (${sizeMb} MB in ${elapsed}s)`);

// Verify metadata via ffprobe so we can confirm 1080×1920 / 30fps / yuv420p.
const probe = spawnSync("ffprobe", [
  "-v", "error",
  "-select_streams", "v:0",
  "-show_entries", "stream=width,height,r_frame_rate,pix_fmt,codec_name,duration",
  "-of", "default=noprint_wrappers=1",
  out,
], { encoding: "utf-8" });
if (probe.status === 0) {
  console.log("\n→ ffprobe video stream:");
  console.log(probe.stdout.trim().split("\n").map((l) => "  " + l).join("\n"));
} else {
  console.log("(ffprobe unavailable; skipping metadata check)");
}
