import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

const id = () => text("id").primaryKey().$defaultFn(() => createId());
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());
const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

// ─────────────────────────────────────────────────────────────────────
// users — Cloudflare Access identities. Auto-provisioned on first login.
// ─────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  costCapDailyUsd: integer("cost_cap_daily_usd").notNull().default(20),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─────────────────────────────────────────────────────────────────────
// accounts — IG/Threads identities. Tokens stored in KV (encrypted).
// ─────────────────────────────────────────────────────────────────────
export const accounts = sqliteTable("accounts", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform", { enum: ["instagram", "threads"] }).notNull(),
  handle: text("handle").notNull(),
  igUserId: text("ig_user_id"),
  threadsUserId: text("threads_user_id"),
  tokenKvKey: text("token_kv_key").notNull(),
  tokenExpiresAt: integer("token_expires_at", { mode: "timestamp_ms" }),
  refreshedAt: integer("refreshed_at", { mode: "timestamp_ms" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  userIdx: index("accounts_user_idx").on(t.userId, t.platform),
}));

// ─────────────────────────────────────────────────────────────────────
// topics — what to post about, when, with what voice
// ─────────────────────────────────────────────────────────────────────
export type AudioPrefs = {
  moodTags?: string[];
  allowedSources?: ("ncs" | "upload" | "suno")[];
  fixedTrackId?: string;
};

// A storyboard "draft" — the next brief the orchestrator should render
// instead of regenerating from scratch. Mirrors the brief.json shape that
// content-plan would otherwise emit, but the user has hand-edited it here.
export type DraftBrief = {
  topic?: { headline?: string; angle?: string };
  slides?: Array<{
    kicker?: string;
    headline?: string;
    body?: string;
    emphasis?: string;
    bgImageUrl?: string;
    bgImageR2Key?: string;
    bgImagePrompt?: string;
  }>;
  // Optional video reel storyboard — used when the chosen template's
  // compositionId expects a SeedanceReel-style brief. Each scene becomes
  // one Seedance 2.0 prediction; the rendered MP4s are stitched together
  // by the SeedanceReel composition with infographic overlay.
  video?: {
    scenes?: Array<{
      kicker?: string;
      headline?: string;
      body?: string;
      stat?: { value?: string; label?: string };
      // Seedance 2.0 inputs
      videoPrompt?: string;
      durationSec?: number;       // 3-12, or -1 for adaptive
      aspectRatio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive";
      resolution?: "480p" | "720p";
      generateAudio?: boolean;
      seed?: number;
      cameraMove?: string;        // free-form, gets baked into the prompt
      mood?: string;
      // gpt-image-2 reference for character/style consistency
      firstFrameImagePrompt?: string;
      firstFrameImageR2Key?: string;
      lastFrameImagePrompt?: string;
      lastFrameImageR2Key?: string;
      // post-generation asset
      videoR2Key?: string;
    }>;
  };
  threads?: { text?: string; bgImageUrl?: string; bgImageR2Key?: string; bgImagePrompt?: string };
  caption?: { instagram?: string; threads?: string };
  hashtags?: string[];
  // Threads-only single indexed tag (Meta's `topic_tag` param). Distinct
  // from inline `#` hashtags inside the post text.
  threadsTopicTag?: string;
};

export const IMAGE_MODES = ["ai-all", "ai-first-only", "template-only"] as const;
export type ImageMode = (typeof IMAGE_MODES)[number];

export const THREADS_FORMATS = ["text", "image"] as const;
export type ThreadsFormat = (typeof THREADS_FORMATS)[number];

export const HASHTAG_MODES = ["ai", "fixed", "mixed"] as const;
export type HashtagMode = (typeof HASHTAG_MODES)[number];

export const topics = sqliteTable("topics", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  lang: text("lang", { enum: ["ko", "en", "ko+en"] }).notNull().default("ko"),
  personaPrompt: text("persona_prompt").notNull().default(""),
  sourceUrls: text("source_urls", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  targetAccounts: text("target_accounts", { mode: "json" })
    .$type<{ instagram?: string; threads?: string }>()
    .notNull()
    .default(sql`'{}'`),
  templateSlugs: text("template_slugs", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  audioPrefs: text("audio_prefs", { mode: "json" }).$type<AudioPrefs>().notNull().default(sql`'{}'`),
  cron: text("cron").notNull().default("0 9 * * *"),
  nextRunAt: integer("next_run_at", { mode: "timestamp_ms" }),
  dailyRunCap: integer("daily_run_cap").notNull().default(1),
  costCapUsd: integer("cost_cap_usd").notNull().default(5),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  imageStylePrompt: text("image_style_prompt").notNull().default(""),
  draftBrief: text("draft_brief", { mode: "json" }).$type<DraftBrief | null>(),
  useDraftForNext: integer("use_draft_for_next", { mode: "boolean" }).notNull().default(false),
  // How aggressively the orchestrator should AI-generate slide backgrounds.
  // ai-all: every slide uses gpt-image-2. ai-first-only: slide 0 only,
  // others fall back to template.defaultBgR2Key (or gradient). template-only:
  // never call gpt-image-2; all slides use the template's static bg.
  imageMode: text("image_mode", { enum: IMAGE_MODES }).notNull().default("ai-first-only"),
  // Threads can be plain-text or text-with-image. Independent of the IG
  // template choice — a topic with both targets renders Reels for IG and a
  // Threads post in this shape.
  threadsFormat: text("threads_format", { enum: THREADS_FORMATS }).notNull().default("image"),
  // Hashtag composition strategy. ai: AI generates fresh per-run.
  // fixed: only `fixedHashtags` is appended. mixed: AI + fixed merged.
  hashtagMode: text("hashtag_mode", { enum: HASHTAG_MODES }).notNull().default("ai"),
  fixedHashtags: text("fixed_hashtags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  userIdx: index("topics_user_idx").on(t.userId),
  dueIdx: index("topics_due_idx").on(t.enabled, t.nextRunAt),
}));

// ─────────────────────────────────────────────────────────────────────
// templates — Remotion compositions registered as content templates
// (built-in templates have userId = NULL → shared across all users)
// ─────────────────────────────────────────────────────────────────────
export const TRANSITION_PRESETS = ["fade", "slide-up", "zoom", "kenburns", "none"] as const;
export type TransitionPreset = (typeof TRANSITION_PRESETS)[number];

export const TEMPLATE_KINDS = ["reel-cards", "reel-animated", "reel-video", "threads-photo"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const TEMPLATE_PLATFORMS = ["instagram", "threads"] as const;
export type TemplatePlatform = (typeof TEMPLATE_PLATFORMS)[number];

export const TEMPLATE_BG_MODES = ["ai", "default-image"] as const;
export type TemplateBgMode = (typeof TEMPLATE_BG_MODES)[number];

export const templates = sqliteTable("templates", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  kind: text("kind", { enum: TEMPLATE_KINDS }).notNull(),
  // Which platform this template targets. Derived once from kind at seed
  // time, but stored explicitly so the dashboard can group templates and
  // the orchestrator can reject a mismatched topic→template mapping.
  platform: text("platform", { enum: TEMPLATE_PLATFORMS }).notNull().default("instagram"),
  compositionId: text("composition_id").notNull(),
  schema: text("schema", { mode: "json" }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
  defaults: text("defaults", { mode: "json" }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
  defaultAudioMood: text("default_audio_mood", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  previewKey: text("preview_key"),
  durationSec: integer("duration_sec").notNull().default(18),
  version: integer("version").notNull().default(1),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  accentColor: text("accent_color").notNull().default("#facc15"),
  bgPromptTemplate: text("bg_prompt_template").notNull().default(""),
  transitionPreset: text("transition_preset", { enum: TRANSITION_PRESETS }).notNull().default("fade"),
  // Default background behavior. `ai` = orchestrator generates per-slide
  // backgrounds via gpt-image-2 (current default). `default-image` = use
  // `defaultBgR2Key` as the static background for every slide; the
  // orchestrator skips image-gen entirely and topics with imageMode=ai-*
  // can still opt back into AI for some/all slides.
  bgMode: text("bg_mode", { enum: TEMPLATE_BG_MODES }).notNull().default("ai"),
  defaultBgR2Key: text("default_bg_r2_key").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  userSlugIdx: index("templates_user_slug_idx").on(t.userId, t.slug),
}));

// ─────────────────────────────────────────────────────────────────────
// audio_tracks — BGM library (userId NULL = shared/global)
// ─────────────────────────────────────────────────────────────────────
export const audioTracks = sqliteTable("audio_tracks", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  artist: text("artist"),
  source: text("source", { enum: ["ncs", "upload", "suno"] }).notNull(),
  r2Key: text("r2_key").notNull(),
  durationSec: integer("duration_sec").notNull(),
  bpm: integer("bpm"),
  moodTags: text("mood_tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  licenseUrl: text("license_url"),
  attributionText: text("attribution_text"),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  sourceIdx: index("audio_source_idx").on(t.source),
  userIdx: index("audio_user_idx").on(t.userId),
}));

// ─────────────────────────────────────────────────────────────────────
// runs — one autonomous Claude execution. userId derived via topic.
// ─────────────────────────────────────────────────────────────────────
export const RUN_STATUSES = [
  "planned",
  "researching",
  "planning",
  "generating",
  "rendering",
  "publishing",
  "done",
  "failed",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const runs = sqliteTable("runs", {
  id: id(),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: RUN_STATUSES }).notNull().default("planned"),
  claudeSessionId: text("claude_session_id"),
  costUsdMicros: integer("cost_usd_micros").notNull().default(0),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  error: text("error"),
  briefJson: text("brief_json", { mode: "json" }).$type<Record<string, unknown>>(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  userIdx: index("runs_user_idx").on(t.userId, t.createdAt),
  topicIdx: index("runs_topic_idx").on(t.topicId, t.createdAt),
  statusIdx: index("runs_status_idx").on(t.status),
}));

// ─────────────────────────────────────────────────────────────────────
// posts — actual publications
// ─────────────────────────────────────────────────────────────────────
export const posts = sqliteTable("posts", {
  id: id(),
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  templateSlug: text("template_slug"),
  platform: text("platform", { enum: ["instagram", "threads"] }).notNull(),
  mediaType: text("media_type", { enum: ["reel", "photo", "carousel", "text"] }).notNull(),
  caption: text("caption").notNull(),
  lang: text("lang", { enum: ["ko", "en"] }).notNull(),
  assetKeys: text("asset_keys", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  audioTrackId: text("audio_track_id"),
  remoteId: text("remote_id"),
  permalink: text("permalink"),
  status: text("status", { enum: ["pending", "published", "failed"] }).notNull().default("pending"),
  errorMessage: text("error_message"),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  userIdx: index("posts_user_idx").on(t.userId, t.createdAt),
  runIdx: index("posts_run_idx").on(t.runId),
  publishedIdx: index("posts_published_idx").on(t.publishedAt),
}));

// ─────────────────────────────────────────────────────────────────────
// metrics — time-series performance
// ─────────────────────────────────────────────────────────────────────
export const metrics = sqliteTable("metrics", {
  id: id(),
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  saves: integer("saves").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  raw: text("raw", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (t) => ({
  postIdx: index("metrics_post_idx").on(t.postId, t.fetchedAt),
}));

// ─────────────────────────────────────────────────────────────────────
// assets — generated artifacts (R2-backed)
// ─────────────────────────────────────────────────────────────────────
export const assets = sqliteTable("assets", {
  id: id(),
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  kind: text("kind", {
    enum: ["image-bg", "slide-png", "reel-mp4", "thumb", "threads-jpg", "audio-mix", "seedance-mp4", "video-frame"],
  }).notNull(),
  r2Key: text("r2_key").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull().default(0),
  meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (t) => ({
  runIdx: index("assets_run_idx").on(t.runId),
}));

// ─────────────────────────────────────────────────────────────────────
// research_notes
// ─────────────────────────────────────────────────────────────────────
export const researchNotes = sqliteTable("research_notes", {
  id: id(),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
  sourceUrl: text("source_url").notNull(),
  title: text("title"),
  summary: text("summary"),
  rawText: text("raw_text"),
  createdAt: createdAt(),
}, (t) => ({
  topicIdx: index("research_topic_idx").on(t.topicId, t.createdAt),
}));

// ─────────────────────────────────────────────────────────────────────
// skill_prompts — per-user override appended to a Skill's instruction.
// Persisted in D1 so survives redeploys; sandbox reads via internal API.
// ─────────────────────────────────────────────────────────────────────
export const SKILL_NAMES = [
  "topic-research",
  "content-plan",
  "image-gen",
  "select-audio",
  "render-reel",
  "render-threads-image",
  "ig-publish-reel",
  "threads-publish",
  "orchestrate-run",
] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

export const skillPrompts = sqliteTable("skill_prompts", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  skillName: text("skill_name", { enum: SKILL_NAMES }).notNull(),
  override: text("override").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  userSkillIdx: index("skill_prompts_user_skill_idx").on(t.userId, t.skillName),
}));

// ─────────────────────────────────────────────────────────────────────
// topic_assets — dashboard-generated images, decoupled from runs.
// User can re-roll a slide bg before any run exists; later picked up
// by the storyboard draft and replayed by the orchestrator.
// ─────────────────────────────────────────────────────────────────────
export const topicAssets = sqliteTable("topic_assets", {
  id: id(),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["bg-slide", "bg-threads", "asset"] }).notNull(),
  r2Key: text("r2_key").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull().default(0),
  prompt: text("prompt").notNull().default(""),
  slideIndex: integer("slide_index"),
  meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (t) => ({
  topicIdx: index("topic_assets_topic_idx").on(t.topicId, t.createdAt),
}));

// ─────────────────────────────────────────────────────────────────────
// oauth_states — one-shot CSRF token; ties OAuth flow to initiating user
// ─────────────────────────────────────────────────────────────────────
export const oauthStates = sqliteTable("oauth_states", {
  state: text("state").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform", { enum: ["instagram", "threads"] }).notNull(),
  redirectUri: text("redirect_uri").notNull(),
  meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type AudioTrack = typeof audioTracks.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type SkillPrompt = typeof skillPrompts.$inferSelect;
export type TopicAsset = typeof topicAssets.$inferSelect;
