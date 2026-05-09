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

import { defaultAuroraProps } from "../src/remotion/compositions/Aurora";
import { defaultGummyProps } from "../src/remotion/compositions/Gummy";
import { defaultZineProps } from "../src/remotion/compositions/Zine";
import { defaultKineticProps } from "../src/remotion/compositions/Kinetic";
import { defaultDossierProps } from "../src/remotion/compositions/Dossier";
import { defaultThreadsCardProps } from "../src/remotion/compositions/ThreadsCard";

const OUT = resolve("review");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Per-composition stills. Frame numbers chosen to land mid-slide for
// each of the first 3-4 slides — that's where typography is fully resolved.
const SLIDE_FRAMES = {
  Aurora: 168, Gummy: 156, Zine: 156, Kinetic: 156, Dossier: 162,
};

const longKR = "이번 분기 외국인은 매도, 신용잔고는 39.2조 8주 연속 증가";
// A safe-to-fetch CC0 placeholder used to stress-test BgImage modes per
// template — slides intentionally mix WITH and WITHOUT bgImageUrl so we
// verify the redesign rule: "image is fixed scenery; pages without an
// image still look complete in the template's design system".
const TEST_BG = "https://picsum.photos/id/1043/1080/1920";
const overflowProps = {
  Aurora: {
    ...defaultAuroraProps,
    slides: [
      { kicker: "AURORA · 01", headline: longKR, body: "기관 자금 4.8배 증가, 같은 분기 외국인 매도와 동시에 일어난 건 2020년 3월 이후 처음. 이번 주 코스피 1.7% 빠지면 신용 매물이 풀린다.", bgImageUrl: TEST_BG },
      { kicker: "DRIFT", headline: "짧은 헤드", body: "짧음." },
      { kicker: "DEPTH", headline: "오늘 시도", body: "1분 안에 끝나는 것 한 가지." },
    ],
  },
  Gummy: {
    ...defaultGummyProps,
    slides: [
      { kicker: "GUMMY", headline: longKR, body: "긴 헤드라인이 들어왔을 때 헤드라인 카드가 자동으로 작아진다.", bgImageUrl: TEST_BG },
      { kicker: "FACT", headline: "39.2조", body: "신용잔고 8주 연속 증가.", stat: { value: "39.2조" } },
    ],
  },
  Zine: {
    ...defaultZineProps,
    slides: [
      { kicker: "ZINE №07", headline: "GLUE & CUT & PASTE", body: "한 페이지에 풀로 붙인 콜라주.", bgImageUrl: TEST_BG },
      { kicker: "BREAK", headline: longKR, body: "긴 한국어 헤드라인이 가변 크기로 줄어든다." },
    ],
  },
  Kinetic: {
    ...defaultKineticProps,
    slides: [
      { kicker: "K-01", headline: longKR, body: "긴 헤드라인 자동 축소.", bgImageUrl: TEST_BG },
      { kicker: "DATA", headline: "39.2", body: "신용잔고 (조).", stat: { value: "39.2", label: "신용잔고", suffix: "조" } },
    ],
  },
  Dossier: {
    ...defaultDossierProps,
    slides: [
      { kicker: "FILE 07.A", headline: longKR, body: "한 분기를 가로지른 미세 변화의 기록.", bgImageUrl: TEST_BG, stat: { value: "37.5665", label: "LAT" } },
      { kicker: "FILE 07.B", headline: "단면", body: "짧음." },
    ],
  },
};

const overflow = process.argv[2] === "overflow";
const slideCount = (id: string) => {
  // Read directly from props so frame indices never exceed
  // calculateMetadata's durationInFrames.
  if (id === "ThreadsCard") return 1;
  if (overflow) {
    const p = (overflowProps as Record<string, { slides?: unknown[] }>)[id];
    if (p?.slides) return p.slides.length;
  }
  return 4;
};

const COMPS: Array<{ id: string; props: Record<string, unknown>; framesAt: number[] }> = [
  { id: "Aurora", props: defaultAuroraProps as unknown as Record<string, unknown>, framesAt: framesFor("Aurora", slideCount("Aurora")) },
  { id: "Gummy", props: defaultGummyProps as unknown as Record<string, unknown>, framesAt: framesFor("Gummy", slideCount("Gummy")) },
  { id: "Zine", props: defaultZineProps as unknown as Record<string, unknown>, framesAt: framesFor("Zine", slideCount("Zine")) },
  { id: "Kinetic", props: defaultKineticProps as unknown as Record<string, unknown>, framesAt: framesFor("Kinetic", slideCount("Kinetic")) },
  { id: "Dossier", props: defaultDossierProps as unknown as Record<string, unknown>, framesAt: framesFor("Dossier", slideCount("Dossier")) },
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
