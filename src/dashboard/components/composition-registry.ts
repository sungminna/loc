// Compose-time registry that lets the dashboard render any of our Remotion
// compositions inside <Player>. The components themselves are pure React +
// Remotion APIs — all of which run in the browser inside @remotion/player.
//
// We don't import Root.tsx (which calls registerRoot, a no-op outside
// Remotion's renderer but adds dead weight to the dashboard bundle).

import type { ComponentType } from "react";
import { Aurora, defaultAuroraProps } from "@/remotion/compositions/Aurora";
import { Gummy, defaultGummyProps } from "@/remotion/compositions/Gummy";
import { Zine, defaultZineProps } from "@/remotion/compositions/Zine";
import { Kinetic, defaultKineticProps } from "@/remotion/compositions/Kinetic";
import { Dossier, defaultDossierProps } from "@/remotion/compositions/Dossier";
import { ThreadsCard, defaultThreadsCardProps, type ThreadsCardProps } from "@/remotion/compositions/ThreadsCard";
import { SeedanceReel, defaultSeedanceReelProps } from "@/remotion/compositions/SeedanceReel";
import type { CardSlideProps, VideoReelProps } from "@/remotion/types";

// Player wants exact Component / props inferred together. Cast through
// `unknown` because each composition has a slightly different prop type.
type AnyComp = ComponentType<Record<string, unknown>>;

// Match Root.tsx — keep these in sync if you tune frames-per-slide there.
const SLIDE_FRAMES_BY_COMP: Record<string, number> = {
  Aurora: 168,
  Gummy: 156,
  Zine: 156,
  Kinetic: 156,
  Dossier: 162,
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
  const slideFrames = SLIDE_FRAMES_BY_COMP[compId] ?? 156;
  return Math.max(FPS * 6, slideFrames * Math.max(1, slides.length) + 12);
};

const videoDuration = (props: Record<string, unknown>) => {
  const scenes = (props as unknown as VideoReelProps).scenes ?? [];
  const total = scenes.reduce((acc, s) => acc + Math.max(1, Math.round((s.durationSec ?? 5) * FPS)), 0);
  return Math.max(FPS * 6, total);
};

export const compositionRegistry: Record<string, RegistryEntry> = {
  Aurora: {
    Component: Aurora as unknown as AnyComp,
    defaults: defaultAuroraProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("Aurora"),
    briefShape: "card",
    label: "Aurora — Atmospheric Gradient",
  },
  Gummy: {
    Component: Gummy as unknown as AnyComp,
    defaults: defaultGummyProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("Gummy"),
    briefShape: "card",
    label: "Gummy — Hyperreal 3D / Candy",
  },
  Zine: {
    Component: Zine as unknown as AnyComp,
    defaults: defaultZineProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("Zine"),
    briefShape: "card",
    label: "Zine — Counterculture / Pick-and-Mix",
  },
  Kinetic: {
    Component: Kinetic as unknown as AnyComp,
    defaults: defaultKineticProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("Kinetic"),
    briefShape: "card",
    label: "Kinetic — Typographic Maximalism",
  },
  Dossier: {
    Component: Dossier as unknown as AnyComp,
    defaults: defaultDossierProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("Dossier"),
    briefShape: "card",
    label: "Dossier — Micrographics / Blueprint",
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
