// R2 upload via the Worker's internal endpoint — no S3 creds needed.
// The sandbox PUTs file bytes; the Worker writes to MEDIA bucket using
// its native R2 binding.

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

const BASE = process.env.LOC_API_BASE!;
const KEY = process.env.LOC_INTERNAL_KEY!;
const RUN_ID = process.env.LOC_RUN_ID!;
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

export async function uploadFile(
  localPath: string,
  r2Key: string,
): Promise<{ url: string; bytes: number; mime: string }> {
  const buf = readFileSync(localPath);
  const stat = statSync(localPath);
  const mime = MIME[extname(localPath).toLowerCase()] ?? "application/octet-stream";
  const res = await fetch(`${BASE}/internal/r2/put?key=${encodeURIComponent(r2Key)}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${KEY}`,
      "loc-run-id": RUN_ID,
      "content-type": mime,
      "content-length": String(stat.size),
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload ${r2Key} → ${res.status} ${await res.text()}`);
  return { url: `${PUBLIC_BASE}/${r2Key}`, bytes: stat.size, mime };
}

export async function downloadFile(r2Key: string, localPath: string): Promise<void> {
  const url = `${PUBLIC_BASE}/${r2Key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  writeFileSync(localPath, buf);
}

export function publicUrl(r2Key: string): string {
  return `${PUBLIC_BASE}/${r2Key}`;
}
