// Compose-time registry that lets the dashboard render any of our Remotion
// compositions inside <Player>. The components themselves are pure React +
// Remotion APIs (useCurrentFrame, Sequence, AbsoluteFill, OffthreadVideo,
// etc.) — all of which run in the browser inside @remotion/player.
//
// We don't import Root.tsx (which calls registerRoot, a no-op outside
// Remotion's renderer but adds dead weight to the dashboard bundle).

import type { ComponentType } from "react";
import { CardNews, defaultCardNewsProps, type CardNewsProps } from "@/remotion/compositions/CardNews";
import { ThreadsCard, defaultThreadsCardProps, type ThreadsCardProps } from "@/remotion/compositions/ThreadsCard";
import { KineticType, defaultKineticTypeProps } from "@/remotion/compositions/KineticType";
import { BoldEditorial, defaultBoldEditorialProps } from "@/remotion/compositions/BoldEditorial";
import { MinimalGrid, defaultMinimalGridProps } from "@/remotion/compositions/MinimalGrid";
import { NeoBrutalism, defaultNeoBrutalismProps } from "@/remotion/compositions/NeoBrutalism";
import { GlassMorphism, defaultGlassMorphismProps } from "@/remotion/compositions/GlassMorphism";
import { RetroVHS, defaultRetroVHSProps } from "@/remotion/compositions/RetroVHS";
import { DataStory, defaultDataStoryProps } from "@/remotion/compositions/DataStory";
import { QuoteSpotlight, defaultQuoteSpotlightProps } from "@/remotion/compositions/QuoteSpotlight";
import { SeedanceReel, defaultSeedanceReelProps } from "@/remotion/compositions/SeedanceReel";
import type { CardSlideProps, VideoReelProps } from "@/remotion/types";

// Player wants exact Component / props inferred together. Cast through
// `unknown` because each composition has a slightly different prop type.
type AnyComp = ComponentType<Record<string, unknown>>;

// Match Root.tsx — keep these in sync if you tune frames-per-slide there.
const SLIDE_FRAMES_BY_COMP: Record<string, number> = {
  CardNews: 90,
  KineticType: 96,
  BoldEditorial: 102,
  MinimalGrid: 90,
  NeoBrutalism: 96,
  GlassMorphism: 96,
  RetroVHS: 96,
  DataStory: 102,
  QuoteSpotlight: 108,
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
  const slideFrames = SLIDE_FRAMES_BY_COMP[compId] ?? 90;
  return Math.max(FPS * 6, slideFrames * Math.max(1, slides.length) + 12);
};

const videoDuration = (props: Record<string, unknown>) => {
  const scenes = (props as unknown as VideoReelProps).scenes ?? [];
  const total = scenes.reduce((acc, s) => acc + Math.max(1, Math.round((s.durationSec ?? 5) * FPS)), 0);
  return Math.max(FPS * 6, total);
};

export const compositionRegistry: Record<string, RegistryEntry> = {
  CardNews: {
    Component: CardNews as unknown as AnyComp,
    defaults: defaultCardNewsProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("CardNews"),
    briefShape: "card",
    label: "Card News (default)",
  },
  KineticType: {
    Component: KineticType as unknown as AnyComp,
    defaults: defaultKineticTypeProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("KineticType"),
    briefShape: "card",
    label: "Kinetic Type",
  },
  BoldEditorial: {
    Component: BoldEditorial as unknown as AnyComp,
    defaults: defaultBoldEditorialProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("BoldEditorial"),
    briefShape: "card",
    label: "Bold Editorial",
  },
  MinimalGrid: {
    Component: MinimalGrid as unknown as AnyComp,
    defaults: defaultMinimalGridProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("MinimalGrid"),
    briefShape: "card",
    label: "Minimal Grid",
  },
  NeoBrutalism: {
    Component: NeoBrutalism as unknown as AnyComp,
    defaults: defaultNeoBrutalismProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("NeoBrutalism"),
    briefShape: "card",
    label: "Neo Brutalism",
  },
  GlassMorphism: {
    Component: GlassMorphism as unknown as AnyComp,
    defaults: defaultGlassMorphismProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("GlassMorphism"),
    briefShape: "card",
    label: "Glass Morphism",
  },
  RetroVHS: {
    Component: RetroVHS as unknown as AnyComp,
    defaults: defaultRetroVHSProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("RetroVHS"),
    briefShape: "card",
    label: "Retro VHS",
  },
  DataStory: {
    Component: DataStory as unknown as AnyComp,
    defaults: defaultDataStoryProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("DataStory"),
    briefShape: "card",
    label: "Data Story",
  },
  QuoteSpotlight: {
    Component: QuoteSpotlight as unknown as AnyComp,
    defaults: defaultQuoteSpotlightProps as unknown as Record<string, unknown>,
    width: 1080, height: 1920, fps: FPS,
    durationFromProps: cardDuration("QuoteSpotlight"),
    briefShape: "card",
    label: "Quote Spotlight",
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
void ({} as CardNewsProps);
void ({} as ThreadsCardProps);
