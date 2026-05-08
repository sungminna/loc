import { Composition, registerRoot } from "remotion";
import { Editorial, defaultEditorialProps } from "./compositions/Editorial";
import { Monocle, defaultMonocleProps } from "./compositions/Monocle";
import { Riso, defaultRisoProps } from "./compositions/Riso";
import { Cover, defaultCoverProps } from "./compositions/Cover";
import { Index032c, defaultIndex032cProps } from "./compositions/Index032c";
import { ThreadsCard, defaultThreadsCardProps } from "./compositions/ThreadsCard";
import { SeedanceReel, defaultSeedanceReelProps } from "./compositions/SeedanceReel";
import type { CardSlideProps, VideoReelProps } from "./types";

const FPS = 30;

// Remotion's Composition uses a zod schema for prop inference; we use plain
// TS types instead, so erase the schema-bound prop type with a cast.
type AnyComp = React.ComponentType<Record<string, unknown>>;

// Per-template slide duration (frames). The deck "magazine read" pacing
// matters: editorial spreads sit longer (you read body), Index snaps
// faster (ticker rhythm), Cover holds longest (one quote per slide).
const SLIDE_FRAMES_BY_COMP: Record<string, number> = {
  Editorial: 156,
  Monocle: 162,
  Riso: 156,
  Cover: 168,
  Index032c: 150,
};

function cardMetadata(compositionId: string) {
  const slideFrames = SLIDE_FRAMES_BY_COMP[compositionId] ?? 150;
  return ({ props }: { props: unknown }) => {
    const slides = (props as CardSlideProps).slides ?? [];
    return { durationInFrames: Math.max(FPS * 6, slideFrames * Math.max(1, slides.length) + 12) };
  };
}

function videoMetadata({ props }: { props: unknown }) {
  const scenes = (props as VideoReelProps).scenes ?? [];
  const total = scenes.reduce((acc, s) => acc + Math.max(1, Math.round((s.durationSec ?? 5) * FPS)), 0);
  return { durationInFrames: Math.max(FPS * 6, total) };
}

function RemotionRoot() {
  return (
    <>
      {/* Editorial — NYT Magazine / The New Yorker / Cereal lineage. */}
      <Composition
        id="Editorial" component={Editorial as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultEditorialProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("Editorial")}
      />

      {/* Monocle — Monocle / Bloomberg Businessweek / FT Weekend. */}
      <Composition
        id="Monocle" component={Monocle as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultMonocleProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("Monocle")}
      />

      {/* Riso — RISOTTO Studio / Print magazine / Bloomberg-collage. */}
      <Composition
        id="Riso" component={Riso as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultRisoProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("Riso")}
      />

      {/* Cover — Vogue / W / Numéro fashion-cover lineage. */}
      <Composition
        id="Cover" component={Cover as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultCoverProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("Cover")}
      />

      {/* Index — Wallpaper* / 032c / Index magazine. */}
      <Composition
        id="Index032c" component={Index032c as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultIndex032cProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("Index032c")}
      />

      {/* Video reel (Seedance 2.0) */}
      <Composition
        id="SeedanceReel" component={SeedanceReel as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 22}
        defaultProps={defaultSeedanceReelProps as unknown as Record<string, unknown>}
        calculateMetadata={videoMetadata}
      />

      {/* Threads still */}
      <Composition
        id="ThreadsCard"
        component={ThreadsCard as unknown as AnyComp}
        width={1080}
        height={1350}
        fps={FPS}
        durationInFrames={1}
        defaultProps={defaultThreadsCardProps as unknown as Record<string, unknown>}
      />
    </>
  );
}

registerRoot(RemotionRoot);
