import { and, eq, lte, gte, count, isNull, or } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";
import { getDb } from "@db/client";
import { topics, runs, users } from "@db/schema";
import type { Env, RunMessage } from "@shared/env";
import { spawnSandboxRun } from "./sandbox-spawner";
import { refreshExpiringTokens } from "./token-refresh";

export async function dispatch(env: Env): Promise<void> {
  // Token refresh runs every cron tick; the function itself filters by
  // expiry-window so it's effectively cheap (read-only most of the time).
  await refreshExpiringTokens(env).catch((e) => console.error("token refresh:", e));

  const db = getDb(env.DB);
  const now = new Date();
  const due = await db.query.topics.findMany({
    where: and(
      eq(topics.enabled, true),
      or(isNull(topics.nextRunAt), lte(topics.nextRunAt, now)),
    ),
  });

  for (const t of due) {
    const owner = await db.query.users.findFirst({ where: eq(users.id, t.userId) });
    if (!owner?.enabled) {
      await db.update(topics).set({ nextRunAt: nextFromCron(t.cron, now) }).where(eq(topics.id, t.id));
      continue;
    }

    if (await reachedDailyCap(env, t.id, t.dailyRunCap)) {
      await db.update(topics).set({ nextRunAt: nextFromCron(t.cron, now) }).where(eq(topics.id, t.id));
      continue;
    }

    if (await userOverDailyBudget(env, t.userId, owner.costCapDailyUsd)) {
      await db.update(topics).set({ nextRunAt: nextFromCron(t.cron, now) }).where(eq(topics.id, t.id));
      continue;
    }

    const [run] = await db.insert(runs).values({
      topicId: t.id,
      userId: t.userId,
      status: "planned",
    }).returning();
    if (!run) continue;

    await env.RUNS_QUEUE.send({ runId: run.id, topicId: t.id, userId: t.userId } satisfies RunMessage);
    await db.update(topics).set({ nextRunAt: nextFromCron(t.cron, now) }).where(eq(topics.id, t.id));
  }
}

// Statuses that mean the run has already been picked up. A re-delivered queue
// message for one of these should ack-and-skip — never spawn a second sandbox.
const STARTED_STATUSES = new Set([
  "researching", "planning", "generating", "rendering", "publishing",
  "done", "failed",
]);

export async function consume(
  batch: MessageBatch<RunMessage>,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const db = getDb(env.DB);
  for (const msg of batch.messages) {
    const { runId, topicId, userId } = msg.body;

    // Idempotency guard: queue retries / DLQ replays can re-deliver a
    // message after the sandbox already ran. Look up the row and bail out
    // if it's no longer in `planned` state.
    const existing = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    if (!existing) {
      // Run was deleted (e.g. user removed the topic). Drop the message.
      msg.ack();
      continue;
    }
    if (STARTED_STATUSES.has(existing.status)) {
      msg.ack();
      continue;
    }

    const lockId = env.TOPIC_RUNNER.idFromName(`topic:${topicId}`);
    const stub = env.TOPIC_RUNNER.get(lockId);

    const ack = await stub.fetch("https://lock/acquire", {
      method: "POST",
      body: JSON.stringify({ runId }),
    });
    if (!ack.ok) {
      // Another run for this topic is in flight (status 423). Park this
      // delivery — when the holder releases, the next attempt acquires
      // cleanly. 60s is plenty for typical run durations to bracket each other.
      msg.retry({ delaySeconds: 60 });
      continue;
    }

    msg.ack();
    ctx.waitUntil(
      spawnSandboxRun(env, runId, topicId, userId)
        .catch(async (e) => {
          const error = e instanceof Error ? e.message : String(e);
          // Defensive: spawnSandboxRun also marks failed on its own paths,
          // but if it threw before reaching that block (e.g. topic
          // ownership mismatch), reconcile here.
          await db.update(runs).set({
            status: "failed",
            error: error.slice(0, 4000),
            finishedAt: new Date(),
          }).where(eq(runs.id, runId));
          console.error(`[run ${runId}] spawn threw:`, error);
        })
        .finally(async () => {
          try {
            await stub.fetch("https://lock/release", { method: "POST" });
          } catch (e) {
            console.error(`[run ${runId}] lock release failed:`, e);
          }
        }),
    );
  }
}

async function reachedDailyCap(env: Env, topicId: string, cap: number): Promise<boolean> {
  const db = getDb(env.DB);
  const dayStart = startOfUtcDay();
  const result = await db
    .select({ n: count() })
    .from(runs)
    .where(and(eq(runs.topicId, topicId), gte(runs.createdAt, dayStart)));
  return (result[0]?.n ?? 0) >= cap;
}

async function userOverDailyBudget(env: Env, userId: string, capUsd: number): Promise<boolean> {
  const db = getDb(env.DB);
  const dayStart = startOfUtcDay();
  const rows = await db.select({ micros: runs.costUsdMicros })
    .from(runs)
    .where(and(eq(runs.userId, userId), gte(runs.createdAt, dayStart)));
  const totalMicros = rows.reduce((sum, r) => sum + (r.micros ?? 0), 0);
  return totalMicros / 1_000_000 >= capUsd;
}

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function nextFromCron(expr: string, after: Date): Date {
  try {
    const parsed = CronExpressionParser.parse(expr, { currentDate: after, tz: "UTC" });
    return parsed.next().toDate();
  } catch {
    const fallback = new Date(after);
    fallback.setUTCDate(fallback.getUTCDate() + 1);
    fallback.setUTCHours(9, 0, 0, 0);
    return fallback;
  }
}
