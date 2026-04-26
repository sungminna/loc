import { initTRPC, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { z } from "zod";
import { eq, desc, and, isNull, or } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";
import { topics, templates, accounts, audioTracks, posts, runs, type Account } from "@db/schema";
import type { Env } from "@shared/env";
import { authenticate, type AuthCtx } from "../auth";

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
});

const templateInputSchema = z.object({
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "kebab-case only"),
  name: z.string().min(1).max(80),
  kind: z.enum(["reel-cards", "reel-animated", "threads-photo"]),
  compositionId: z.string().min(1).max(60),
  schema: z.record(z.unknown()).default({}),
  defaults: z.record(z.unknown()).default({}),
  defaultAudioMood: z.array(z.string()).default([]),
  durationSec: z.number().int().min(3).max(90).default(18),
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
    get: proc.input(z.object({ id: z.string() })).query(async ({ ctx, input }) =>
      ownedTopic(ctx, input.id)),
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
  }),

  templates: t.router({
    list: proc.query(async ({ ctx }) =>
      ctx.db.query.templates.findMany({
        where: or(isNull(templates.userId), eq(templates.userId, ctx.user.id)),
        orderBy: [desc(templates.createdAt)],
      })),
    create: proc.input(templateInputSchema).mutation(async ({ ctx, input }) => {
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
  }),

  posts: t.router({
    list: proc.input(z.object({ limit: z.number().min(1).max(200).default(50) }))
      .query(async ({ ctx, input }) =>
        ctx.db.query.posts.findMany({
          where: eq(posts.userId, ctx.user.id),
          orderBy: [desc(posts.createdAt)],
          limit: input.limit,
        })),
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
  }),
});

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
