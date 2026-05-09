// QA harness for the 5 card templates + ThreadsCard.
//
// Why this exists separate from visual-review.ts:
//   - Real per-vertical content (essay / trend / quote / AI / finance)
//     so we can judge whether each template handles its actual workload.
//   - Mix of slides WITH and WITHOUT bg images, mix of stat / no-stat,
//     mix of short and long Korean headlines — exactly the variety a
//     production brief generates.
//   - Per-slide frame sampling: early (entrance), mid (resting), late
//     (exit) — so we can audit motion timing and resting legibility.
//
// Output: ./qa/<vertical>/<comp>-s<n>-<phase>.png
//
// Usage:
//   bun scripts/qa-templates.ts

import { mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import type { CardSlideProps } from "../src/remotion/types";
import type { ThreadsCardProps } from "../src/remotion/compositions/ThreadsCard";

const OUT = resolve("qa");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// CC0 placeholder photos. Each vertical gets a backdrop appropriate to
// its register so we can judge legibility on a real busy photograph.
const PIC = (id: number) => `https://picsum.photos/id/${id}/1080/1920`;

// Per-template slide-frame-count (mirrors Root.tsx).
const SLIDE_FRAMES: Record<string, number> = {
  Aurora: 168, Gummy: 156, Zine: 156, Kinetic: 156, Dossier: 162,
};

// ─── Per-vertical real-content briefs ───────────────────────────────
//
// These mirror the prose register the actual content-plan skill produces
// for each vertical (see seed-topics-ko.ts personas). Five slides each:
// hook → fact/observation → data/quote → action → close. Mix in stats,
// images, and at least one image-less slide per deck.

interface QABrief {
  comp: "Aurora" | "Gummy" | "Zine" | "Kinetic" | "Dossier";
  vertical: string;
  props: CardSlideProps;
}

const BRIEFS: QABrief[] = [
  {
    comp: "Aurora",
    vertical: "essay-opinion",
    props: {
      brand: { handle: "@quiet.signals", name: "Quiet Signals" },
      lang: "ko",
      slides: [
        { kicker: "AURORA · 01", headline: "고요한 변화가 가장 멀리 간다", body: "이번 주 가장 눈에 띈 흐름은 사실 어디에도 보도되지 않았다.", bgImageUrl: PIC(1043) },
        { kicker: "OBSERVED", headline: "노이즈가 줄어든 자리", body: "사람들의 관심이 비어 있는 곳에서 패턴이 모습을 드러낸다." },
        { kicker: "DEPTH", headline: "표면 아래의 흐름은 표면의 가격보다 길게 산다", body: "가격은 결과이고 흐름은 원인이다. 결과를 추격하는 사람과 원인을 보는 사람의 시간 단위가 다르다.", bgImageUrl: PIC(1015) },
        { kicker: "QUESTION", headline: "내가 보고 있는 건 신호인가, 잡음인가" },
        { kicker: "CLOSING", headline: "다음 호로 이어집니다", emphasis: "✱" },
      ],
    },
  },
  {
    comp: "Gummy",
    vertical: "mz-trend",
    props: {
      brand: { handle: "@bite.daily", name: "Bite Daily" },
      lang: "ko",
      slides: [
        { kicker: "BITE №14", headline: "이번 주 가장 끈적했던 한 입", body: "달콤한데 묵직했다. 이게 무슨 맛이지?", bgImageUrl: PIC(1080) },
        { kicker: "FACT", headline: "39.2조", body: "신용잔고 8주 연속 증가. 끈적한 유동성.", stat: { value: "39.2조" } },
        { kicker: "MOOD", headline: "젤리처럼 늘어난 시간", body: "일주일이 한 입에 사라졌다." },
        { kicker: "CHEW", headline: "오래 씹어야 보이는 맛", body: "처음 한 입에 다 알 수 있는 콘텐츠는 한 번 보고 끝난다.", bgImageUrl: PIC(1025) },
        { kicker: "BITE END", headline: "다음 한 입에서 만나요", emphasis: "♡" },
      ],
    },
  },
  {
    comp: "Zine",
    vertical: "quote-counter",
    props: {
      brand: { handle: "@cut.paste.zine", name: "Cut · Paste" },
      lang: "ko",
      slides: [
        { kicker: "ZINE №07", headline: "ALL EYES ON THIS", body: "오늘의 카운터컬처. 종이와 풀로 붙인 한 페이지.", bgImageUrl: PIC(1059) },
        { kicker: "BREAK", headline: "관성으로 굴러간 것을 잘라낸다", body: "어제까지 옳았던 것이 오늘도 옳을 이유는 없다." },
        { kicker: "CUT", headline: "잘라낼 것 / 붙일 것", body: "잘라낼 것: 어제의 합의. 붙일 것: 오늘의 의문.", bgImageUrl: PIC(1035) },
        { kicker: "QUOTE", headline: "“의심하지 않는 자에게 답은 없다”", attribution: "— K. 무명" },
        { kicker: "PASTE", headline: "다음 페이지로 풀칠하기" },
      ],
    },
  },
  {
    comp: "Kinetic",
    vertical: "ai-tech",
    props: {
      brand: { handle: "@frontier.kr", name: "Frontier KR" },
      lang: "ko",
      slides: [
        { kicker: "K-01", headline: "BIG TYPE", body: "타이포 그 자체가 디자인이다.", bgImageUrl: PIC(160) },
        { kicker: "DATA", headline: "39.2조", body: "신용잔고 (조).", stat: { value: "39.2", label: "신용잔고", suffix: "조" } },
        { kicker: "MODEL", headline: "맥락이 길수록 답이 짧아진다", body: "긴 컨텍스트는 정답을 좁히지, 넓히지 않는다.", bgImageUrl: PIC(48) },
        { kicker: "LATENCY", headline: "82", body: "ms · 첫 토큰까지의 시간.", stat: { value: "82", label: "first token", suffix: "ms" } },
        { kicker: "END", headline: "다음 페이지", body: "이어서." },
      ],
    },
  },
  {
    comp: "Dossier",
    vertical: "finance-data",
    props: {
      brand: { handle: "@dossier.fin", name: "Dossier · Fin" },
      lang: "ko",
      slides: [
        { kicker: "FILE 07.A", headline: "관찰 보고서", body: "한 분기를 가로지른 미세 변화의 기록.", bgImageUrl: PIC(180), stat: { value: "37.5665", label: "LAT" } },
        { kicker: "FILE 07.B", headline: "표본 단면", body: "32건 중 28건이 같은 방향을 가리켰다.", stat: { value: "39.2조", label: "신용잔고" } },
        { kicker: "FILE 07.C", headline: "교차 검증", body: "단일 지표로는 약한 신호도, 세 축으로 보면 분명해진다.", bgImageUrl: PIC(20) },
        { kicker: "FILE 07.D", headline: "다음 측정", body: "다음 호 발행: 2026-05-23." },
        { kicker: "ARCHIVE", headline: "정리하기", emphasis: "☉" },
      ],
    },
  },
];

const THREADS_TESTS: Array<{ name: string; props: ThreadsCardProps }> = [
  {
    name: "with-image-long",
    props: {
      brand: { handle: "@dossier.fin", name: "Dossier · Fin" },
      lang: "ko",
      kicker: "FILE 07",
      headline: "이번 분기 외국인은 매도, 신용잔고는 39.2조 8주 연속 증가",
      body: "기관 자금 4.8배 증가, 같은 분기 외국인 매도와 동시에 일어난 건 2020년 3월 이후 처음.",
      bgImageUrl: PIC(180),
    },
  },
  {
    name: "no-image-short",
    props: {
      brand: { handle: "@dossier.fin", name: "Dossier · Fin" },
      lang: "ko",
      kicker: "FILE 07",
      headline: "오늘의 한 줄",
      body: "Threads에 어울리는 짧은 문장.",
    },
  },
];

console.log("→ bundling Remotion…");
const serveUrl = await bundle({
  entryPoint: resolve("src/remotion/Root.tsx"),
  webpackOverride: (c) => c,
});
console.log("✓ bundled.");

// Per-slide frame sampling: each slide gets 3 phases.
function phasesFor(comp: string, slideIndex: number): Array<{ phase: string; frame: number }> {
  const f = SLIDE_FRAMES[comp] ?? 156;
  const start = slideIndex * f;
  return [
    { phase: "enter", frame: start + 18 },
    { phase: "rest", frame: start + Math.round(f * 0.55) },
    { phase: "exit", frame: start + f - 12 },
  ];
}

for (const brief of BRIEFS) {
  const dir = join(OUT, brief.vertical);
  mkdirSync(dir, { recursive: true });

  const composition = await selectComposition({
    serveUrl,
    id: brief.comp,
    inputProps: brief.props as unknown as Record<string, unknown>,
  });

  for (let i = 0; i < brief.props.slides.length; i++) {
    for (const { phase, frame } of phasesFor(brief.comp, i)) {
      const out = join(dir, `${brief.comp}-s${String(i + 1).padStart(2, "0")}-${phase}-f${String(frame).padStart(4, "0")}.png`);
      await renderStill({
        serveUrl,
        composition,
        output: out,
        inputProps: brief.props as unknown as Record<string, unknown>,
        imageFormat: "png",
        frame,
        chromiumOptions: { gl: "swiftshader" },
      });
      console.log(`  ✓ ${brief.vertical}/${brief.comp} s${i + 1} ${phase} (f${frame})`);
    }
  }
}

// ThreadsCard (still, frame 0).
const threadsDir = join(OUT, "threads");
mkdirSync(threadsDir, { recursive: true });
for (const t of THREADS_TESTS) {
  const composition = await selectComposition({
    serveUrl,
    id: "ThreadsCard",
    inputProps: t.props as unknown as Record<string, unknown>,
  });
  const out = join(threadsDir, `ThreadsCard-${t.name}.png`);
  await renderStill({
    serveUrl,
    composition,
    output: out,
    inputProps: t.props as unknown as Record<string, unknown>,
    imageFormat: "png",
    frame: 0,
    chromiumOptions: { gl: "swiftshader" },
  });
  console.log(`  ✓ threads/${t.name}`);
}

console.log("\nDone. Open ./qa/**/*.png to inspect.");
