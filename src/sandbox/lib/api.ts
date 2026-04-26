// Tiny client used by sandbox scripts to call the Worker's internal REST API.

const BASE = process.env.LOC_API_BASE!;
const KEY = process.env.LOC_INTERNAL_KEY!;
const RUN_ID = process.env.LOC_RUN_ID!;

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${KEY}`,
      "loc-run-id": RUN_ID,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const api = {
  getTopic: (id: string) => call<{ topic: unknown }>("GET", `/internal/topic?id=${id}`),
  getRun: (id: string) => call<{ run: unknown }>("GET", `/internal/run?id=${id}`),
  setRunStatus: (runId: string, status: string, error?: string) =>
    call("POST", "/internal/run/status", { runId, status, error }),
  setBrief: (runId: string, brief: Record<string, unknown>) =>
    call("POST", "/internal/run/brief", { runId, brief }),
  recordAsset: (data: {
    runId: string; kind: string; r2Key: string; mime: string; bytes: number; meta?: Record<string, unknown>;
  }) => call<{ asset: { id: string } }>("POST", "/internal/asset", data),
  recordPost: (data: {
    runId: string; accountId: string; templateSlug?: string; platform: "instagram" | "threads";
    mediaType: "reel" | "photo" | "carousel" | "text"; caption: string; lang: "ko" | "en";
    assetKeys: string[]; audioTrackId?: string;
  }) => call<{ post: { id: string } }>("POST", "/internal/post", data),
  updatePost: (data: { id: string; remoteId?: string; permalink?: string; status?: "pending" | "published" | "failed"; errorMessage?: string; publishedAt?: number }) =>
    call("POST", "/internal/post/update", data),
  recordResearchNote: (data: { topicId: string; runId?: string; sourceUrl: string; title?: string; summary?: string; rawText?: string }) =>
    call("POST", "/internal/research-note", data),
  listAudio: () => call<{ tracks: AudioTrackJson[] }>("GET", "/internal/audio/list"),
  touchAudio: (id: string) => call("POST", "/internal/audio/touch", { id }),
  getTemplate: (slug: string) => call<{ template: TemplateJson | null }>("GET", `/internal/template?slug=${slug}`),
  getSkillPrompts: () => call<{ overrides: Record<string, string> }>("GET", "/internal/skill-prompts"),
  getTopicDraft: () => call<{ useDraft: boolean; draft: unknown | null; imageStylePrompt: string }>("GET", "/internal/topic/draft"),
  consumeTopicDraft: () => call("POST", "/internal/topic/draft/consume"),
};

export interface AudioTrackJson {
  id: string;
  name: string;
  artist: string | null;
  source: "ncs" | "upload" | "suno";
  r2Key: string;
  durationSec: number;
  bpm: number | null;
  moodTags: string[];
  attributionText: string | null;
  lastUsedAt: string | number | null; // ISO string from JSON, or epoch ms
  enabled: boolean;
}

export function toMs(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

export interface TemplateJson {
  id: string;
  slug: string;
  name: string;
  kind: "reel-cards" | "reel-animated" | "reel-video" | "threads-photo";
  platform: "instagram" | "threads";
  compositionId: string;
  schema: Record<string, unknown>;
  defaults: Record<string, unknown>;
  defaultAudioMood: string[];
  durationSec: number;
  bgMode: "ai" | "default-image";
  defaultBgR2Key: string;
  bgPromptTemplate: string;
  accentColor: string;
}

export interface TopicJson {
  id: string;
  name: string;
  lang: "ko" | "en" | "ko+en";
  personaPrompt: string;
  imageStylePrompt: string;
  sourceUrls: string[];
  targetAccounts: { instagram?: string; threads?: string };
  templateSlugs: string[];
  audioPrefs: { moodTags?: string[]; allowedSources?: string[]; fixedTrackId?: string };
  cron: string;
  imageMode: "ai-all" | "ai-first-only" | "template-only";
  threadsFormat: "text" | "image";
  hashtagMode: "ai" | "fixed" | "mixed";
  fixedHashtags: string[];
}
