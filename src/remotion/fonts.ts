// Per-template font system — 2026 trend stack.
//
// Each composition is bound to a typographic identity. The 2026 trends
// in editorial/cardnews motion design reward four moves:
//   - Korean-first display: Pretendard Variable (orioncactus) is the
//     de-facto "Helvetica of Korean" today; we self-host the variable
//     woff2 so a single face spans 100..900 wght without N round-trips.
//   - Modern grotesque body: Geist + Inter Variable for Latin grotesque,
//     paired with Pretendard for Korean — uniform x-height, tight rhythm.
//   - Editorial italic: Instrument Serif italic for surprise emphasis,
//     Fraunces variable for slab/display serif.
//   - Mono ticker: Geist Mono / IBM Plex Mono for micro-data labels.
//
// The Pretendard load uses delayRender + the Font Face API — Remotion
// pauses rendering until document.fonts has the face, so frame 0 doesn't
// fall back to system Helvetica during deterministic renders.
//
// Sources:
//   https://github.com/orioncactus/pretendard
//   https://vercel.com/font (Geist)
//   https://fonts.google.com/specimen/Onest
//   https://fonts.google.com/specimen/Instrument+Serif

import { continueRender, delayRender } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadOnest } from "@remotion/google-fonts/Onest";
import { loadFont as loadGabarito } from "@remotion/google-fonts/Gabarito";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadInstrumentSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadArchivoBlack } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadIBMPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadIBMPlexSansKR } from "@remotion/google-fonts/IBMPlexSansKR";

// Latin — restrict subsets so we don't pull every locale range.
loadInter("normal", { weights: ["300", "400", "700", "900"], subsets: ["latin"] });
loadGeist("normal", { weights: ["300", "400", "700", "900"], subsets: ["latin"] });
loadGeistMono("normal", { weights: ["400", "700"], subsets: ["latin"] });
loadOnest("normal", { weights: ["300", "400", "700", "900"], subsets: ["latin"] });
loadGabarito("normal", { weights: ["400", "700", "900"], subsets: ["latin"] });
loadFraunces("normal", { weights: ["700", "900"], subsets: ["latin"] });
loadFraunces("italic", { weights: ["700", "900"], subsets: ["latin"] });
loadInstrumentSerif("normal", { weights: ["400"], subsets: ["latin"] });
loadInstrumentSerif("italic", { weights: ["400"], subsets: ["latin"] });
loadArchivoBlack("normal", { weights: ["400"], subsets: ["latin"] });
loadIBMPlexMono("normal", { weights: ["400", "700"], subsets: ["latin"] });

// Korean — Pretendard (loaded below) covers KS X 1001 hangul fully, so
// we only need ONE minimal fallback for the rare missing-glyph case
// (legacy hangul, archaic CJK punctuation). Loading every weight × every
// subset of three Korean families burned ~900 font-network-requests per
// render and triggered Remotion's "too many requests" warning. Single
// weight, single subset is sufficient for fallback.
loadIBMPlexSansKR("normal", { weights: ["400"], subsets: ["korean"], ignoreTooManyRequestsWarning: true });

// ─── Pretendard Variable (self-hosted via jsDelivr) ─────────────────
// Pretendard is not on Google Fonts. We use the orioncactus npm
// distribution via jsDelivr (the GitHub /dist path moved into a
// /packages/pretendard subdirectory after v1.3 — npm has the stable
// post-build tree) and wire it into Remotion's delayRender so frame 0
// doesn't paint with a fallback face. A single variable woff2 covers
// 45..920 wght, so we only block on one fetch.
const PRETENDARD_HREF =
  "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/woff2/PretendardVariable.woff2";

if (typeof document !== "undefined" && typeof FontFace !== "undefined") {
  const handle = delayRender("pretendard-variable");
  const face = new FontFace(
    "Pretendard Variable",
    `url("${PRETENDARD_HREF}") format("woff2-variations")`,
    { weight: "45 920", style: "normal", display: "swap" },
  );
  face
    .load()
    .then((f) => {
      document.fonts.add(f);
      continueRender(handle);
    })
    .catch(() => {
      // Fall back rather than blocking the whole render — Pretendard
      // only fails when the CDN is offline, and the IBM Plex Sans KR
      // we already loaded covers Korean glyphs adequately.
      continueRender(handle);
    });
}

// ─── Per-template font specs ────────────────────────────────────────
// Each composition imports `FONT[<comp>]`. The string is a CSS font-stack —
// browser falls back through it left-to-right, so order matters: Korean
// Pretendard ahead of Latin grotesque so a Korean glyph never picks up
// Geist's Latin-only face by accident.

export interface CompFontSpec {
  /** Display headline — the "voice" of this template. */
  display: string;
  /** Body / caption / agate. */
  body: string;
  /** Mono / ticker / data tables. */
  mono: string;
  /** Whether display is italic-capable (used for the Zine pick-and-mix). */
  hasItalic: boolean;
  /** Whether display reads best in uppercase. */
  uppercaseDisplay: boolean;
}

// Pretendard Variable — single weight-range face. We declare it once
// here and reuse the literal across templates so a future swap is a one-line edit.
const PRETENDARD = "'Pretendard Variable', 'IBM Plex Sans KR', 'Noto Sans KR', system-ui";

export const FONT: Record<string, CompFontSpec> = {
  // Aurora — atmospheric gradient field. Light grotesque whispers on
  // ambient color; Onest's open counters keep the type readable when
  // it floats on a low-contrast lilac.
  Aurora: {
    display: `${PRETENDARD}, 'Onest', 'Inter', sans-serif`,
    body: `${PRETENDARD}, 'Onest', 'Inter', sans-serif`,
    mono: "'Geist Mono', 'IBM Plex Mono', monospace",
    hasItalic: false,
    uppercaseDisplay: false,
  },

  // Gummy — hyperreal 3D, candy palette. Gabarito is Google's rounded
  // display grotesque (squashed terminals, friendly weight). Pairs with
  // Pretendard's heaviest weight for matching Korean rounded chunkiness.
  Gummy: {
    display: `${PRETENDARD}, 'Gabarito', 'Inter', sans-serif`,
    body: `${PRETENDARD}, 'Geist', 'Inter', sans-serif`,
    mono: "'Geist Mono', 'IBM Plex Mono', monospace",
    hasItalic: false,
    uppercaseDisplay: false,
  },

  // Zine — ransom-note collage. Mix of weights/styles is the point.
  // Display is Archivo Black (poster), body is Pretendard / Geist, mono
  // ticker is IBM Plex Mono (zine-photocopy weight), italic surprise is
  // Instrument Serif Italic.
  Zine: {
    display: `'Archivo Black', ${PRETENDARD}, 'Geist', sans-serif`,
    body: `${PRETENDARD}, 'Geist', sans-serif`,
    mono: "'IBM Plex Mono', 'Geist Mono', monospace",
    hasItalic: true,
    uppercaseDisplay: true,
  },

  // Kinetic — typographic maximalism. Geist's grotesque lockup with
  // Pretendard for KO; both are variable so we morph wght 200..900 live.
  Kinetic: {
    display: `${PRETENDARD}, 'Geist', 'Inter', sans-serif`,
    body: `${PRETENDARD}, 'Geist', 'Inter', sans-serif`,
    mono: "'Geist Mono', 'IBM Plex Mono', monospace",
    hasItalic: false,
    uppercaseDisplay: false,
  },

  // Dossier — micrographics / blueprint. Instrument Serif for the
  // editorial italic and section heads (Latin only — Instrument Serif
  // has no Korean glyphs); Pretendard Variable carries Korean. Geist Mono
  // for every micro-label (timestamps, registration marks). Pretendard
  // ahead of Fraunces in the stack so Korean glyphs deterministically
  // pick up Pretendard rather than Chrome's generic-serif fallback.
  Dossier: {
    display: `'Instrument Serif', 'Fraunces', ${PRETENDARD}, serif`,
    body: `${PRETENDARD}, 'Geist', sans-serif`,
    mono: "'Geist Mono', 'IBM Plex Mono', monospace",
    hasItalic: true,
    uppercaseDisplay: false,
  },

  // ThreadsCard — inherits Dossier's editorial register so a single
  // Threads still sits in the same publication voice as a Dossier reel.
  ThreadsCard: {
    display: `'Instrument Serif', 'Fraunces', ${PRETENDARD}, serif`,
    body: `${PRETENDARD}, 'Geist', sans-serif`,
    mono: "'Geist Mono', 'IBM Plex Mono', monospace",
    hasItalic: true,
    uppercaseDisplay: false,
  },
};
