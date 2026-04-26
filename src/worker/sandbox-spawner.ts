import { eq } from "drizzle-orm";
import { getSandbox } from "@cloudflare/sandbox";
import { getDb } from "@db/client";
import { runs, topics, accounts, type RunStatus } from "@db/schema";
import type { Env } from "@shared/env";
import { decryptToken } from "./crypto";

const CLAUDE_TIMEOUT_MS = 15 * 60 * 1000;

export async function spawnSandboxRun(
  env: Env,
  runId: string,
  topicId: string,
  userId: string,
): Promise<void> {
  const db = getDb(env.DB);
  const topic = await db.query.topics.findFirst({ where: eq(topics.id, topicId) });
  if (!topic) throw new Error(`topic ${topicId} not found`);
  if (topic.userId !== userId) throw new Error(`topic ${topicId} ownership mismatch`);

  const tokenEnv = await collectAccountTokens(env, userId, topic.targetAccounts);

  await db.update(runs)
    .set({ status: "researching", startedAt: new Date(), error: null })
    .where(eq(runs.id, runId));

  // Per-user sandbox key prevents cross-user state leakage if the underlying
  // Sandbox DO instance is reused. We always destroy() at the end too, so a
  // crashed container can never bleed into another user's run.
  const sandboxKey = `u-${userId}/run-${runId}`;
  // @ts-expect-error — @cloudflare/workers-types and @cloudflare/sandbox each
  // declare their own Disposable; the runtime objects are identical.
  const sandbox = getSandbox(env.Sandbox, sandboxKey);

  const repoUrl = env.GITHUB_REPO_URL;
  if (!repoUrl) {
    await markFailed(env, runId, "GITHUB_REPO_URL secret is empty");
    throw new Error("GITHUB_REPO_URL secret is empty");
  }

  try {
    // ── Provision: clone + install ─────────────────────────────────────
    // Sandbox starts in /workspace; we cd / before rm so we don't delete
    // our own cwd. The clone is intentional even if /workspace already
    // existed — sandbox reuse can leak state across runs.
    const cloneRes = await sandbox.exec(
      `cd / && rm -rf /workspace && git clone --depth 1 ${repoUrl} /workspace`,
    );
    if (cloneRes.exitCode !== 0) {
      throw stage("clone", cloneRes.stderr || cloneRes.stdout, cloneRes.exitCode);
    }

    const installRes = await sandbox.exec("cd /workspace && bun install --frozen-lockfile");
    if (installRes.exitCode !== 0) {
      throw stage("install", installRes.stderr || installRes.stdout, installRes.exitCode);
    }

    // ── Run Claude Code headlessly ────────────────────────────────────
    const childEnv: Record<string, string> = {
      // Tells the CLI we're already in a sandbox; bypasses the
      // "no --dangerously-skip-permissions as root" safety check.
      IS_SANDBOX: "1",
      CLAUDE_CODE_OAUTH_TOKEN: env.CLAUDE_CODE_OAUTH_TOKEN,
      LOC_RUN_ID: runId,
      LOC_TOPIC_ID: topicId,
      LOC_USER_ID: userId,
      LOC_API_BASE: env.PUBLIC_WORKER_URL,
      LOC_INTERNAL_KEY: env.INTERNAL_API_KEY,
      REPLICATE_API_TOKEN: env.REPLICATE_API_TOKEN,
      AI_GATEWAY_BASE: env.AI_GATEWAY_BASE,
      R2_PUBLIC_BASE: env.R2_PUBLIC_BASE,
      ...tokenEnv,
    };

    const prompt =
      `Run the orchestrate-run skill for runId=${runId} topicId=${topicId} userId=${userId}. ` +
      `Follow the skill exactly. Update run status at every stage transition via db-cli. ` +
      `Halt and report any error to stderr; never silently skip a step.`;

    const result = await sandbox.exec(
      // bypassPermissions = full autonomy. IS_SANDBOX=1 bypasses CLI's root check.
      `cd /workspace && claude -p ${JSON.stringify(prompt)} --output-format stream-json --verbose --dangerously-skip-permissions`,
      { env: childEnv, timeout: CLAUDE_TIMEOUT_MS },
    );

    const totals = parseClaudeStream(result.stdout);
    const failed = result.exitCode !== 0;
    const errorMessage = failed
      ? extractError(result.stderr, result.stdout) ||
        `claude exited with code ${result.exitCode}`
      : null;

    // The orchestrator skill is responsible for setting status=done|failed,
    // but we reconcile here as a safety net: if the CLI crashed without
    // updating, mark failed; if it succeeded but skipped the final set-status,
    // mark done.
    const cur = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    const status: RunStatus = failed
      ? "failed"
      : (cur?.status === "done" ? "done" : "done");

    await db.update(runs).set({
      claudeSessionId: totals.sessionId,
      costUsdMicros: Math.round((totals.costUsd ?? 0) * 1_000_000),
      tokensIn: totals.tokensIn,
      tokensOut: totals.tokensOut,
      status,
      error: failed ? errorMessage?.slice(0, 4000) : null,
      finishedAt: new Date(),
    }).where(eq(runs.id, runId));

    env.ANALYTICS.writeDataPoint({
      blobs: [topicId, runId, userId, totals.sessionId ?? "", status],
      doubles: [totals.costUsd ?? 0, totals.tokensIn, totals.tokensOut, result.exitCode ?? -1],
      indexes: [userId],
    });

    if (failed) {
      console.error(`[run ${runId}] failed: ${errorMessage}`);
    } else {
      console.log(`[run ${runId}] done · $${(totals.costUsd ?? 0).toFixed(3)} · ${totals.tokensIn + totals.tokensOut} tokens`);
    }
  } finally {
    // Always reclaim the container — Cloudflare Sandbox keeps the underlying
    // DO instance warm otherwise, billing minutes for an idle box.
    try {
      await sandbox.destroy();
    } catch (e) {
      console.error(`[run ${runId}] sandbox.destroy failed:`, e);
    }
  }
}

class StageError extends Error {
  constructor(public stage: string, message: string, public exitCode: number | undefined) {
    super(message);
  }
}

function stage(name: string, raw: string, code: number | undefined): StageError {
  const trimmed = (raw || "").trim().slice(0, 1500);
  return new StageError(name, `${name} failed (exit=${code}): ${trimmed}`, code);
}

async function markFailed(env: Env, runId: string, message: string): Promise<void> {
  const db = getDb(env.DB);
  await db.update(runs).set({
    status: "failed",
    error: message.slice(0, 4000),
    finishedAt: new Date(),
  }).where(eq(runs.id, runId));
}

async function collectAccountTokens(
  env: Env,
  userId: string,
  targetAccounts: { instagram?: string; threads?: string },
): Promise<Record<string, string>> {
  const db = getDb(env.DB);
  const out: Record<string, string> = {};

  if (targetAccounts.instagram) {
    const a = await db.query.accounts.findFirst({ where: eq(accounts.id, targetAccounts.instagram) });
    if (a && a.userId === userId) {
      const tok = await readToken(env, a.tokenKvKey);
      if (tok) {
        out.IG_ACCOUNT_ID = a.id;
        out.IG_USER_ID = a.igUserId ?? "";
        out.IG_ACCESS_TOKEN = tok;
      }
    }
  }
  if (targetAccounts.threads) {
    const a = await db.query.accounts.findFirst({ where: eq(accounts.id, targetAccounts.threads) });
    if (a && a.userId === userId) {
      const tok = await readToken(env, a.tokenKvKey);
      if (tok) {
        out.THREADS_ACCOUNT_ID = a.id;
        out.THREADS_USER_ID = a.threadsUserId ?? "";
        out.THREADS_ACCESS_TOKEN = tok;
      }
    }
  }
  return out;
}

async function readToken(env: Env, key: string): Promise<string | null> {
  const blob = await env.TOKENS.get(key);
  if (!blob) return null;
  return decryptToken(blob, env.LOC_MASTER_KEY);
}

interface ClaudeTotals {
  sessionId?: string;
  costUsd?: number;
  tokensIn: number;
  tokensOut: number;
  lastError?: string;
}

function parseClaudeStream(stream: string): ClaudeTotals {
  const totals: ClaudeTotals = { tokensIn: 0, tokensOut: 0 };
  for (const line of stream.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (obj.type === "result") {
        // Capture both success and error final results so we can read totals
        // even on a failed run.
        totals.sessionId = (obj.session_id as string | undefined) ?? totals.sessionId;
        if (typeof obj.total_cost_usd === "number") totals.costUsd = obj.total_cost_usd;
        const usage = obj.usage as { input_tokens?: number; output_tokens?: number } | undefined;
        if (usage) {
          totals.tokensIn = usage.input_tokens ?? totals.tokensIn;
          totals.tokensOut = usage.output_tokens ?? totals.tokensOut;
        }
        if (obj.subtype !== "success" && typeof obj.error === "string") {
          totals.lastError = obj.error;
        }
      }
    } catch {
      // Ignore non-JSON noise interleaved with the JSON lines.
    }
  }
  return totals;
}

// Reduce the stderr/stdout blob to something a human can read in the dashboard
// without scrolling 500 lines of stream-json. Prefer the last non-empty line of
// stderr; fall back to the parsed stream's lastError; fall back to a tail of stdout.
function extractError(stderr: string, stdout: string): string {
  const errLines = stderr.split("\n").map((l) => l.trim()).filter(Boolean);
  const lastErr = errLines[errLines.length - 1];
  if (lastErr) return lastErr.slice(0, 1000);
  const tail = stdout.trim().split("\n").slice(-5).join("\n").trim();
  return tail.slice(0, 1000);
}
