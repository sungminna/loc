import { bundle } from "@remotion/bundler";
import { selectComposition } from "@remotion/renderer";

const ids = [
  "CardNews", "ThreadsCard",
  "KineticType", "BoldEditorial", "MinimalGrid",
  "NeoBrutalism", "GlassMorphism", "RetroVHS",
  "DataStory", "QuoteSpotlight", "SeedanceReel",
];

const serveUrl = await bundle({
  entryPoint: "src/remotion/Root.tsx",
  webpackOverride: (c) => c,
});

let fail = 0;
for (const id of ids) {
  try {
    const comp = await selectComposition({ serveUrl, id });
    console.log(`  ok  ${id.padEnd(18)} ${comp.width}x${comp.height}  ${comp.fps}fps  ${comp.durationInFrames}f`);
  } catch (e) {
    fail++;
    console.error(`  FAIL ${id}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
process.exit(fail > 0 ? 1 : 0);
