import { Composition, registerRoot } from "remotion";
import { CardNews, type CardNewsProps, defaultCardNewsProps } from "./compositions/CardNews";
import { ThreadsCard, type ThreadsCardProps, defaultThreadsCardProps } from "./compositions/ThreadsCard";
import { KineticType, defaultKineticTypeProps } from "./compositions/KineticType";
import { BoldEditorial, defaultBoldEditorialProps } from "./compositions/BoldEditorial";
import { MinimalGrid, defaultMinimalGridProps } from "./compositions/MinimalGrid";
import { NeoBrutalism, defaultNeoBrutalismProps } from "./compositions/NeoBrutalism";
import { GlassMorphism, defaultGlassMorphismProps } from "./compositions/GlassMorphism";
import { RetroVHS, defaultRetroVHSProps } from "./compositions/RetroVHS";
import { DataStory, defaultDataStoryProps } from "./compositions/DataStory";
import { QuoteSpotlight, defaultQuoteSpotlightProps } from "./compositions/QuoteSpotlight";
import { SeedanceReel, defaultSeedanceReelProps } from "./compositions/SeedanceReel";
import type { CardSlideProps, VideoReelProps } from "./types";

const FPS = 30;

// Remotion's Composition uses a zod schema for prop inference; we use plain
// TS types instead, so erase the schema-bound prop type with a cast.
type AnyComp = React.ComponentType<Record<string, unknown>>;

// Card-news compositions all share the same per-slide duration → expose
// a shared metadata calculator so a brief with N slides yields a 3N-second
// reel. Below is the base scene length each new composition sequences at.
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

function cardMetadata(compositionId: string) {
  const slideFrames = SLIDE_FRAMES_BY_COMP[compositionId] ?? 90;
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
      {/* original card-news template */}
      <Composition
        id="CardNews"
        component={CardNews as unknown as AnyComp}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={FPS * 18}
        defaultProps={defaultCardNewsProps as unknown as Record<string, unknown>}
        calculateMetadata={({ props }) => {
          const slides = (props as unknown as CardNewsProps).slides ?? [];
          return { durationInFrames: Math.max(FPS * 6, FPS * Math.max(1, slides.length) * 3) };
        }}
      />

      {/* new card-news templates */}
      <Composition
        id="KineticType" component={KineticType as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultKineticTypeProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("KineticType")}
      />
      <Composition
        id="BoldEditorial" component={BoldEditorial as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultBoldEditorialProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("BoldEditorial")}
      />
      <Composition
        id="MinimalGrid" component={MinimalGrid as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 18}
        defaultProps={defaultMinimalGridProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("MinimalGrid")}
      />
      <Composition
        id="NeoBrutalism" component={NeoBrutalism as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultNeoBrutalismProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("NeoBrutalism")}
      />
      <Composition
        id="GlassMorphism" component={GlassMorphism as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultGlassMorphismProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("GlassMorphism")}
      />
      <Composition
        id="RetroVHS" component={RetroVHS as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultRetroVHSProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("RetroVHS")}
      />
      <Composition
        id="DataStory" component={DataStory as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultDataStoryProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("DataStory")}
      />
      <Composition
        id="QuoteSpotlight" component={QuoteSpotlight as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultQuoteSpotlightProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("QuoteSpotlight")}
      />

      {/* new video reel template (Seedance 2.0) */}
      <Composition
        id="SeedanceReel" component={SeedanceReel as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 22}
        defaultProps={defaultSeedanceReelProps as unknown as Record<string, unknown>}
        calculateMetadata={videoMetadata}
      />

      {/* threads still */}
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

// Silence unused-type warnings — these props are referenced via casts above.
void ({} as ThreadsCardProps);

registerRoot(RemotionRoot);
