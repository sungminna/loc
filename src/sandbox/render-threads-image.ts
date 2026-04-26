// render-threads-image.ts — single-frame JPG for Threads.
//
// CLI:
//   bun src/sandbox/render-threads-image.ts \
//     --run-id <runId> \
//     --brief data/runs/<runId>/brief.json \
//     [--composition ThreadsCard]

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { uploadFile } from "./upload";
import { api } from "./lib/api";

interface Args { runId: string; briefPath: string; composition: string; outDir: string }

function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) if (argv[i]?.startsWith("--")) m.set(argv[i]!.slice(2), argv[++i] ?? "");
  const runId = m.get("run-id") ?? "";
  return {
    runId,
    briefPath: m.get("brief") ?? `data/runs/${runId}/brief.json`,
    composition: m.get("composition") ?? "ThreadsCard",
    outDir: m.get("out-dir") ?? `data/runs/${runId}`,
  };
}

interface Brief {
  brand: { handle: string; name: string };
  lang: "ko" | "en";
  threads: { headline: string; body?: string; bgImageR2Key?: string };
}

async function main(args: Args): Promise<void> {
  if (!args.runId) throw new Error("--run-id required");
  mkdirSync(args.outDir, { recursive: true });

  const brief = JSON.parse(readFileSync(args.briefPath, "utf8")) as Brief;
  const inputProps = {
    brand: brief.brand,
    lang: brief.lang,
    headline: brief.threads.headline,
    body: brief.threads.body,
    bgImageUrl: brief.threads.bgImageR2Key
      ? `${process.env.R2_PUBLIC_BASE}/${brief.threads.bgImageR2Key}`
      : undefined,
  };

  const serveUrl = await bundle({ entryPoint: "src/remotion/Root.tsx" });
  const composition = await selectComposition({ serveUrl, id: args.composition, inputProps });

  const out = join(args.outDir, "threads.jpg");
  await renderStill({
    serveUrl,
    composition,
    output: out,
    inputProps,
    imageFormat: "jpeg",
    jpegQuality: 92,
    frame: 0,
  });

  const r2Key = `runs/${args.runId}/threads.jpg`;
  const up = await uploadFile(out, r2Key);
  const asset = await api.recordAsset({
    runId: args.runId,
    kind: "threads-jpg",
    r2Key,
    mime: up.mime,
    bytes: up.bytes,
  });
  console.log(JSON.stringify({ r2Key, url: up.url, assetId: asset.asset.id }));
}

main(parseArgs(process.argv.slice(2))).catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
