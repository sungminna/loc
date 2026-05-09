import { Composition, registerRoot } from "remotion";
import { Aurora, defaultAuroraProps } from "./compositions/Aurora";
import { Gummy, defaultGummyProps } from "./compositions/Gummy";
import { Zine, defaultZineProps } from "./compositions/Zine";
import { Kinetic, defaultKineticProps } from "./compositions/Kinetic";
import { Dossier, defaultDossierProps } from "./compositions/Dossier";
import { ThreadsCard, defaultThreadsCardProps } from "./compositions/ThreadsCard";
import { SeedanceReel, defaultSeedanceReelProps } from "./compositions/SeedanceReel";
import type { CardSlideProps, VideoReelProps } from "./types";

const FPS = 30;

// Remotion's Composition uses a zod schema for prop inference; we use plain
// TS types instead, so erase the schema-bound prop type with a cast.
type AnyComp = React.ComponentType<Record<string, unknown>>;

// Per-template slide duration (frames). Each template's pacing matches
// its visual register: Aurora's ambient fields hold longer, Gummy's
// tactile bounces snap quicker, Kinetic's type-fill needs time to morph.
export const SLIDE_FRAMES_BY_COMP: Record<string, number> = {
  Aurora: 168,
  Gummy: 156,
  Zine: 156,
  Kinetic: 156,
  Dossier: 162,
};

function cardMetadata(compositionId: string) {
  const slideFrames = SLIDE_FRAMES_BY_COMP[compositionId] ?? 156;
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
      {/* Aurora — Atmospheric Gradients (Cool Blue / Drama Club). */}
      <Composition
        id="Aurora" component={Aurora as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultAuroraProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("Aurora")}
      />

      {/* Gummy — Hyperreal 3D / Tactile / Gimme Gummy. */}
      <Composition
        id="Gummy" component={Gummy as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultGummyProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("Gummy")}
      />

      {/* Zine — Counterculture / Punk / Pick-and-Mix. */}
      <Composition
        id="Zine" component={Zine as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultZineProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("Zine")}
      />

      {/* Kinetic — Typographic Maximalism / Variable Weight Morph. */}
      <Composition
        id="Kinetic" component={Kinetic as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultKineticProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("Kinetic")}
      />

      {/* Dossier — Micrographics / Heritage / Blueprint. */}
      <Composition
        id="Dossier" component={Dossier as unknown as AnyComp}
        width={1080} height={1920} fps={FPS} durationInFrames={FPS * 24}
        defaultProps={defaultDossierProps as unknown as Record<string, unknown>}
        calculateMetadata={cardMetadata("Dossier")}
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
