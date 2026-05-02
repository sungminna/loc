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

    // Headless Claude CLI behaviour notes:
    //  - Slash commands (`/orchestrate-run …`) are NOT expanded in -p mode,
    //    so we cannot rely on the skill's slash-command form.
    //  - A terse prompt like "Run the orchestrate-run skill" is interpreted
    //    conversationally — the model summarises what it WOULD do without
    //    actually invoking any tool (run finishes in <1 min, 29 input
    //    tokens, no brief, no assets). To force an actual tool invocation
    //    we lead with "Use the Skill tool to invoke …" — that maps 1:1 to
    //    a Skill tool call with `skill: "orchestrate-run"`.
    //  - The skill's frontmatter (`allowed-tools: Bash, Read, Write,
    //    WebFetch, WebSearch, Skill`) lets it call sub-skills (image-gen
    //    etc.) once invoked.
    const prompt = [
      `You are running headlessly inside a Cloudflare sandbox container with FULL AUTONOMY. There is no human to ask. Do NOT reply with prose. Do NOT pause for clarification or confirmation. Make every decision independently — when in doubt, pick a defensible default and move forward; when something fails, log a short stderr message and continue with the next viable path. Permissions are pre-granted; every tool you can see is yours to use.`,
      ``,
      `Use the Skill tool to invoke the "orchestrate-run" skill now. Pass these arguments verbatim:`,
      ``,
      `  runId=${runId}`,
      `  topicId=${topicId}`,
      `  userId=${userId}`,
      ``,
      `These values are also already exported as LOC_RUN_ID / LOC_TOPIC_ID / LOC_USER_ID in the shell, so any Bash step inside the skill can use the env vars directly.`,
      ``,
      `The skill drives one full autonomous content cycle (research → content-plan → image-gen → video-gen if applicable → select-audio → render-reel → ig/threads publish). It is responsible for:`,
      `  1. Calling \`bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" <stage>\` BEFORE every stage transition so the dashboard reflects progress.`,
      `  2. On any uncaught failure, calling \`set-status … failed --error "<short msg>"\` and exiting non-zero.`,
      `  3. Ending with \`set-status … done\` on success.`,
      ``,
      `Use any built-in tool you need (Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, Skill, Task, TodoWrite, etc.) without hesitation. If a sub-step would normally prompt for permission, treat it as already approved and proceed.`,
      ``,
      `If the run finishes without ever calling \`set-status done\`, the parent process will mark it failed. Begin by invoking the Skill tool — no preamble.`,
    ].join("\n");

    // Write the prompt to a file inside the sandbox and pipe it via cat
    // rather than embedding in the shell command. JSON.stringify-into-shell
    // turns \n into the literal backslash-n sequence (because bash double
    // quotes don't interpret escape codes), which makes the prompt ugly
    // and harder for the model to parse. Using a file preserves real
    // newlines and sidesteps shell escape ambiguity entirely.
    const PROMPT_PATH = "/workspace/.loc-prompt.txt";
    await sandbox.writeFile(PROMPT_PATH, prompt);

    // Permission flags only — no --allowed-tools whitelist on purpose.
    // Under --permission-mode bypassPermissions the whitelist would be
    // overridden anyway, but more importantly we WANT the model to have
    // every built-in tool (Task, NotebookEdit, TodoWrite, etc.) available
    // for full autonomy. Catastrophic Bash patterns (rm -rf /, mkfs,
    // shutdown) are still blocked by .claude/settings.json `permissions.deny`
    // — that hard block survives bypassPermissions.
    //
    // --permission-mode + --dangerously-skip-permissions are NOT redundant:
    // the former sets the mode, the latter is the explicit "I mean it"
    // circuit breaker. Both are appropriate for an ephemeral sandbox
    // running as root with IS_SANDBOX=1.
    const result = await sandbox.exec(
      `cd /workspace && cat ${PROMPT_PATH} | claude -p ` +
        `--output-format stream-json ` +
        `--verbose ` +
        `--permission-mode bypassPermissions ` +
        `--dangerously-skip-permissions`,
      { env: childEnv, timeout: CLAUDE_TIMEOUT_MS },
    );

    const totals = parseClaudeStream(result.stdout);
    const failed = result.exitCode !== 0;
    const errorMessage = failed
      ? extractError(result.stderr, result.stdout) ||
        `claude exited with code ${result.exitCode}`
      : null;

    // The orchestrator skill is responsible for setting status=done|failed,
    // but we reconcile here as a safety net.
    //  - CLI crashed (non-zero exit) → failed
    //  - CLI exited 0 AND skill called set-status done → trust it
    //  - CLI exited 0 BUT status is still mid-pipeline → orchestrator
    //    skipped its own terminal set-status: treat as failed so the
    //    dashboard surfaces the partial run rather than masking it as
    //    "done with no brief / no assets".
    const cur = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    const IN_FLIGHT: ReadonlySet<RunStatus> = new Set([
      "planned", "researching", "planning", "generating", "rendering", "publishing",
    ]);
    const status: RunStatus = failed
      ? "failed"
      : cur?.status === "done"
        ? "done"
        : cur && IN_FLIGHT.has(cur.status)
          ? "failed"
          : (cur?.status ?? "failed");
    const reconciledError = !failed && status === "failed"
      ? `orchestrator exited cleanly but left status=${cur?.status ?? "unknown"} — skill did not call set-status done`
      : null;

    await db.update(runs).set({
      claudeSessionId: totals.sessionId,
      costUsdMicros: Math.round((totals.costUsd ?? 0) * 1_000_000),
      tokensIn: totals.tokensIn,
      tokensOut: totals.tokensOut,
      status,
      error: failed ? errorMessage?.slice(0, 4000) : reconciledError,
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
