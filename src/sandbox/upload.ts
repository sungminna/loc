// R2 upload helper. R2 supports the S3 API; we use @aws-sdk/client-s3 directly
// since Workers can't ship aws-sdk into sandbox. Sandbox is Node, so it works.

import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE!;

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};

export async function uploadFile(localPath: string, r2Key: string): Promise<{ url: string; bytes: number; mime: string }> {
  const buf = readFileSync(localPath);
  const stat = statSync(localPath);
  const mime = MIME[extname(localPath).toLowerCase()] ?? "application/octet-stream";
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: buf,
    ContentType: mime,
    CacheControl: "public, max-age=31536000",
  }));
  return { url: `${PUBLIC_BASE}/${r2Key}`, bytes: stat.size, mime };
}

export async function downloadFile(r2Key: string, localPath: string): Promise<void> {
  const url = `${PUBLIC_BASE}/${r2Key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const { writeFileSync } = await import("node:fs");
  writeFileSync(localPath, buf);
}

export function publicUrl(r2Key: string): string {
  return `${PUBLIC_BASE}/${r2Key}`;
}
