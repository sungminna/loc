import { Composition, registerRoot } from "remotion";
import { CardNews, type CardNewsProps, defaultCardNewsProps } from "./compositions/CardNews";
import { ThreadsCard, type ThreadsCardProps, defaultThreadsCardProps } from "./compositions/ThreadsCard";

const FPS = 30;

// Remotion's Composition uses a zod schema for prop inference; we use plain
// TS types instead, so erase the schema-bound prop type with a cast.
type AnyComp = React.ComponentType<Record<string, unknown>>;

function RemotionRoot() {
  return (
    <>
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
