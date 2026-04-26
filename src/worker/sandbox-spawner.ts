import { eq } from "drizzle-orm";
import { getSandbox } from "@cloudflare/sandbox";
import { getDb } from "@db/client";
import { runs, topics, accounts } from "@db/schema";
import type { Env } from "@shared/env";
import { decryptToken } from "./crypto";

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
    .set({ status: "researching", startedAt: new Date() })
    .where(eq(runs.id, runId));

  // User-isolated sandbox key prevents cross-user state leakage in case of
  // sandbox reuse / Durable Object reuse.
  const sandboxKey = `u-${userId}/run-${runId}`;
  // @ts-expect-error — @cloudflare/workers-types and @cloudflare/sandbox each
  // declare their own Disposable; the runtime objects are identical.
  const sandbox = getSandbox(env.Sandbox, sandboxKey);

  const repoUrl = env.GITHUB_REPO_URL;
  if (!repoUrl) throw new Error("GITHUB_REPO_URL secret is empty");

  const cloneRes = await sandbox.exec(
    // cd / first: sandbox starts in /workspace and we'd be deleting our own cwd
    `cd / && rm -rf /workspace && git clone --depth 1 ${repoUrl} /workspace`,
  );
  console.log(`git clone exit=${cloneRes.exitCode} stdout=${cloneRes.stdout?.slice(0, 200)} stderr=${cloneRes.stderr?.slice(0, 500)}`);
  if (cloneRes.exitCode !== 0) {
    throw new Error(`git clone failed (${cloneRes.exitCode}): ${(cloneRes.stderr || cloneRes.stdout || "").slice(0, 1000)}`);
  }

  const installRes = await sandbox.exec("cd /workspace && bun install --frozen-lockfile");
  console.log(`bun install exit=${installRes.exitCode} stderr=${installRes.stderr?.slice(0, 300)}`);
  if (installRes.exitCode !== 0) {
    throw new Error(`bun install failed (${installRes.exitCode}): ${(installRes.stderr || "").slice(0, 1000)}`);
  }

  const childEnv: Record<string, string> = {
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

  const prompt = `Run the orchestrate-run skill for runId=${runId} topicId=${topicId} userId=${userId}. Follow the skill exactly. Halt and report any error to stderr.`;

  const result = await sandbox.exec(
    `cd /workspace && claude -p ${JSON.stringify(prompt)} --output-format stream-json --permission-mode acceptEdits`,
    { env: childEnv, timeout: 15 * 60 * 1000 },
  );

  const totals = parseClaudeStream(result.stdout);
  const failed = result.exitCode !== 0;

  await db.update(runs).set({
    claudeSessionId: totals.sessionId,
    costUsdMicros: Math.round((totals.costUsd ?? 0) * 1_000_000),
    tokensIn: totals.tokensIn,
    tokensOut: totals.tokensOut,
    status: failed ? "failed" : "done",
    error: failed ? result.stderr.slice(0, 4000) : null,
    finishedAt: new Date(),
  }).where(eq(runs.id, runId));

  env.ANALYTICS.writeDataPoint({
    blobs: [topicId, runId, userId, totals.sessionId ?? ""],
    doubles: [totals.costUsd ?? 0, totals.tokensIn, totals.tokensOut, result.exitCode ?? -1],
    indexes: [userId],
  });
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
}

function parseClaudeStream(stream: string): ClaudeTotals {
  const totals: ClaudeTotals = { tokensIn: 0, tokensOut: 0 };
  for (const line of stream.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (obj.type === "result" && obj.subtype === "success") {
        totals.sessionId = obj.session_id as string | undefined;
        totals.costUsd = obj.total_cost_usd as number | undefined;
        const usage = obj.usage as { input_tokens?: number; output_tokens?: number } | undefined;
        totals.tokensIn = usage?.input_tokens ?? 0;
        totals.tokensOut = usage?.output_tokens ?? 0;
      }
    } catch {
      // ignore non-JSON lines
    }
  }
  return totals;
}
