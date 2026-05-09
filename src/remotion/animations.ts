// Shared animation primitives for the 2026 template motion system.
//
// Each helper is pure (no JSX, no side effects) so compositions wire them
// up at the leaf — `<span style={{ transform: jellyBounce(frame, ...) }}>`
// — and we don't ship invisible state through React context.

import { interpolate, spring, type SpringConfig } from "remotion";

// ─── easings ───────────────────────────────────────────────────────────

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutExpo = (t: number): number =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

export const easeOutBack = (t: number, k = 1.70158): number => {
  const c3 = k + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);
};

// ─── deterministic pseudo-random ──────────────────────────────────────
// Math.random differs between server render and Player preview, which
// causes flicker. This gives a stable 0..1 from any (frame, seed).

export function pseudoRandom(frame: number, seed = 1): number {
  const x = Math.sin(frame * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ─── stagger spring ────────────────────────────────────────────────────
// Each child enters `staggerFrames` later than the previous. Returns 0..1.

export function springStagger(
  frame: number,
  fps: number,
  index: number,
  opts: { delay?: number; staggerFrames?: number; config?: Partial<SpringConfig> } = {},
): number {
  const { delay = 0, staggerFrames = 4, config } = opts;
  return spring({
    frame: frame - (delay + index * staggerFrames),
    fps,
    config: { damping: 18, mass: 0.6, stiffness: 140, ...config },
  });
}

// ─── split-text reveal (per-glyph progress 0..1) ──────────────────────

export function splitTextProgress(
  frame: number,
  fps: number,
  index: number,
  opts: { startFrame?: number; perItemFrames?: number; durationFrames?: number } = {},
): number {
  void fps;
  const { startFrame = 0, perItemFrames = 2, durationFrames = 14 } = opts;
  const local = frame - startFrame - index * perItemFrames;
  return interpolate(local, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOutExpo,
  });
}

// ─── text scramble / shuffle effect ───────────────────────────────────
// "글자가 슈류륙 바뀌어서 결과로 나오거나" — letters cycle through random
// glyphs, then settle on the real character one by one. Used by the Zine
// kicker and the Kinetic stat block. Returns the rendered string for the
// given frame; the resolved tail grows char-by-char.
//
// We use a deterministic glyph pool seeded by (frame, index) so every
// render matches between Player preview and the headless Chromium pass.

const SCRAMBLE_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&";
const SCRAMBLE_POOL_KO = "가나다라마바사아자차카타파하섬분초율형미상";

export function scrambleText(
  text: string,
  frame: number,
  opts: { startFrame?: number; perCharFrames?: number; korean?: boolean } = {},
): string {
  const { startFrame = 0, perCharFrames = 3, korean = /[ㄱ-ㆎ가-힣]/.test(text) } = opts;
  const pool = korean ? SCRAMBLE_POOL_KO : SCRAMBLE_POOL;
  const local = Math.max(0, frame - startFrame);
  const resolved = Math.min(text.length, Math.floor(local / perCharFrames));
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (i < resolved) {
      out += text[i];
    } else if (text[i] === " ") {
      out += " ";
    } else {
      const r = pseudoRandom(local, i + 1);
      out += pool[Math.floor(r * pool.length)] ?? text[i];
    }
  }
  return out;
}

// ─── kinetic word swap ────────────────────────────────────────────────
// Cycles through `words` and lands on the final term, with each swap
// being a quick scramble. Used by Kinetic's headline morph.

export function kineticWordSwap(
  words: string[],
  frame: number,
  opts: { startFrame?: number; holdFrames?: number; transitionFrames?: number } = {},
): string {
  const { startFrame = 0, holdFrames = 18, transitionFrames = 12 } = opts;
  if (words.length === 0) return "";
  const local = Math.max(0, frame - startFrame);
  const cycleFrames = holdFrames + transitionFrames;
  const cycleIndex = Math.min(words.length - 1, Math.floor(local / cycleFrames));
  const inCycle = local - cycleIndex * cycleFrames;
  const word = words[cycleIndex] ?? words[words.length - 1]!;
  if (inCycle < transitionFrames) {
    // Scrambling INTO this word.
    return scrambleText(word, frame, {
      startFrame: startFrame + cycleIndex * cycleFrames,
      perCharFrames: Math.max(1, Math.floor(transitionFrames / Math.max(1, word.length))),
    });
  }
  return word;
}

// ─── mask wipe ─────────────────────────────────────────────────────────

export type WipeDir = "left" | "right" | "top" | "bottom";

export function maskWipe(
  frame: number,
  durationFrames: number,
  direction: WipeDir = "left",
  startFrame = 0,
): string {
  const t = interpolate(frame - startFrame, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeInOutCubic,
  });
  const inset = (1 - t) * 100;
  switch (direction) {
    case "left": return `inset(0 ${inset}% 0 0)`;
    case "right": return `inset(0 0 0 ${inset}%)`;
    case "top": return `inset(0 0 ${inset}% 0)`;
    case "bottom": return `inset(${inset}% 0 0 0)`;
  }
}

// ─── count-up number ───────────────────────────────────────────────────

export function countUp(
  frame: number,
  target: number,
  opts: { startFrame?: number; durationFrames?: number; suffix?: string; decimals?: number } = {},
): string {
  const { startFrame = 0, durationFrames = 24, suffix = "", decimals = 0 } = opts;
  const t = interpolate(frame - startFrame, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOutExpo,
  });
  return (target * t).toFixed(decimals) + suffix;
}

// ─── parallax floating tilt (Aurora) ──────────────────────────────────
// Subtle continuous breathing motion. Gives type the impression of being
// suspended in the gradient field without distracting from the content.
// We deliberately do NOT apply this to background images per the redesign
// rule "bg image fixed; never moves" — only typography uses it.

export function parallaxFloat(
  frame: number,
  opts: { amplitudeY?: number; amplitudeX?: number; periodFrames?: number; phase?: number } = {},
): { x: number; y: number } {
  const { amplitudeY = 6, amplitudeX = 3, periodFrames = 240, phase = 0 } = opts;
  const t = (frame / periodFrames) * Math.PI * 2 + phase;
  return { x: Math.sin(t * 0.7) * amplitudeX, y: Math.sin(t) * amplitudeY };
}

// ─── jelly squish (Gummy) ─────────────────────────────────────────────
// One-shot non-uniform-scale spring. The element squashes Y / stretches
// X on overshoot, which reads as a rubber/jelly material.

export function jellyBounce(
  frame: number,
  fps: number,
  opts: { delay?: number; amplitude?: number; config?: Partial<SpringConfig> } = {},
): { transform: string; opacity: number } {
  const { delay = 0, amplitude = 0.18, config } = opts;
  const t = spring({
    frame: frame - delay,
    fps,
    config: { damping: 8, mass: 0.55, stiffness: 90, ...config },
  });
  // Spring overshoots past 1 — we read overshoot as the squish amount.
  const over = t - 1; // negative on undershoot, positive on overshoot
  const sx = 1 + over * amplitude;
  const sy = 1 - over * amplitude;
  const opacity = interpolate(t, [0, 0.4, 1], [0, 1, 1], { extrapolateRight: "clamp" });
  return { transform: `scale(${sx}, ${sy})`, opacity };
}

// ─── 3D card flip (Gummy / Kinetic) ───────────────────────────────────

export function flip3dEnter(
  frame: number,
  fps: number,
  opts: { axis?: "x" | "y"; from?: number; delay?: number; config?: Partial<SpringConfig> } = {},
): { transform: string; opacity: number; progress: number } {
  const { axis = "x", from = 30, delay = 0, config } = opts;
  const t = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, mass: 0.7, stiffness: 110, ...config },
  });
  const angle = (1 - t) * from;
  const z = (1 - t) * -160;
  const transform = axis === "x"
    ? `perspective(1400px) rotateX(${angle}deg) translateZ(${z}px)`
    : `perspective(1400px) rotateY(${angle}deg) translateZ(${z}px)`;
  return { transform, opacity: t, progress: t };
}

// ─── variable font weight morph (Kinetic) ─────────────────────────────
// Returns a `font-variation-settings` string that morphs wght over the
// life of a slide. Pretendard Variable supports 45..920; Geist supports
// 100..900. We clamp to 200..900 as a safe range across both.

export function weightMorph(
  frame: number,
  durationFrames: number,
  opts: { from?: number; to?: number; startFrame?: number } = {},
): string {
  const { from = 280, to = 880, startFrame = 0 } = opts;
  const wght = interpolate(frame - startFrame, [0, durationFrames], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeInOutCubic,
  });
  return `'wght' ${Math.round(wght)}`;
}

// ─── pulse weight (Kinetic emphasis) ──────────────────────────────────
// Variable font weight that cycles continuously — same idea as
// weightMorph but loops. Used for kicker labels that breathe.

export function weightPulse(
  frame: number,
  opts: { min?: number; max?: number; periodFrames?: number; phase?: number } = {},
): string {
  const { min = 380, max = 820, periodFrames = 90, phase = 0 } = opts;
  const t = 0.5 + 0.5 * Math.sin((frame / periodFrames) * Math.PI * 2 + phase);
  const wght = Math.round(min + (max - min) * t);
  return `'wght' ${wght}`;
}

// ─── marquee / ticker ──────────────────────────────────────────────────

export function marquee(frame: number, distancePx: number, loopFrames: number): number {
  const t = (frame % loopFrames) / loopFrames;
  return -t * distancePx;
}

// ─── slide enter+exit envelope ─────────────────────────────────────────

export function slideEnvelope(
  frame: number,
  fps: number,
  durationFrames: number,
  config: Partial<SpringConfig> = {},
): { progress: number; exit: number; opacity: number; translateY: number } {
  const enter = spring({
    frame,
    fps,
    config: { damping: 200, mass: 0.6, stiffness: 120, ...config },
  });
  const exit = interpolate(frame, [durationFrames - 12, durationFrames + 12], [1, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });
  return {
    progress: enter,
    exit,
    opacity: enter * exit,
    translateY: interpolate(enter, [0, 1], [40, 0]),
  };
}

// ─── grain pulse (Zine) ────────────────────────────────────────────────

export function grainPulse(frame: number, base = 0.08, amp = 0.04, periodFrames = 30): number {
  return base + amp * Math.sin((frame / periodFrames) * Math.PI * 2);
}

// ─── glitch jitter (Zine) ──────────────────────────────────────────────
// Tiny per-frame xy jitter, simulating photocopier registration drift.
// Deterministic via pseudoRandom so previews and renders match.

export function glitchJitter(frame: number, seed = 1, amplitude = 1.5): { x: number; y: number } {
  return {
    x: (pseudoRandom(frame, seed) - 0.5) * 2 * amplitude,
    y: (pseudoRandom(frame, seed + 13) - 0.5) * 2 * amplitude,
  };
}

// ─── stroke draw-on (Dossier) ──────────────────────────────────────────
// SVG-friendly stroke-dashoffset progress for blueprint lines that draw
// in. Returns the `strokeDashoffset` value given a path length.

export function drawOn(
  frame: number,
  pathLength: number,
  opts: { startFrame?: number; durationFrames?: number } = {},
): number {
  const { startFrame = 0, durationFrames = 30 } = opts;
  const t = interpolate(frame - startFrame, [0, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeInOutCubic,
  });
  return pathLength * t;
}

// ─── chromatic aberration shadow ───────────────────────────────────────

export function chromaShadow(strength = 4): string {
  return `${strength}px 0 0 rgba(255,0,80,0.7), -${strength}px 0 0 rgba(0,180,255,0.7)`;
}
