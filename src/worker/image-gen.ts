// Worker-side image generation.
//
// Mirrors the sandbox `image-gen.ts` script but runs inside the Worker so
// the dashboard can re-roll a slide background on demand. Persists to R2
// (via env.MEDIA), records to the topic_assets table, and returns the
// public URL the editor should render.

import { createId } from "@paralleldrive/cuid2";
import { getDb } from "@db/client";
import { topicAssets } from "@db/schema";
import type { Env } from "@shared/env";

const REPLICATE_BASE = "https://api.replicate.com/v1";
const MODEL = "openai/gpt-image-2";

export interface GenImageInput {
  env: Env;
  userId: string;
  topicId: string;
  prompt: string;
  kind: "bg-slide" | "bg-threads" | "asset";
  slideIndex?: number;
  aspect: "1:1" | "3:2" | "2:3";
  quality: "low" | "medium" | "high" | "auto";
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string[];
  error?: string | null;
  urls?: { get?: string };
}

export async function generateImageForTopic(input: GenImageInput): Promise<{
  assetId: string;
  r2Key: string;
  url: string;
  bytes: number;
  mime: string;
  prompt: string;
}> {
  const token = input.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not configured");

  const body = {
    input: {
      prompt: input.prompt,
      aspect_ratio: input.aspect,
      number_of_images: 1,
      quality: input.quality,
      output_format: "webp",
      output_compression: 90,
      background: "auto",
      moderation: "auto",
      user_id: input.userId,
    },
  };

  // Sync mode via Prefer: wait — usually returns within 30-60s.
  const startRes = await fetch(`${REPLICATE_BASE}/models/${MODEL}/predictions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      prefer: "wait=60",
    },
    body: JSON.stringify(body),
  });
  const startText = await startRes.text();
  if (!startRes.ok) throw new Error(`Replicate ${startRes.status}: ${startText.slice(0, 500)}`);
  let prediction = JSON.parse(startText) as ReplicatePrediction;

  const deadline = Date.now() + 5 * 60 * 1000;
  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed" &&
    prediction.status !== "canceled" &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, 2500));
    const pollUrl = prediction.urls?.get ?? `${REPLICATE_BASE}/predictions/${prediction.id}`;
    const pollRes = await fetch(pollUrl, { headers: { authorization: `Bearer ${token}` } });
    if (!pollRes.ok) throw new Error(`Replicate poll ${pollRes.status}: ${(await pollRes.text()).slice(0, 200)}`);
    prediction = (await pollRes.json()) as ReplicatePrediction;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate prediction ${prediction.id} ended ${prediction.status}: ${prediction.error ?? ""}`);
  }
  const outputUrl = prediction.output?.[0];
  if (!outputUrl) throw new Error(`Replicate prediction ${prediction.id} returned no output`);

  const dl = await fetch(outputUrl);
  if (!dl.ok) throw new Error(`download ${outputUrl} → ${dl.status}`);
  const bytes = await dl.arrayBuffer();
  const mime = dl.headers.get("content-type") ?? "image/webp";
  const ext = mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpg" : "webp";

  const fileId = createId();
  const r2Key = `topics/${input.topicId}/${input.kind}/${fileId}.${ext}`;
  await input.env.MEDIA.put(r2Key, bytes, {
    httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000" },
  });

  const db = getDb(input.env.DB);
  const [row] = await db.insert(topicAssets).values({
    topicId: input.topicId,
    userId: input.userId,
    kind: input.kind,
    r2Key,
    mime,
    bytes: bytes.byteLength,
    prompt: input.prompt,
    slideIndex: input.slideIndex,
    meta: {
      provider: "replicate",
      model: MODEL,
      aspect: input.aspect,
      quality: input.quality,
      prediction_id: prediction.id,
    },
  }).returning();
  if (!row) throw new Error("failed to record topic_asset");

  return {
    assetId: row.id,
    r2Key,
    url: `${input.env.R2_PUBLIC_BASE}/${r2Key}`,
    bytes: bytes.byteLength,
    mime,
    prompt: input.prompt,
  };
}
