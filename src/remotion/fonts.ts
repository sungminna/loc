// Per-template font system. Each composition is bound to a specific
// publication's typography (researched from real magazine identities,
// not invented):
//
//   Editorial — NYT Magazine's custom NYT Mag Slab (Henrik Kubel,
//     2015, derived from Stymie). Closest free equivalent: Fraunces.
//     Korean serif: Nanum Myeongjo (Naver's editorial-grade serif used
//     across Korean magazine layouts, also published under OFL).
//   Monocle  — Plantin (1913, by Frank Hinman Pierpont) for headlines
//     and body, Helvetica Neue for captions and tabular agate. Closest
//     free equivalents: Source Serif 4 (Adobe's modern Plantin-leaning
//     serif) for headline + Inter for sans.
//   Riso     — RISOTTO Studio / Print magazine posters use heavy
//     display sans (Druk, GT Walsheim Black). Closest free: Archivo
//     Black for Latin display + Noto Sans KR Black for Korean.
//   Cover    — Vogue / W / Numéro use a custom Didone (Vogue's logo
//     descends from Didot). Closest free: Bodoni Moda italic. Korean
//     serif takes Nanum Myeongjo Bold (Korean serifs have no italic
//     style; bold reads as "feature emphasis" instead).
//   Index032c — 032c uses pure Helvetica; Wallpaper* uses a similar
//     neutral grotesque. Closest free: Inter Black for both Latin and
//     Korean (paired with Noto Sans KR for hangul).
//
// Sources:
//   https://fontsinuse.com/typefaces/44949/nyt-mag-slab
//   https://monocle.com/magazine/issues/33/fonts-of-knowledge/
//   https://fonts.google.com/specimen/Nanum+Myeongjo

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadSourceSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as loadBodoni } from "@remotion/google-fonts/BodoniModa";
import { loadFont as loadArchivoBlack } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadJetbrains } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadNotoSans } from "@remotion/google-fonts/NotoSansKR";
import { loadFont as loadNotoSerif } from "@remotion/google-fonts/NotoSerifKR";
import { loadFont as loadNanumMyeongjo } from "@remotion/google-fonts/NanumMyeongjo";

// Restrict subsets — Noto's default subset list is 100+ locale ranges
// and burns through Chromium's HTTP queue at render time.
loadInter("normal", { weights: ["400", "700", "900"], subsets: ["latin"] });
loadFraunces("normal", { weights: ["700", "900"], subsets: ["latin"] });
loadFraunces("italic", { weights: ["700", "900"], subsets: ["latin"] });
loadSourceSerif("normal", { weights: ["400", "700", "900"], subsets: ["latin"] });
loadBodoni("normal", { weights: ["700", "900"], subsets: ["latin"] });
loadBodoni("italic", { weights: ["700", "900"], subsets: ["latin"] });
loadArchivoBlack("normal", { weights: ["400"], subsets: ["latin"] });
loadJetbrains("normal", { weights: ["400", "700"], subsets: ["latin"] });

// ─── Korean ──────────────────────────────────────────────────────
loadNotoSans("normal", { weights: ["400", "700", "900"], subsets: ["korean", "latin"] });
loadNotoSerif("normal", { weights: ["400", "700", "900"], subsets: ["korean", "latin"] });
loadNanumMyeongjo("normal", { weights: ["400", "700", "800"], subsets: ["korean", "latin"] });

// ─── Per-template font specs ────────────────────────────────────
// Each composition imports `FONT[<comp>]` and uses `display` / `body` /
// `mono` in its style props. Centralizing here means a typeface change
// (e.g. swapping Fraunces for Roboto Slab) ripples without grepping.

export interface CompFontSpec {
  /** Display headline — the "voice" of this magazine. */
  display: string;
  /** Body / caption / agate — should harmonize with display. */
  body: string;
  /** Mono / ticker / data tables. Not every comp uses it. */
  mono: string;
  /** Whether display is italic-capable in Latin (for Cover). */
  hasItalic: boolean;
  /** Whether display reads best in uppercase (for Riso, Index). */
  uppercaseDisplay: boolean;
}

export const FONT: Record<string, CompFontSpec> = {
  // NYT Magazine — slab-leaning serif display + sans body. Fraunces
  // sits between modern serif and slab and reads as editorial weight at
  // 100+px. Korean serif uses Nanum Myeongjo, the Naver-distributed
  // editorial Korean serif used across LP / NYL / NYBI magazines.
  Editorial: {
    display: "'Fraunces', 'Nanum Myeongjo', 'Noto Serif KR', serif",
    body: "'Inter', 'Noto Sans KR', sans-serif",
    mono: "'JetBrains Mono', monospace",
    hasItalic: true,
    uppercaseDisplay: false,
  },

  // Monocle — Plantin's open-aperture serif + Helvetica's neutral
  // grotesque. Source Serif 4 is the closest free Plantin alternative.
  Monocle: {
    display: "'Source Serif 4', 'Nanum Myeongjo', 'Noto Serif KR', serif",
    body: "'Inter', 'Noto Sans KR', sans-serif",
    mono: "'JetBrains Mono', monospace",
    hasItalic: false,
    uppercaseDisplay: false,
  },

  // Riso — poster display sans, paper-cream body. Archivo Black is a
  // free black-weight sans that reads close to Druk / GT Walsheim.
  Riso: {
    display: "'Archivo Black', 'Noto Sans KR', sans-serif",
    body: "'Inter', 'Noto Sans KR', sans-serif",
    mono: "'JetBrains Mono', monospace",
    hasItalic: false,
    uppercaseDisplay: true,
  },

  // Cover — Vogue Didone. Bodoni Moda italic carries the logotype feel.
  // Korean serif has no italic; falls back to Nanum Myeongjo Bold.
  Cover: {
    display: "'Bodoni Moda', 'Nanum Myeongjo', 'Noto Serif KR', serif",
    body: "'Inter', 'Noto Sans KR', sans-serif",
    mono: "'JetBrains Mono', monospace",
    hasItalic: true,
    uppercaseDisplay: false,
  },

  // Index032c — pure Helvetica feel. Inter Black is the closest free
  // grotesque. Korean uses Noto Sans KR Black to match the weight.
  Index032c: {
    display: "'Inter', 'Noto Sans KR', sans-serif",
    body: "'Inter', 'Noto Sans KR', sans-serif",
    mono: "'JetBrains Mono', monospace",
    hasItalic: false,
    uppercaseDisplay: true,
  },

  // ThreadsCard inherits Editorial's typography (4:5 still, NYT Mag tone).
  ThreadsCard: {
    display: "'Fraunces', 'Nanum Myeongjo', 'Noto Serif KR', serif",
    body: "'Inter', 'Noto Sans KR', sans-serif",
    mono: "'JetBrains Mono', monospace",
    hasItalic: true,
    uppercaseDisplay: false,
  },
};
