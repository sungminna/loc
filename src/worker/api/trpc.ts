import { initTRPC, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { z } from "zod";
import { eq, desc, and, isNull, or, inArray } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";
import {
  topics, templates, accounts, audioTracks, posts, runs, assets,
  researchNotes, skillPrompts, topicAssets, SKILL_NAMES, TRANSITION_PRESETS,
  TEMPLATE_KINDS, TEMPLATE_PLATFORMS, TEMPLATE_BG_MODES,
  IMAGE_MODES, THREADS_FORMATS, HASHTAG_MODES,
  type Account,
} from "@db/schema";
import type { Env } from "@shared/env";
import { authenticate, type AuthCtx } from "../auth";
import { generateImageForTopic } from "../image-gen";

const t = initTRPC.context<AuthCtx>().create({ transformer: superjson });

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx });
});

const proc = t.procedure.use(isAuthed);

// ─── Helpers ─────────────────────────────────────────────────────────

async function ownedTopic(ctx: AuthCtx, id: string) {
  const row = await ctx.db.query.topics.findFirst({ where: eq(topics.id, id) });
  if (!row || row.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
  return row;
}
async function ownedTemplate(ctx: AuthCtx, id: string) {
  const row = await ctx.db.query.templates.findFirst({ where: eq(templates.id, id) });
  if (!row || row.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
  return row;
}
async function ownedAccount(ctx: AuthCtx, id: string): Promise<Account> {
  const row = await ctx.db.query.accounts.findFirst({ where: eq(accounts.id, id) });
  if (!row || row.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
  return row;
}
async function ownedAudio(ctx: AuthCtx, id: string) {
  const row = await ctx.db.query.audioTracks.findFirst({ where: eq(audioTracks.id, id) });
  if (!row || row.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
  return row;
}

// A slug is unique across the user's own templates AND the shared (userId=null)
// pool — sandbox/select-template lookups go by slug alone, so collisions
// would route the wrong template at render time.
async function ensureSlugFree(ctx: AuthCtx, slug: string): Promise<void> {
  const existing = await ctx.db.query.templates.findFirst({
    where: and(
      eq(templates.slug, slug),
      or(isNull(templates.userId), eq(templates.userId, ctx.user.id)),
    ),
  });
  if (existing) {
    throw new TRPCError({ code: "CONFLICT", message: `slug "${slug}" already in use` });
  }
}

// ─── Schemas ─────────────────────────────────────────────────────────

const audioPrefsSchema = z.object({
  moodTags: z.array(z.string()).optional(),
  allowedSources: z.array(z.enum(["ncs", "upload", "suno"])).optional(),
  fixedTrackId: z.string().optional(),
});

const cronStringSchema = z.string().refine((s) => {
  try { CronExpressionParser.parse(s); return true; } catch { return false; }
}, "Invalid cron expression");

const topicInputSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  lang: z.enum(["ko", "en", "ko+en"]).default("ko"),
  personaPrompt: z.string().max(2000).default(""),
  sourceUrls: z.array(z.string().url()).max(10).default([]),
  targetAccounts: z.object({ instagram: z.string().optional(), threads: z.string().optional() }).default({}),
  templateSlugs: z.array(z.string()).max(10).default([]),
  audioPrefs: audioPrefsSchema.default({}),
  cron: cronStringSchema.default("0 9 * * *"),
  dailyRunCap: z.number().int().min(1).max(20).default(1),
  costCapUsd: z.number().int().min(1).max(100).default(5),
  enabled: z.boolean().default(true),
  imageStylePrompt: z.string().max(1000).default(""),
  imageMode: z.enum(IMAGE_MODES).default("ai-all"),
  threadsFormat: z.enum(THREADS_FORMATS).default("image"),
  hashtagMode: z.enum(HASHTAG_MODES).default("ai"),
  fixedHashtags: z.array(z.string().min(1).max(60)).max(30).default([]),
});

const templateInputSchema = z.object({
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "kebab-case only"),
  name: z.string().min(1).max(80),
  kind: z.enum(TEMPLATE_KINDS),
  platform: z.enum(TEMPLATE_PLATFORMS).default("instagram"),
  compositionId: z.string().min(1).max(60),
  schema: z.record(z.unknown()).default({}),
  defaults: z.record(z.unknown()).default({}),
  defaultAudioMood: z.array(z.string()).default([]),
  durationSec: z.number().int().min(3).max(90).default(18),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "hex color #RRGGBB").default("#facc15"),
  bgPromptTemplate: z.string().max(2000).default(""),
  transitionPreset: z.enum(TRANSITION_PRESETS).default("fade"),
  bgMode: z.enum(TEMPLATE_BG_MODES).default("ai"),
  defaultBgR2Key: z.string().max(255).default(""),
});

const slideSchema = z.object({
  kicker: z.string().optional(),
  headline: z.string().optional(),
  body: z.string().optional(),
  emphasis: z.string().optional(),
  bgImageUrl: z.string().optional(),
  bgImageR2Key: z.string().optional(),
  bgImagePrompt: z.string().optional(),
});

const videoSceneSchema = z.object({
  kicker: z.string().optional(),
  chapter: z.string().optional(),
  headline: z.string().optional(),
  body: z.string().optional(),
  stat: z.object({
    value: z.string().optional(),
    label: z.string().optional(),
    suffix: z.string().optional(),
  }).optional(),
  videoPrompt: z.string().optional(),
  durationSec: z.number().optional(),
  aspectRatio: z.enum(["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"]).optional(),
  resolution: z.enum(["480p", "720p"]).optional(),
  generateAudio: z.boolean().optional(),
  seed: z.number().optional(),
  cameraMove: z.string().optional(),
  mood: z.string().optional(),
  firstFrameImagePrompt: z.string().optional(),
  firstFrameImageR2Key: z.string().optional(),
  lastFrameImagePrompt: z.string().optional(),
  lastFrameImageR2Key: z.string().optional(),
  videoR2Key: z.string().optional(),
});

const draftBriefSchema = z.object({
  topic: z.object({ headline: z.string().optional(), angle: z.string().optional() }).optional(),
  slides: z.array(slideSchema).max(20).optional(),
  video: z.object({
    scenes: z.array(videoSceneSchema).max(10).optional(),
  }).optional(),
  threads: z.object({
    text: z.string().optional(),
    bgImageUrl: z.string().optional(),
    bgImageR2Key: z.string().optional(),
    bgImagePrompt: z.string().optional(),
  }).optional(),
  caption: z.object({ instagram: z.string().optional(), threads: z.string().optional() }).optional(),
  hashtags: z.array(z.string()).optional(),
  threadsTopicTag: z.string().max(50).optional(),
});

const audioInputSchema = z.object({
  name: z.string().min(1).max(120),
  artist: z.string().max(120).optional(),
  source: z.enum(["ncs", "upload", "suno"]),
  r2Key: z.string().min(1).max(255),
  durationSec: z.number().int().positive(),
  bpm: z.number().int().positive().optional(),
  moodTags: z.array(z.string()).default([]),
  licenseUrl: z.string().url().optional(),
  attributionText: z.string().max(300).optional(),
});

// ─── Router ──────────────────────────────────────────────────────────

export const appRouter = t.router({
  me: proc.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.name,
    role: ctx.user.role,
  })),

  topics: t.router({
    list: proc.query(async ({ ctx }) =>
      ctx.db.query.topics.findMany({
        where: eq(topics.userId, ctx.user.id),
        orderBy: [desc(topics.createdAt)],
      })),
    get: proc.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const topic = await ownedTopic(ctx, input.id);
      const [recentRuns, recentNotes, topicAssetsRows] = await Promise.all([
        ctx.db.query.runs.findMany({
          where: eq(runs.topicId, topic.id),
          orderBy: [desc(runs.createdAt)],
          limit: 20,
        }),
        ctx.db.query.researchNotes.findMany({
          where: eq(researchNotes.topicId, topic.id),
          orderBy: [desc(researchNotes.createdAt)],
          limit: 30,
        }),
        ctx.db.query.topicAssets.findMany({
          where: eq(topicAssets.topicId, topic.id),
          orderBy: [desc(topicAssets.createdAt)],
          limit: 60,
        }),
      ]);
      const runIds = recentRuns.map((r) => r.id);
      const postsForTopic = runIds.length
        ? await ctx.db.query.posts.findMany({
          where: and(eq(posts.userId, ctx.user.id), inArray(posts.runId, runIds)),
          orderBy: [desc(posts.createdAt)],
          limit: 60,
        })
        : [];
      const lastDoneRun = recentRuns.find((r) => r.status === "done") ?? recentRuns[0];
      const lastBrief = lastDoneRun?.briefJson ?? null;
      return {
        topic,
        runs: recentRuns,
        posts: postsForTopic,
        notes: recentNotes,
        assets: topicAssetsRows,
        lastBrief,
        publicMediaBase: ctx.env.R2_PUBLIC_BASE,
      };
    }),
    create: proc.input(topicInputSchema).mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(topics).values({ ...input, userId: ctx.user.id }).returning();
      return row;
    }),
    update: proc.input(topicInputSchema.partial().extend({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ownedTopic(ctx, input.id);
        const { id, ...rest } = input;
        await ctx.db.update(topics).set({ ...rest, updatedAt: new Date() }).where(eq(topics.id, id));
        return { ok: true };
      }),
    remove: proc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      await ownedTopic(ctx, input.id);
      await ctx.db.delete(topics).where(eq(topics.id, input.id));
      return { ok: true };
    }),
    runNow: proc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      await ownedTopic(ctx, input.id);
      const [run] = await ctx.db.insert(runs).values({
        topicId: input.id,
        userId: ctx.user.id,
        status: "planned",
      }).returning();
      if (!run) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ctx.env.RUNS_QUEUE.send({ runId: run.id, topicId: input.id, userId: ctx.user.id });
      return { runId: run.id };
    }),
    saveDraft: proc.input(z.object({ id: z.string(), brief: draftBriefSchema }))
      .mutation(async ({ ctx, input }) => {
        await ownedTopic(ctx, input.id);
        await ctx.db.update(topics)
          .set({ draftBrief: input.brief, updatedAt: new Date() })
          .where(eq(topics.id, input.id));
        return { ok: true };
      }),
    clearDraft: proc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      await ownedTopic(ctx, input.id);
      await ctx.db.update(topics)
        .set({ draftBrief: null, useDraftForNext: false, updatedAt: new Date() })
        .where(eq(topics.id, input.id));
      return { ok: true };
    }),
    setUseDraft: proc.input(z.object({ id: z.string(), value: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await ownedTopic(ctx, input.id);
        await ctx.db.update(topics)
          .set({ useDraftForNext: input.value, updatedAt: new Date() })
          .where(eq(topics.id, input.id));
        return { ok: true };
      }),
    genImage: proc.input(z.object({
      topicId: z.string(),
      prompt: z.string().min(3).max(2000),
      kind: z.enum(["bg-slide", "bg-threads", "asset"]).default("bg-slide"),
      slideIndex: z.number().int().min(0).max(20).optional(),
      aspect: z.enum(["1:1", "3:2", "2:3"]).default("2:3"),
      quality: z.enum(["low", "medium", "high", "auto"]).default("auto"),
    })).mutation(async ({ ctx, input }) => {
      const topic = await ownedTopic(ctx, input.topicId);
      const composed = composePrompt(topic.imageStylePrompt, input.prompt);
      return generateImageForTopic({
        env: ctx.env,
        userId: ctx.user.id,
        topicId: topic.id,
        prompt: composed,
        kind: input.kind,
        slideIndex: input.slideIndex,
        aspect: input.aspect,
        quality: input.quality,
      });
    }),
    deleteAsset: proc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.topicAssets.findFirst({ where: eq(topicAssets.id, input.id) });
      if (!row || row.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.env.MEDIA.delete(row.r2Key).catch(() => {});
      await ctx.db.delete(topicAssets).where(eq(topicAssets.id, input.id));
      return { ok: true };
    }),
  }),

  templates: t.router({
    list: proc.query(async ({ ctx }) =>
      ctx.db.query.templates.findMany({
        where: or(isNull(templates.userId), eq(templates.userId, ctx.user.id)),
        orderBy: [desc(templates.createdAt)],
      })),
    get: proc.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const tpl = await ctx.db.query.templates.findFirst({ where: eq(templates.id, input.id) });
      if (!tpl) throw new TRPCError({ code: "NOT_FOUND" });
      // Built-in templates (userId = null) are visible to everyone.
      if (tpl.userId !== null && tpl.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      const usingTopics = await ctx.db.query.topics.findMany({
        where: eq(topics.userId, ctx.user.id),
        orderBy: [desc(topics.createdAt)],
      });
      const referenced = usingTopics.filter((tp) => tp.templateSlugs.includes(tpl.slug));
      return { template: tpl, topicsUsing: referenced, isShared: tpl.userId === null };
    }),
    create: proc.input(templateInputSchema).mutation(async ({ ctx, input }) => {
      await ensureSlugFree(ctx, input.slug);
      const [row] = await ctx.db.insert(templates).values({ ...input, userId: ctx.user.id }).returning();
      return row;
    }),
    update: proc.input(templateInputSchema.partial().extend({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ownedTemplate(ctx, input.id);
        const { id, ...rest } = input;
        await ctx.db.update(templates).set({ ...rest, updatedAt: new Date() }).where(eq(templates.id, id));
        return { ok: true };
      }),
    remove: proc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      await ownedTemplate(ctx, input.id);
      await ctx.db.delete(templates).where(eq(templates.id, input.id));
      return { ok: true };
    }),
    duplicate: proc.input(z.object({ id: z.string(), newSlug: z.string().regex(/^[a-z0-9-]+$/) }))
      .mutation(async ({ ctx, input }) => {
        const src = await ctx.db.query.templates.findFirst({ where: eq(templates.id, input.id) });
        if (!src) throw new TRPCError({ code: "NOT_FOUND" });
        if (src.userId !== null && src.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        await ensureSlugFree(ctx, input.newSlug);
        const [row] = await ctx.db.insert(templates).values({
          userId: ctx.user.id,
          slug: input.newSlug,
          name: `${src.name} (copy)`,
          kind: src.kind,
          platform: src.platform,
          compositionId: src.compositionId,
          schema: src.schema,
          defaults: src.defaults,
          defaultAudioMood: src.defaultAudioMood,
          durationSec: src.durationSec,
          accentColor: src.accentColor,
          bgPromptTemplate: src.bgPromptTemplate,
          transitionPreset: src.transitionPreset,
          bgMode: src.bgMode,
          defaultBgR2Key: src.defaultBgR2Key,
        }).returning();
        return row;
      }),
  }),

  accounts: t.router({
    list: proc.query(async ({ ctx }) =>
      ctx.db.query.accounts.findMany({ where: eq(accounts.userId, ctx.user.id) })),
    remove: proc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      const acc = await ownedAccount(ctx, input.id);
      await ctx.env.TOKENS.delete(acc.tokenKvKey);
      await ctx.db.delete(accounts).where(eq(accounts.id, input.id));
      return { ok: true };
    }),
  }),

  audio: t.router({
    list: proc.query(async ({ ctx }) =>
      ctx.db.query.audioTracks.findMany({
        where: or(isNull(audioTracks.userId), eq(audioTracks.userId, ctx.user.id)),
        orderBy: [desc(audioTracks.createdAt)],
      })),
    get: proc.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const track = await ctx.db.query.audioTracks.findFirst({ where: eq(audioTracks.id, input.id) });
      if (!track) throw new TRPCError({ code: "NOT_FOUND" });
      if (track.userId !== null && track.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      const usagePosts = await ctx.db.query.posts.findMany({
        where: and(eq(posts.userId, ctx.user.id), eq(posts.audioTrackId, track.id)),
        orderBy: [desc(posts.createdAt)],
        limit: 30,
      });
      return {
        track,
        isShared: track.userId === null,
        usagePosts,
        publicUrl: `${ctx.env.R2_PUBLIC_BASE}/${track.r2Key}`,
      };
    }),
    create: proc.input(audioInputSchema).mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(audioTracks).values({ ...input, userId: ctx.user.id }).returning();
      return row;
    }),
    update: proc.input(audioInputSchema.partial().extend({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ownedAudio(ctx, input.id);
        const { id, ...rest } = input;
        await ctx.db.update(audioTracks).set({ ...rest, updatedAt: new Date() }).where(eq(audioTracks.id, id));
        return { ok: true };
      }),
    remove: proc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      await ownedAudio(ctx, input.id);
      await ctx.db.delete(audioTracks).where(eq(audioTracks.id, input.id));
      return { ok: true };
    }),
    presignUpload: proc.input(z.object({
      filename: z.string().regex(/^[\w.\-]+\.(mp3|m4a|wav)$/i, "mp3/m4a/wav only"),
    })).mutation(({ ctx, input }) => {
      const r2Key = `audio/u-${ctx.user.id}/${Date.now()}-${input.filename}`;
      return { r2Key, uploadUrl: `/api/audio/upload?key=${encodeURIComponent(r2Key)}` };
    }),
    replaceFile: proc.input(z.object({
      id: z.string(),
      r2Key: z.string().min(1).max(255),
      durationSec: z.number().int().positive(),
    })).mutation(async ({ ctx, input }) => {
      const track = await ownedAudio(ctx, input.id);
      // Owner-uploaded tracks only — refuse to overwrite a shared/seeded one.
      if (track.userId === null) throw new TRPCError({ code: "FORBIDDEN", message: "공유 트랙은 교체할 수 없습니다" });
      // Best-effort cleanup of the previous blob.
      if (track.r2Key && track.r2Key !== input.r2Key) {
        await ctx.env.MEDIA.delete(track.r2Key).catch(() => {});
      }
      await ctx.db.update(audioTracks).set({
        r2Key: input.r2Key,
        durationSec: input.durationSec,
        updatedAt: new Date(),
      }).where(eq(audioTracks.id, input.id));
      return { ok: true };
    }),
  }),

  posts: t.router({
    list: proc.input(z.object({
      limit: z.number().min(1).max(200).default(50),
      platform: z.enum(["instagram", "threads"]).optional(),
      status: z.enum(["pending", "published", "failed"]).optional(),
    })).query(async ({ ctx, input }) => {
      const filters = [eq(posts.userId, ctx.user.id)];
      if (input.platform) filters.push(eq(posts.platform, input.platform));
      if (input.status) filters.push(eq(posts.status, input.status));
      const rows = await ctx.db.query.posts.findMany({
        where: and(...filters),
        orderBy: [desc(posts.createdAt)],
        limit: input.limit,
      });
      // Join topic name via runs.topicId so the dashboard can group + label.
      const runIds = Array.from(new Set(rows.map((r) => r.runId)));
      const runRows = runIds.length
        ? await ctx.db.query.runs.findMany({ where: inArray(runs.id, runIds) })
        : [];
      const topicIds = Array.from(new Set(runRows.map((r) => r.topicId)));
      const topicRows = topicIds.length
        ? await ctx.db.query.topics.findMany({ where: inArray(topics.id, topicIds) })
        : [];
      const topicByRun = new Map(runRows.map((r) => [r.id, r.topicId]));
      const nameByTopic = new Map(topicRows.map((t) => [t.id, t.name]));
      return rows.map((p) => ({
        ...p,
        topicId: topicByRun.get(p.runId) ?? null,
        topicName: nameByTopic.get(topicByRun.get(p.runId) ?? "") ?? null,
      }));
    }),
  }),

  runs: t.router({
    list: proc.input(z.object({ topicId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
      .query(async ({ ctx, input }) => {
        const filter = input.topicId
          ? and(eq(runs.userId, ctx.user.id), eq(runs.topicId, input.topicId))
          : eq(runs.userId, ctx.user.id);
        return ctx.db.query.runs.findMany({
          where: filter,
          orderBy: [desc(runs.createdAt)],
          limit: input.limit,
        });
      }),
    get: proc.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const run = await ctx.db.query.runs.findFirst({ where: eq(runs.id, input.id) });
      if (!run || run.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      const [runAssets, runPosts] = await Promise.all([
        ctx.db.query.assets.findMany({ where: eq(assets.runId, run.id), orderBy: [desc(assets.createdAt)] }),
        ctx.db.query.posts.findMany({ where: eq(posts.runId, run.id), orderBy: [desc(posts.createdAt)] }),
      ]);
      return { run, assets: runAssets, posts: runPosts, publicMediaBase: ctx.env.R2_PUBLIC_BASE };
    }),
  }),

  skillPrompts: t.router({
    list: proc.query(async ({ ctx }) => {
      const rows = await ctx.db.query.skillPrompts.findMany({
        where: eq(skillPrompts.userId, ctx.user.id),
      });
      // Always return one row per known skill so the editor can render them all.
      return SKILL_NAMES.map((name) => {
        const existing = rows.find((r) => r.skillName === name);
        return existing
          ? { skillName: name, override: existing.override, enabled: existing.enabled, hasOverride: true }
          : { skillName: name, override: "", enabled: false, hasOverride: false };
      });
    }),
    upsert: proc.input(z.object({
      skillName: z.enum(SKILL_NAMES),
      override: z.string().max(8000),
      enabled: z.boolean(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.skillPrompts.findFirst({
        where: and(eq(skillPrompts.userId, ctx.user.id), eq(skillPrompts.skillName, input.skillName)),
      });
      if (existing) {
        await ctx.db.update(skillPrompts).set({
          override: input.override,
          enabled: input.enabled,
          updatedAt: new Date(),
        }).where(eq(skillPrompts.id, existing.id));
      } else {
        await ctx.db.insert(skillPrompts).values({
          userId: ctx.user.id,
          skillName: input.skillName,
          override: input.override,
          enabled: input.enabled,
        });
      }
      return { ok: true };
    }),
    remove: proc.input(z.object({ skillName: z.enum(SKILL_NAMES) }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db.delete(skillPrompts).where(and(
          eq(skillPrompts.userId, ctx.user.id),
          eq(skillPrompts.skillName, input.skillName),
        ));
        return { ok: true };
      }),
  }),
});

function composePrompt(stylePrefix: string, prompt: string): string {
  const a = (stylePrefix ?? "").trim();
  const b = (prompt ?? "").trim();
  if (!a) return b;
  if (!b) return a;
  return `${a}. ${b}`;
}

export type AppRouter = typeof appRouter;

export async function handleTrpc(req: Request, env: Env): Promise<Response> {
  const ctx = await authenticate(req, env);
  if (!ctx) return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ctx,
  });
}
