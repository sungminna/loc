// Shared layout primitives. The point of this file is the same as a
// magazine's design grid: a small set of decisions (column widths, font
// scales, safe areas) that every composition obeys so the deck reads as
// one publication.
//
// Two things this file is solving for, both came up in production:
//   1. Korean headlines vary 6–34 chars; static `fontSize: 96` overflows
//      at 28 chars and looks tiny at 8. We resolve sizes from char count.
//   2. AI-generated bg images often ship with mediocre tonality; we want
//      one place that knows where the typography zones live so an image
//      never has to compete with text — the image gets a defined frame
//      and the text gets a defined column.

// Reels (1080×1920) UI safe area. Instagram's bottom nav covers ~140px
// of pixels; the top status bar covers ~110. Our layout reserves a 96px
// "page margin" inside that so the live area is 96..(1920-96).
export const PAGE = {
  width: 1080,
  height: 1920,
  marginX: 96,
  // Top safe — clears the top of-frame UI when the post is reshared.
  safeTop: 110,
  // Bottom safe — Reels overlays comments/share/like inside the bottom
  // ~140px. We push everything important above 200 to avoid both.
  safeBottom: 200,
} as const;

// Fit a headline into a target box without clipping. We don't measure the
// rendered width (Remotion runs in a headless Chromium per frame; layout
// effects are unreliable across renders) — instead we use char count as a
// proxy. This is the same approach Pentagram's "Smart Type" article
// recommends when typesetting variable inputs. The mapping is calibrated
// per-composition because each template has a different column width and
// different font weight.
export function fitHeadline(
  text: string,
  opts: { max: number; min: number; pivots?: Array<[chars: number, size: number]>; korean?: boolean },
): number {
  const len = visibleLength(text, opts.korean ?? hasKorean(text));
  const pivots = opts.pivots ?? defaultPivots(opts.max, opts.min);
  // Linear interpolation between adjacent pivots.
  for (let i = 0; i < pivots.length - 1; i++) {
    const [c1, s1] = pivots[i]!;
    const [c2, s2] = pivots[i + 1]!;
    if (len <= c1) return s1;
    if (len <= c2) {
      const t = (len - c1) / (c2 - c1);
      return Math.round(s1 + (s2 - s1) * t);
    }
  }
  return pivots[pivots.length - 1]![1];
}

function defaultPivots(max: number, min: number): Array<[number, number]> {
  // Pivots tuned for KO (each glyph ~1× width) and EN (each glyph ~0.55×).
  // visibleLength normalizes for that.
  return [
    [6, max],
    [12, Math.round(max * 0.85)],
    [18, Math.round(max * 0.7)],
    [26, Math.round(max * 0.55)],
    [38, min],
  ];
}

// Korean glyphs are ~1.7× the visual width of latin glyphs at the same
// font size, so 8 hangul chars occupy as much room as 14 latin chars. We
// scale the count so a single fitHeadline call works for both.
export function visibleLength(text: string, korean: boolean): number {
  if (korean) return text.length;
  return Math.round(text.length * 0.62);
}

export function hasKorean(text: string): boolean {
  return /[ㄱ-힝]/.test(text);
}

// Same idea for body copy. Body has a longer cap (120 chars per content-
// plan rules) — we shrink it less aggressively because readability matters
// more than impact at body sizes.
export function fitBody(
  text: string,
  opts: { max: number; min: number },
): number {
  const len = text.length;
  if (len <= 40) return opts.max;
  if (len <= 80) return Math.round(opts.max * 0.9);
  if (len <= 120) return Math.round(opts.max * 0.78);
  return opts.min;
}

// One per template. The orchestrator's `composeSlidePrompt` enforces a
// single accent at the *image-generation* layer; this is the typography
// layer's matching color. Keep them harmonized.
//
// Choice rationale per palette:
//   editorial  — NYT Magazine: warm cream paper, oxblood pull-quote red
//   monocle    — Monocle: low-key navy, Tyler-Brûlé classic warm red
//   riso       — Toiletpaper: solid hot poster color, paper beige body
//   cover      — Vogue cover: charcoal field, off-white serif, single hit
//   index      — 032c: black field, neon yellow, concrete-grey body text
// One per template. The orchestrator's `composeSlidePrompt` enforces a
// single accent at the *image-generation* layer; this is the typography
// layer's matching color. Keep them harmonized.
//
// Palette references (from real publications, not invented):
//   editorial — NYT Magazine: paper warm-white #F8F4EC + ink black + one
//               brick accent. Bichler-era redesign.
//   monocle   — Monocle: navy #0E2A47 + oxblood #7A1F1F + paper cream
//               #F4ECDD. Tyler Brûlé's house palette.
//   riso      — RISOTTO Studio + Bloomberg Businessweek: paper cream + hot
//               poster ink (Pantone-ish red), halftone misregistration.
//   cover     — Vogue / W: photo carries color; type is white on charcoal
//               with a single warm-metal hit when needed.
//   index     — Wallpaper* / Index magazine: pure black, paper white,
//               one acid neon (chartreuse) for indexed numerals.
export const PALETTES = {
  editorial: {
    bg: "#f8f4ec",         // NYT Magazine warm white
    // Surface is *inside* the photo column — when an image is missing the
    // surface color shows. Pure white reads as "broken image"; a slight
    // tint blends with the page so the empty zone feels intentional.
    surface: "#ece5d3",
    text: "#111111",
    textMuted: "rgba(17,17,17,0.62)",
    rule: "rgba(17,17,17,0.85)",
    accent: "#a8201a",     // muted brick — matches their feature accents
    scrim: "rgba(248,244,236,0.92)",
  },
  monocle: {
    bg: "#0e2a47",         // Monocle press navy
    surface: "#163355",
    text: "#f4ecdd",       // Monocle paper cream
    textMuted: "rgba(244,236,221,0.68)",
    rule: "rgba(244,236,221,0.32)",
    accent: "#d8534a",     // brighter house red — visible on navy at slide scale
    scrim: "rgba(14,42,71,0.78)",
  },
  riso: {
    bg: "#f4ecdd",         // riso paper cream
    surface: "#fff9ec",
    text: "#0a0a0a",
    textMuted: "rgba(10,10,10,0.68)",
    rule: "rgba(10,10,10,0.85)",
    accent: "#ef3340",     // Pantone 032c — load-bearing hot ink
    scrim: "rgba(244,236,221,0.85)",
  },
  cover: {
    bg: "#1c1a18",         // cover stock charcoal
    surface: "#26211d",
    text: "#f6efe4",
    textMuted: "rgba(246,239,228,0.66)",
    rule: "rgba(246,239,228,0.34)",
    accent: "#c8a04f",     // burnished gold — single warm-metal hit
    scrim: "rgba(28,26,24,0.55)",
  },
  index: {
    bg: "#000000",
    surface: "#0e0e0e",
    text: "#f4f4f0",
    textMuted: "rgba(244,244,240,0.6)",
    rule: "rgba(244,244,240,0.18)",
    accent: "#cfff3c",     // Wallpaper*-style chartreuse
    scrim: "rgba(0,0,0,0.78)",
  },
} as const;

export type PaletteKey = keyof typeof PALETTES;

// A small two-line helper for issue/folio marks: "ISSUE No.07 — 2026.05".
// Used by every composition's corner mark, replacing the brand watermark.
export function folioStamp(index: number, total: number): string {
  return `№ ${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

// Constant-density character ratio per language. Useful for body wrapping.
// A 1080-marginX-marginX = 888px content width fits roughly:
//   28 hangul at 38px / 32 hangul at 34px / 36 hangul at 30px
//   46 latin   at 38px / 52 latin   at 34px / 60 latin   at 30px
export const COL_WIDTH = PAGE.width - PAGE.marginX * 2; // 888
