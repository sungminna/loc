// Compose-time registry that lets the dashboard render any of our Remotion
// compositions inside <Player>. The components themselves are pure React +
// Remotion APIs — all of which run in the browser inside @remotion/player.
//
// We don't import Root.tsx (which calls registerRoot, a no-op outside
// Remotion's renderer but adds dead weight to the dashboard bundle).

import type { ComponentType } from "react";
import { Editorial, defaultEditorialProps } from "@/remotion/compositions/Editorial";
import { Monocle, defaultMonocleProps } from "@/remotion/compositions/Monocle";
import { Riso, defaultRisoProps } from "@/remotion/compositions/Riso";
import { Cover, defaultCoverProps } from "@/remotion/compositions/Cover";
import { Index032c, defaultIndex032cProps } from "@/remotion/compositions/Index032c";
import { ThreadsCard, defaultThreadsCardProps, type ThreadsCardProps } from "@/remotion/compositions/ThreadsCard";
import { SeedanceReel, defaultSeedanceReelProps } from "@/remotion/compositions/SeedanceReel";
import type { CardSlideProps, VideoReelProps } from "@/remotion/types";

// Player wants exact Component / props inferred together. Cast through
// `unknown` because each composition has a slightly different prop type.
type AnyComp = ComponentType<Record<string, unknown>>;

// Match Root.tsx — keep these in sync if you tune frames-per-slide there.
const SLIDE_FRAMES_BY_COMP: Record<string, number> = {
  Editorial: 156,
  Monocle: 162,
  Riso: 156,
  Cover: 168,
  Index032c: 150,
};

const FPS = 30;

export interface RegistryEntry {
  Component: AnyComp;
  defaults: Record<string, unknown>;
  /** Native composition resolution. The Player scales to fit the container. */
  width: number;
  height: number;
  fps: number;
  /** Compute durationInFrames from props (mirrors Remotion Root.tsx). */
  durationFromProps: (props: Record<string, unknown>) => number;
  /** What the composition expects in its props — drives the storyboard editor. */
  briefShape: "card" | "video" | "still";
  /** A short label shown in lists/tooltips. */
  label: string;
}

const cardDuration = (compId: string) => (props: Record<string, unknown>) => {
  const slides = (props as unknown as CardSlideProps).slides ?? [];
  const slideFrames = SLIDE_FRAMES_BY_COMP[compId] ?? 150;
  return Math.max(FPS * 6, slideFrames * Math.max(1, slides.length) + 12);
};

const videoDuration = (props: Record<string, unknown>) => {
  const scenes = (props as unknown as VideoReelProps).scenes ?? [];
  const total = scenes.reduce((acc, s) => acc + Math.max(1, Math.round((s.durationSec ?? 5) * FPS)), 0);
  return Math.max(FPS * 6, total);
};

export const compositionRegistry: Record<string, RegistryEntry> = {
  Editorial: {
    Component: Editorial as unknown as AnyComp,
    defaults: defaultEditorialProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("Editorial"),
    briefShape: "card",
    label: "Editorial — NYT Magazine",
  },
  Monocle: {
    Component: Monocle as unknown as AnyComp,
    defaults: defaultMonocleProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("Monocle"),
    briefShape: "card",
    label: "Monocle — Briefing",
  },
  Riso: {
    Component: Riso as unknown as AnyComp,
    defaults: defaultRisoProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("Riso"),
    briefShape: "card",
    label: "Riso — Hot Poster",
  },
  Cover: {
    Component: Cover as unknown as AnyComp,
    defaults: defaultCoverProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("Cover"),
    briefShape: "card",
    label: "Cover — Vogue/Numéro",
  },
  Index032c: {
    Component: Index032c as unknown as AnyComp,
    defaults: defaultIndex032cProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("Index032c"),
    briefShape: "card",
    label: "Index — Wallpaper*/032c",
  },
  SeedanceReel: {
    Component: SeedanceReel as unknown as AnyComp,
    defaults: defaultSeedanceReelProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: videoDuration,
    briefShape: "video",
    label: "Seedance Reel (Video)",
  },
  ThreadsCard: {
    Component: ThreadsCard as unknown as AnyComp,
    defaults: defaultThreadsCardProps as unknown as Record<string, unknown>,
    width: 1080, height: 1350, fps: FPS,
    durationFromProps: () => 1,
    briefShape: "still",
    label: "Threads Card",
  },
};

export function getComposition(id: string): RegistryEntry | null {
  return compositionRegistry[id] ?? null;
}

// Silence unused-type warnings (props inferred via casts above).
void ({} as ThreadsCardProps);
