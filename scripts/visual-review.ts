// Visual review — render still PNGs per composition × multiple frames so
// we can eyeball typography, palette, motion-state, and overflow without
// running a full IG round-trip. Output → ./review/ as <comp>-<frame>.png.
//
// Usage:
//   bun scripts/visual-review.ts            # default props
//   bun scripts/visual-review.ts overflow   # extra long-headline cases

import { mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

import { defaultEditorialProps } from "../src/remotion/compositions/Editorial";
import { defaultMonocleProps } from "../src/remotion/compositions/Monocle";
import { defaultRisoProps } from "../src/remotion/compositions/Riso";
import { defaultCoverProps } from "../src/remotion/compositions/Cover";
import { defaultIndex032cProps } from "../src/remotion/compositions/Index032c";
import { defaultThreadsCardProps } from "../src/remotion/compositions/ThreadsCard";

const OUT = resolve("review");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Per-composition stills. Frame numbers chosen to land mid-slide for
// each of the first 3-4 slides — that's where typography is fully resolved.
const SLIDE_FRAMES = {
  Editorial: 156, Monocle: 162, Riso: 156, Cover: 168, Index032c: 150,
};

const longKR = "이번 분기 외국인은 매도, 신용잔고는 39.2조 8주 연속 증가";
const overflowProps = {
  Editorial: {
    ...defaultEditorialProps,
    slides: [
      { kicker: "ISSUE 01", headline: longKR, body: "기관 자금 4.8배 증가, 같은 분기 외국인 매도와 동시에 일어난 건 2020년 3월 이후 처음. 이번 주 코스피 1.7% 빠지면 신용 매물이 풀린다." },
      { kicker: "PERSPECTIVE", headline: "짧은 헤드", body: "짧음." },
      { kicker: "ACTION", headline: "오늘 시도", body: "1분 안에 끝나는 것 한 가지." },
    ],
  },
};

const overflow = process.argv[2] === "overflow";
const slideCount = (id: string) => {
  if (overflow && id === "Editorial") return 3;
  if (id === "Cover") return 4;
  if (id === "ThreadsCard") return 1;
  return 5;
};

const COMPS: Array<{ id: string; props: Record<string, unknown>; framesAt: number[] }> = [
  { id: "Editorial", props: defaultEditorialProps as unknown as Record<string, unknown>, framesAt: framesFor("Editorial", slideCount("Editorial")) },
  { id: "Monocle", props: defaultMonocleProps as unknown as Record<string, unknown>, framesAt: framesFor("Monocle", slideCount("Monocle")) },
  { id: "Riso", props: defaultRisoProps as unknown as Record<string, unknown>, framesAt: framesFor("Riso", slideCount("Riso")) },
  { id: "Cover", props: defaultCoverProps as unknown as Record<string, unknown>, framesAt: framesFor("Cover", slideCount("Cover")) },
  { id: "Index032c", props: defaultIndex032cProps as unknown as Record<string, unknown>, framesAt: framesFor("Index032c", slideCount("Index032c")) },
  { id: "ThreadsCard", props: defaultThreadsCardProps as unknown as Record<string, unknown>, framesAt: [0] },
];

function framesFor(id: keyof typeof SLIDE_FRAMES, slideCount: number): number[] {
  const f = SLIDE_FRAMES[id];
  // mid-slide = slideStart + 80f (after the spring settles). Cap at slideCount.
  return Array.from({ length: slideCount }, (_, i) => i * f + 80);
}

console.log("→ bundling Remotion…");
const serveUrl = await bundle({
  entryPoint: resolve("src/remotion/Root.tsx"),
  webpackOverride: (c) => c,
});
console.log("✓ bundled.");

for (const c of COMPS) {
  const props = overflow && overflowProps[c.id as keyof typeof overflowProps]
    ? overflowProps[c.id as keyof typeof overflowProps]
    : c.props;

  const composition = await selectComposition({
    serveUrl,
    id: c.id,
    inputProps: props as Record<string, unknown>,
  });

  for (const frame of c.framesAt) {
    const out = join(OUT, `${c.id}-f${String(frame).padStart(4, "0")}${overflow ? "-overflow" : ""}.png`);
    await renderStill({
      serveUrl,
      composition,
      output: out,
      inputProps: props as Record<string, unknown>,
      imageFormat: "png",
      frame,
      chromiumOptions: { gl: "swiftshader" },
    });
    console.log(`  ✓ ${out}`);
  }
}

console.log("\nDone. Open ./review/*.png to inspect.");
