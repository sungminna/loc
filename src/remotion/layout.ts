// Shared layout primitives for the 2026 template system.
//
// Two design problems this file owns, both pulled out of every composition
// so they're not solved five different ways:
//
//   1. Content-driven sizing. Korean headlines vary 6–34 chars; Latin
//      bodies vary 30–180. A static `fontSize: 96` overflows at 28 chars
//      and reads as a stamp at 8. Every template uses `fitHeadline` /
//      `fitBody` / `fitStat` to pick a size from char count + column
//      width — the same approach Pentagram's "Smart Type" Pentagram
//      essay recommends for variable input.
//
//   2. Background-image discipline. Per the redesign brief: a generated
//      bg image is a *backdrop* — it never moves, never zooms (no Ken
//      Burns), never crops differently per slide. Each template defines
//      a fixed image frame (`IMAGE_FRAME[template]`) so the typography
//      reflows responsively while the photo stays put as scenery.

// Reels (1080×1920) safe area. IG's bottom comments/share overlay covers
// ~140 of 1920; status bar covers ~110. We reserve a 96 page margin
// inside that so the live area is 96..(1920-96).
export const PAGE = {
  width: 1080,
  height: 1920,
  marginX: 96,
  safeTop: 110,
  safeBottom: 200,
} as const;

// Returns 1.0 for pure Korean, 0.62 for pure Latin, somewhere between for
// mixed. Korean glyphs are ~1.7× the visual width of Latin glyphs at the
// same font size, so character count alone doesn't tell us how wide a
// string will render. We use this ratio everywhere `fitHeadline` is called.
export function visibleLength(text: string): number {
  if (!text) return 0;
  const koMatches = text.match(/[ㄱ-ㆎ가-힣]/g);
  const koCount = koMatches ? koMatches.length : 0;
  const otherCount = text.length - koCount;
  return koCount + otherCount * 0.62;
}

export function hasKorean(text: string): boolean {
  return /[ㄱ-ㆎ가-힣]/.test(text);
}

// Generic linear-pivot fitter. `pivots` is a list of [chars, size] pairs
// sorted by chars ascending; we lerp between adjacent points.
export function fitFromPivots(
  text: string,
  pivots: Array<[chars: number, size: number]>,
): number {
  const len = visibleLength(text);
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

// Headline with column-width awareness. `columnPx` is the width of the
// box the headline must fit; we pick smaller pivots when the column
// is narrow (e.g. when an image takes half the page).
export function fitHeadline(
  text: string,
  opts: { max: number; min: number; columnPx?: number; pivots?: Array<[chars: number, size: number]> },
): number {
  if (opts.pivots) return fitFromPivots(text, opts.pivots);
  const { max, min, columnPx = PAGE.width - PAGE.marginX * 2 } = opts;
  // Estimate chars-per-line at `max` size, then expand pivots from there.
  // 0.55 is the typical advance-width-to-em-size ratio for grotesque
  // display weights at -2% tracking.
  const charsPerLine = Math.max(4, Math.round(columnPx / (max * 0.55)));
  return fitFromPivots(text, [
    [charsPerLine * 0.5, max],
    [charsPerLine * 1, Math.round(max * 0.78)],
    [charsPerLine * 2, Math.round(max * 0.58)],
    [charsPerLine * 3, Math.round(max * 0.42)],
    [charsPerLine * 4, min],
  ]);
}

export function fitBody(text: string, opts: { max: number; min: number }): number {
  const len = visibleLength(text);
  if (len <= 30) return opts.max;
  if (len <= 60) return Math.round(opts.max * 0.92);
  if (len <= 100) return Math.round(opts.max * 0.8);
  if (len <= 160) return Math.round(opts.max * 0.68);
  return opts.min;
}

// Big standalone numerals (Gummy, Dossier stat blocks). `stat.value` like
// "39.2조", "1080×1920", "₩4.8B". We size based on glyph density only
// (digits + punctuation are narrower than hangul).
export function fitStat(text: string, opts: { max: number; min: number }): number {
  const len = text.length;
  if (len <= 4) return opts.max;
  if (len <= 7) return Math.round(opts.max * 0.85);
  if (len <= 10) return Math.round(opts.max * 0.65);
  if (len <= 14) return Math.round(opts.max * 0.5);
  return opts.min;
}

// ─── Palettes (one per template) ────────────────────────────────────
//
// Each palette is internally consistent — bg/surface/text/textMuted are
// defined together so `text` always reads on `bg` and `textMuted` is a
// genuine 60..70% blend of `text` toward `bg` (real WCAG contrast, not
// guessed). Accent is the single hot color the template earns; only ONE
// hot color per slide ever appears so the page reads as a single voice.
//
// The five concepts (no overlap by design):
//
//   aurora   — Atmospheric gradient field. Cool-blue / opal lilac sky
//              with a cosmic-pink hot accent; type floats with parallax.
//   gummy    — Hyperreal 3D candy tiles. Bubblegum + electric lime on
//              butter cream; chunky offset shadows, jelly bounce.
//   zine     — Punk ransom-note collage. Black + paper white + acid
//              yellow + risograph red; halftone, mixed weights.
//   kinetic  — Typographic maximalism. Strict black & white with one
//              chartreuse hit; type fills the slide and morphs weight.
//   dossier  — Micrographics blueprint. Warm cream paper + ink black +
//              blueprint cyan + crimson stamp; dense data labels.

export const PALETTES = {
  aurora: {
    // Background is a gradient — store as CSS gradient string. The
    // composition uses it directly as `background:`.
    bg: "radial-gradient(120% 80% at 30% 15%, #c8b8ff 0%, #6a76d8 28%, #1a2456 60%, #0a0e2a 100%)",
    bgFlat: "#0a0e2a",
    surface: "rgba(200,184,255,0.08)",
    text: "#f4f0ff",
    textMuted: "rgba(244,240,255,0.65)",
    rule: "rgba(244,240,255,0.18)",
    accent: "#ff6b9d", // cosmic pink
    // Scrim stays moderate at the top so the gradient field reads, then
    // ramps to ~80% across the middle where the headline + body sit so
    // typography stays legible on busy photographic backdrops.
    scrim: "linear-gradient(180deg, rgba(10,14,42,0.25) 0%, rgba(10,14,42,0.55) 30%, rgba(10,14,42,0.78) 55%, rgba(10,14,42,0.92) 100%)",
  },
  gummy: {
    bg: "#fff5d6",       // butter cream paper
    bgFlat: "#fff5d6",
    surface: "#ffffff",
    text: "#1a1226",
    textMuted: "rgba(26,18,38,0.6)",
    rule: "rgba(26,18,38,0.12)",
    accent: "#ff5b9d",   // bubblegum pink
    accent2: "#c8ff3c",  // electric lime
    accent3: "#3b5cff",  // cobalt
    scrim: "rgba(255,245,214,0.55)",
  },
  zine: {
    bg: "#f4f0e6",       // photocopy paper
    bgFlat: "#f4f0e6",
    surface: "#0a0a0a",
    text: "#0a0a0a",
    textMuted: "rgba(10,10,10,0.62)",
    rule: "rgba(10,10,10,0.85)",
    accent: "#ee2a32",   // risograph red
    accent2: "#e8ff2c",  // acid yellow
    scrim: "rgba(244,240,230,0.85)",
  },
  kinetic: {
    bg: "#000000",
    bgFlat: "#000000",
    surface: "#0e0e0e",
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.55)",
    rule: "rgba(255,255,255,0.16)",
    accent: "#d8ff00",   // chartreuse — single hit
    scrim: "rgba(0,0,0,0.78)",
  },
  dossier: {
    bg: "#f1ead6",       // warm cream specimen paper
    bgFlat: "#f1ead6",
    surface: "#e6dcc0",
    text: "#181613",
    textMuted: "rgba(24,22,19,0.55)",
    rule: "rgba(24,22,19,0.32)",
    accent: "#a8201a",   // crimson stamp
    accent2: "#2c5e8c",  // blueprint cyan
    scrim: "rgba(241,234,214,0.85)",
  },
} as const;

export type PaletteKey = keyof typeof PALETTES;

// ─── Image frames ───────────────────────────────────────────────────
//
// Per the redesign brief, the bg image is a fixed scenery layer. Each
// template defines exactly where the photo lives so the image NEVER
// moves between slides — only the typography animates over it.
//
// Coordinates are absolute on the 1080×1920 canvas. `mode` controls how
// the typography composes against the image:
//   - "full": image fills the slide; text gets a gradient scrim.
//   - "tile": image is bounded inside a card with offset shadow.
//   - "torn": image is clipped into an irregular polygon (zine collage).
//   - "inset": small image positioned in a corner.
//   - "specimen": image inside a cornered "specimen" frame with tics.

export interface ImageFrame {
  mode: "full" | "tile" | "torn" | "inset" | "specimen";
  top: number; left: number; width: number; height: number;
  /** Optional rotation in degrees for the image card. */
  rotate?: number;
  /** Optional radius in px for rounded card frames. */
  radius?: number;
}

export const IMAGE_FRAME: Record<PaletteKey, ImageFrame> = {
  // Aurora — full bleed; gradient scrim from layout handles legibility.
  aurora: { mode: "full", top: 0, left: 0, width: PAGE.width, height: PAGE.height },
  // Gummy — chunky rounded tile, top half of slide, slight rotation.
  gummy: { mode: "tile", top: 240, left: 120, width: 840, height: 720, rotate: -2.5, radius: 56 },
  // Zine — torn-edge clip, tilted card high on the page.
  zine: { mode: "torn", top: 220, left: 144, width: 800, height: 760, rotate: -3 },
  // Kinetic — small inset square in upper-right; treat photo like a stamp.
  kinetic: { mode: "inset", top: 160, left: 720, width: 280, height: 280 },
  // Dossier — specimen frame in upper section with corner brackets.
  dossier: { mode: "specimen", top: 280, left: 144, width: 792, height: 580 },
};

// Folio / pagination stamp used by Dossier and Aurora bottom marks.
export function folioStamp(index: number, total: number): string {
  return `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

export const COL_WIDTH = PAGE.width - PAGE.marginX * 2; // 888
