// Shared animation primitives used across Remotion compositions.
//
// Goal: keep each template's eye-catching motion 1-3 lines of code.
// Every helper is pure — no side effects, no JSX — so they compose freely
// with `interpolate`, `spring`, `useCurrentFrame`, etc.

import { interpolate, spring, type SpringConfig } from "remotion";

// ─── easings ───────────────────────────────────────────────────────────
// `interpolate`'s built-in `easing` callback wants a function. These match
// the curves people expect from CSS / motion-design tools.

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutExpo = (t: number): number =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

export const easeOutBack = (t: number, k = 1.70158): number => {
  const c3 = k + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);
};

// ─── spring stagger ────────────────────────────────────────────────────
// Each child enters `staggerFrames` later than the previous one. Returns
// a 0-1 progress value — multiply into transforms / opacity as you wish.

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

// ─── split-text reveal ─────────────────────────────────────────────────
// Returns per-character (or per-word) progress 0-1 for the given index.
// Use it to fade/slide each glyph in, kinetic-type style.

export function splitTextProgress(
  frame: number,
  fps: number,
  index: number,
  opts: { startFrame?: number; perItemFrames?: number; durationFrames?: number } = {},
): number {
  const { startFrame = 0, perItemFrames = 2, durationFrames = 14 } = opts;
  const local = frame - startFrame - index * perItemFrames;
  return interpolate(local, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOutExpo,
  });
}

// ─── mask wipe ─────────────────────────────────────────────────────────
// Returns a CSS clip-path string that wipes from one side over the
// duration. Direction = which side the wipe *starts from*.

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
    case "left":   return `inset(0 ${inset}% 0 0)`;
    case "right":  return `inset(0 0 0 ${inset}%)`;
    case "top":    return `inset(0 0 ${inset}% 0)`;
    case "bottom": return `inset(${inset}% 0 0 0)`;
  }
}

// ─── count-up number ───────────────────────────────────────────────────
// Animates a numeric stat from 0 → target over durationFrames. Returns
// the formatted string. Suffix lets you keep "%" / "x" / "+" pinned.

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

// ─── ken burns (slow zoom + pan) ───────────────────────────────────────
// Returns a CSS transform string. Use on background <Img>.

export function kenBurns(
  frame: number,
  totalFrames: number,
  variant: "in" | "out" | "diag" = "in",
): string {
  const t = interpolate(frame, [0, totalFrames], [0, 1], { extrapolateRight: "clamp" });
  const scale = variant === "out" ? interpolate(t, [0, 1], [1.18, 1.02]) : interpolate(t, [0, 1], [1.02, 1.18]);
  const x = variant === "diag" ? interpolate(t, [0, 1], [-2, 2]) : 0;
  const y = variant === "diag" ? interpolate(t, [0, 1], [1, -1]) : 0;
  return `scale(${scale}) translate(${x}%, ${y}%)`;
}

// ─── marquee / ticker ──────────────────────────────────────────────────
// Returns an x-translation in px that loops every `loopFrames`.

export function marquee(frame: number, distancePx: number, loopFrames: number): number {
  const t = (frame % loopFrames) / loopFrames;
  return -t * distancePx;
}

// ─── slide enter+exit envelope ─────────────────────────────────────────
// One number you can multiply into opacity AND interpret for position.

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
  const exit = interpolate(
    frame,
    [durationFrames - 12, durationFrames + 12],
    [1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );
  const opacity = enter * exit;
  const translateY = interpolate(enter, [0, 1], [40, 0]);
  return { progress: enter, exit, opacity, translateY };
}

// ─── grain/noise opacity wave ──────────────────────────────────────────
// Subtle alpha pulse for film-grain or scanline overlays.

export function grainPulse(frame: number, base = 0.08, amp = 0.04, periodFrames = 30): number {
  return base + amp * Math.sin((frame / periodFrames) * Math.PI * 2);
}

// ─── chromatic aberration shadow ───────────────────────────────────────
// Returns a `text-shadow` string for the trendy RGB-split look.

export function chromaShadow(strength = 4): string {
  return `${strength}px 0 0 rgba(255,0,80,0.7), -${strength}px 0 0 rgba(0,180,255,0.7)`;
}
