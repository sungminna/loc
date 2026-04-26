// gemini.ts — generate images via Gemini 2.5 Flash Image (Nano Banana)
//
// CLI:
//   bun src/sandbox/gemini.ts gen \
//     --prompt "minimalist editorial portrait" \
//     --aspect 9:16 \
//     --count 1 \
//     --out-dir data/runs/<runId>/img \
//     --run-id <runId> \
//     --kind gemini-bg
//
// Stdout (NDJSON): one JSON line per generated image: { r2Key, localPath, mime, bytes, assetId }

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { uploadFile } from "./upload";
import { api } from "./lib/api";

interface Args {
  prompt: string;
  aspect: "1:1" | "4:5" | "9:16" | "16:9" | "3:4";
  count: number;
  outDir: string;
  runId: string;
  kind: "gemini-bg" | "thumb" | "threads-jpg";
}

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]?.startsWith("--")) {
      const key = argv[i]!.slice(2);
      map.set(key, argv[++i] ?? "");
    }
  }
  return {
    prompt: map.get("prompt") ?? "",
    aspect: (map.get("aspect") ?? "9:16") as Args["aspect"],
    count: Number(map.get("count") ?? "1"),
    outDir: map.get("out-dir") ?? "/tmp/gemini",
    runId: map.get("run-id") ?? "",
    kind: (map.get("kind") ?? "gemini-bg") as Args["kind"],
  };
}

async function generate(args: Args): Promise<void> {
  if (!args.prompt) throw new Error("--prompt required");
  if (!args.runId) throw new Error("--run-id required");

  if (!process.env.GEMINI_API_KEY) {
    // Soft-fail: orchestrate-run treats this as "skip background image"
    console.error("GEMINI_API_KEY not set — skipping image generation");
    process.exit(0);
  }

  mkdirSync(args.outDir, { recursive: true });

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: process.env.AI_GATEWAY_BASE
      ? { baseUrl: `${process.env.AI_GATEWAY_BASE}/google-ai-studio` }
      : undefined,
  });

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-image";

  for (let i = 0; i < args.count; i++) {
    const resp = await ai.models.generateContent({
      model,
      contents: args.prompt,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: args.aspect, imageSize: "2K" },
      },
    });

    const parts = resp.candidates?.[0]?.content?.parts ?? [];
    const inlineData = parts.find((p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData)?.inlineData;
    if (!inlineData?.data) {
      throw new Error(`Gemini returned no image (idx=${i})`);
    }
    const bytes = Buffer.from(inlineData.data, "base64");
    const ext = inlineData.mimeType === "image/jpeg" ? "jpg" : "png";
    const fileName = `${args.kind}-${i.toString().padStart(2, "0")}.${ext}`;
    const localPath = join(args.outDir, fileName);
    writeFileSync(localPath, bytes);

    const r2Key = `runs/${args.runId}/${args.kind}/${fileName}`;
    const { url, bytes: size, mime } = await uploadFile(localPath, r2Key);

    const { asset } = await api.recordAsset({
      runId: args.runId,
      kind: args.kind,
      r2Key,
      mime,
      bytes: size,
      meta: { prompt: args.prompt, aspect: args.aspect, model },
    });

    console.log(JSON.stringify({ assetId: asset.id, r2Key, url, localPath, bytes: size, mime }));
  }
}

const cmd = process.argv[2];
const argv = process.argv.slice(3);

if (cmd === "gen") {
  generate(parseArgs(argv)).catch((e) => {
    console.error(e instanceof Error ? e.stack : String(e));
    process.exit(1);
  });
} else {
  console.error("usage: bun src/sandbox/gemini.ts gen --prompt ... --aspect 9:16 --count 1 --out-dir ... --run-id ... --kind gemini-bg");
  process.exit(2);
}
