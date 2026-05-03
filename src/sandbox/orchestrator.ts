// orchestrator.ts — deterministic content cycle driver.
//
// Replaces the previous `claude -p <orchestrate-run skill>` invocation. The
// failure mode there: a single Claude session decides when "the task" is
// done, and frequently stops after topic-research without driving the
// remaining stages — leaving runs.status stuck mid-pipeline so the worker
// reconciler marks them failed with "skill did not call set-status done".
//
// Here, this TS process owns the state machine. Each stage:
//   1. flips runs.status via the internal API
//   2. does its work (LLM stages spawn a focused `claude -p` subprocess;
//      deterministic stages spawn the existing bun CLI scripts)
//   3. catches its own errors and decides continue-vs-fail per the
//      contract documented inline below
// The model never gets to decide whether to keep going.
//
// Entry point: invoked by src/worker/sandbox-spawner.ts inside the
// container. Required env: LOC_RUN_ID, LOC_TOPIC_ID, LOC_USER_ID,
// LOC_API_BASE, LOC_INTERNAL_KEY, R2_PUBLIC_BASE. Optional: IG_*, THREADS_*,
// REPLICATE_API_TOKEN.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { api, type TemplateJson, type TopicJson } from "./lib/api";

// ─── Brief shape (mirrors content-plan output) ───────────────────────
interface Slide {
  kicker?: string;
  headline: string;
  body?: string;
  emphasis?: string;
  stat?: { value?: string; suffix?: string; label?: string };
  bgImagePrompt?: string;
  bgImageR2Key?: string;
}

interface Scene {
  kicker?: string;
  chapter?: string;
  headline?: string;
  body?: string;
  stat?: { value?: string; suffix?: string; label?: string };
  videoPrompt?: string;
  durationSec?: number;
  aspectRatio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive";
  resolution?: "480p" | "720p";
  generateAudio?: boolean;
  seed?: number;
  cameraMove?: string;
  mood?: string;
  firstFrameImagePrompt?: string;
  firstFrameImageR2Key?: string;
  lastFrameImagePrompt?: string;
  lastFrameImageR2Key?: string;
  videoR2Key?: string;
}

interface Brief {
  brand: { handle: string; name: string };
  lang: "ko" | "en" | "ko+en";
  reel?: { slides: Slide[] };
  video?: { scenes: Scene[]; accent?: string };
  threads?: {
    headline?: string;
    body?: string;
    text?: string;
    bgImagePrompt?: string;
    bgImageR2Key?: string;
  };
  caption?: { instagram?: string; threads?: string };
  hashtags?: string[];
  threadsTopicTag?: string;
}

// ─── Process-level state ─────────────────────────────────────────────
const RUN_ID = mustEnv("LOC_RUN_ID");
const TOPIC_ID = mustEnv("LOC_TOPIC_ID");
const USER_ID = mustEnv("LOC_USER_ID");
const RUN_DIR = `data/runs/${RUN_ID}`;
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE ?? "";

const usage = {
  costUsd: 0,
  tokensIn: 0,
  tokensOut: 0,
  sessionId: undefined as string | undefined,
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[orchestrator] ${name} not set — aborting before any work`);
    process.exit(2);
  }
  return v;
}

function emitFinalUsage(): void {
  // The Worker spawner parses this final stdout line to write cost/tokens
  // back to runs.* — same shape it used to extract from claude -p's
  // stream-json result event.
  console.log(
    JSON.stringify({
      type: "loc_usage",
      cost_usd: usage.costUsd,
      tokens_in: usage.tokensIn,
      tokens_out: usage.tokensOut,
      session_id: usage.sessionId,
    }),
  );
}

async function fail(stage: string, err: unknown): Promise<never> {
  const msg = `[${stage}] ${err instanceof Error ? err.message : String(err)}`.slice(0, 1000);
  console.error(msg);
  try {
    await api.setRunStatus(RUN_ID, "failed", msg);
  } catch (e) {
    console.error(`failed to set status: ${e instanceof Error ? e.message : String(e)}`);
  }
  emitFinalUsage();
  process.exit(1);
}

// ─── Subprocess helpers ──────────────────────────────────────────────

interface BashResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

// Async-spawn wrapper that owns timeout enforcement ourselves. We do NOT
// rely on spawnSync({timeout}) — empirically Bun's spawnSync timeout option
// failed to kill long-running children (a stage_plan run sat for 46+ min
// past its 8-min budget). With this version we register our own
// setTimeout to kill on the deadline.
//
// Critical detail: the command is `bash -c "cat … | claude -p …"`, a
// pipeline of three processes. child.kill("SIGKILL") sends the signal
// only to bash; cat and claude are reparented to init and keep running,
// so the timeout would advance the orchestrator while the descendants
// continue burning resources and racing to write artifacts the next
// stage will read. To kill the whole pipeline we spawn the child as a
// new process-group leader (`detached: true`) and signal the entire
// group with the negative-PID convention `process.kill(-pid, signal)`.
function runBash(cmd: string, timeoutMs: number): Promise<BashResult> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", cmd], {
      env: process.env,
      cwd: "/workspace",
      detached: true, // becomes process-group leader; -pid kills the group
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let resolved = false;

    const finalize = (result: BashResult): void => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      // Kill the entire process group — bash, cat, claude (or whichever
      // pipeline). On `close` we record the timeout reason regardless of
      // which signal the OS reports, since the SIGKILL we just sent is
      // why the group exited.
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        // ESRCH if the group already exited between the timer firing and
        // this kill; harmless.
      }
      // Defense-in-depth: if `close` somehow doesn't fire within 5 s of
      // the kill (it always should, but we want a hard ceiling), resolve
      // the promise ourselves so the orchestrator can advance.
      setTimeout(() => {
        if (!resolved) {
          stderr += `\n[runBash] forced resolve after kill — close event never fired`;
          finalize({ status: -1, signal: "SIGKILL", stdout, stderr, timedOut: true });
        }
      }, 5000);
    }, timeoutMs);

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      finalize({ status: code, signal, stdout, stderr, timedOut });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      stderr += `\n[spawn error] ${err.message}`;
      finalize({ status: -1, signal: null, stdout, stderr, timedOut });
    });
  });
}

// Run a focused `claude -p` subprocess. Each invocation has ONE narrow goal
// (write research.md, or write brief.json) so even if the model stops early
// it can't prevent the orchestrator from advancing — the next stage runs
// regardless, and a missing artifact is handled at the catch site.
async function runClaude(opts: {
  prompt: string;
  promptFile: string;
  timeoutMs: number;
}): Promise<BashResult> {
  writeFileSync(opts.promptFile, opts.prompt);
  const cmd =
    `cat "${opts.promptFile}" | claude -p ` +
    `--output-format stream-json ` +
    `--verbose ` +
    `--permission-mode bypassPermissions ` +
    `--dangerously-skip-permissions`;
  return runBash(cmd, opts.timeoutMs);
}

// Parse claude's stream-json output and accumulate cost/tokens into the
// process-level usage struct. Returns the final error message if the
// session ended in error.
function accumulateClaudeUsage(stdout: string): { error?: string } {
  let lastError: string | undefined;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line) as Record<string, unknown>;
      if (o.type !== "result") continue;
      if (typeof o.total_cost_usd === "number") usage.costUsd += o.total_cost_usd;
      const u = o.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      if (u) {
        usage.tokensIn += u.input_tokens ?? 0;
        usage.tokensOut += u.output_tokens ?? 0;
      }
      if (typeof o.session_id === "string") usage.sessionId = o.session_id;
      if (o.subtype !== "success" && typeof o.error === "string") {
        lastError = o.error;
      }
    } catch {
      // Non-JSON noise interleaved with stream-json — ignore.
    }
  }
  return { error: lastError };
}

// ─── Stages ──────────────────────────────────────────────────────────

interface Context {
  topic: TopicJson;
  template: TemplateJson | null;
}

async function stage_setup(): Promise<Context & { draftBrief: Brief | null; useDraft: boolean }> {
  mkdirSync(RUN_DIR, { recursive: true });

  const { topic } = await api.getTopic(TOPIC_ID);
  const t = topic as TopicJson;
  writeFileSync(`${RUN_DIR}/topic.json`, JSON.stringify(t, null, 2));

  let template: TemplateJson | null = null;
  const slug = t.templateSlugs?.[0];
  if (slug) {
    const r = await api.getTemplate(slug);
    template = r.template;
    if (template) {
      writeFileSync(`${RUN_DIR}/template.json`, JSON.stringify(template, null, 2));
    }
  }

  const d = await api.getTopicDraft();
  return {
    topic: t,
    template,
    draftBrief: (d.draft as Brief | null) ?? null,
    useDraft: d.useDraft,
  };
}

async function stage_research(ctx: Context): Promise<void> {
  await api.setRunStatus(RUN_ID, "researching");

  const sourcesNote = ctx.topic.sourceUrls.length
    ? `Configured sourceUrls: ${ctx.topic.sourceUrls.join(", ")}`
    : `No sourceUrls configured — start directly with WebSearch.`;

  const prompt = `You are running ONE narrow task headlessly inside a sandbox. There is no human; do NOT pause for confirmation, do NOT ask questions. Permissions are pre-granted.

Goal: write a research digest at \`${RUN_DIR}/research.md\` for the topic configured at \`${RUN_DIR}/topic.json\`.

${sourcesNote}

Steps (follow in order, do all of them):
1. Read \`${RUN_DIR}/topic.json\`.
2. For each sourceUrl (max 6), call WebFetch with this prompt:
   "Pull from this article the strongest material for a 30-second Instagram Reel about <topic.name>: 1) up to 3 specific numbers, dates, or named entities; 2) one contrarian or counter-intuitive claim; 3) one concrete first-person example; 4) the single most quotable sentence. Return as bullet points. Skip filler."
3. If sourceUrls is empty OR fewer than 2 fetches succeed, use WebSearch with queries like "<topic.name> trending 2026", "<topic.name> news this week", "<topic.name> data study". Take the top 3 results and apply the same WebFetch prompt.
4. Write \`${RUN_DIR}/research.md\` with sections:
   # Research digest — <topic.name>
   _Run ${RUN_ID}_

   ## Scroll-stoppers
   - 3 bullets, each with a specific number/date/entity and source.
   ## Counter-intuitive angles
   ## Concrete moments / examples
   ## Notable terms
   ## Avoid
5. Once \`${RUN_DIR}/research.md\` exists, your task is COMPLETE. Do not summarize, do not ask. Just exit.

Constraints:
- ~700 tokens of digest max.
- Never invent statistics. If you can't cite the source, omit it.
- If everything fails, write a stub research.md with a single line noting the failure — the next stage will compensate.`;

  const r = await runClaude({
    prompt,
    promptFile: `${RUN_DIR}/.research-prompt.txt`,
    timeoutMs: 8 * 60 * 1000,
  });
  accumulateClaudeUsage(r.stdout ?? "");

  // Research is best-effort. Even if claude crashed, write a stub so
  // content-plan has *something* and the run continues.
  if (!existsSync(`${RUN_DIR}/research.md`)) {
    console.error(`[research] research.md not produced (exit=${r.status}); writing stub`);
    writeFileSync(
      `${RUN_DIR}/research.md`,
      `# Research digest — ${ctx.topic.name}\n\n_Research stage produced no notes; content-plan will work from persona alone._\n`,
    );
  }
}

async function stage_plan(ctx: Context): Promise<Brief> {
  await api.setRunStatus(RUN_ID, "planning");

  const briefPath = `${RUN_DIR}/brief.json`;

  // Two attempts: if the first JSON.parse fails, give the model the parse
  // error and ask it to retry. This is cheaper and more reliable than
  // trusting one shot.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const retryNote =
      attempt === 1
        ? ""
        : `\n\nYour previous attempt failed to produce valid brief.json. Read your previous output, fix the JSON, and re-write the file. Common issues: trailing commas, unescaped newlines inside strings, missing required keys.`;

    const prompt = `You are running ONE narrow task headlessly inside a sandbox. There is no human; do NOT pause for confirmation. Permissions are pre-granted.

Goal: write a viral-ready brief at \`${briefPath}\`.${retryNote}

Inputs:
- \`${RUN_DIR}/topic.json\` (full topic row including persona, lang, imageStylePrompt, etc.)
- \`${RUN_DIR}/research.md\`
${ctx.template ? `- \`${RUN_DIR}/template.json\` (the chosen Remotion template — bgPromptTemplate is style overlay, accentColor is the dominant brand color)` : ""}

Read these, then follow the rules in \`.claude/skills/content-plan/SKILL.md\` to draft the brief. Apply the persona prompt, the retention-first composition rules, the legal safety rails, and the slide-0 cover-frame discipline. Run the self-critique loop once before writing.

The brief MUST be valid JSON matching this schema:

{
  "brand": { "handle": "string", "name": "string" },
  "lang": "ko" | "en" | "ko+en",
  "reel": {
    "slides": [
      {
        "kicker": "string (optional)",
        "headline": "string",
        "body": "string (optional)",
        "emphasis": "string (optional, single emoji)",
        "stat": { "value": "string", "suffix": "string", "label": "string" } (optional),
        "bgImagePrompt": "string"
      }
    ]
  },
  "threads": {
    "headline": "string",
    "body": "string",
    "text": "string (≤280 chars)",
    "bgImagePrompt": "string"
  },
  "caption": { "instagram": "string", "threads": "string" },
  "hashtags": ["string", ...] (5-10 tags, no '#' prefix),
  "threadsTopicTag": "string (single tag, no '#', ≤50 chars)"
}

Use the Write tool to save the JSON to \`${briefPath}\`. Do NOT print the brief to stdout. Once written, exit.

${ctx.template?.kind === "reel-video" ? `IMPORTANT: this run uses a video-reel template. Still produce reel.slides[] (the storyboard skill turns it into video scenes later). Do not invent video.scenes[] yourself.` : ""}`;

    const r = await runClaude({
      prompt,
      promptFile: `${RUN_DIR}/.plan-prompt.txt`,
      timeoutMs: 8 * 60 * 1000,
    });
    accumulateClaudeUsage(r.stdout ?? "");

    if (!existsSync(briefPath)) {
      if (attempt === 2) await fail("plan", `brief.json not produced after ${attempt} attempts (claude exit ${r.status})`);
      console.error(`[plan] brief.json missing on attempt ${attempt}; retrying`);
      continue;
    }
    try {
      const brief = JSON.parse(readFileSync(briefPath, "utf8")) as Brief;
      // Minimum viability gate: must have at least one slide and a caption.
      if (!brief.reel?.slides?.length || !brief.caption?.instagram) {
        throw new Error("brief is missing reel.slides or caption.instagram");
      }
      await api.setBrief(RUN_ID, brief as unknown as Record<string, unknown>);
      return brief;
    } catch (e) {
      if (attempt === 2) await fail("plan", e);
      console.error(`[plan] invalid brief on attempt ${attempt}: ${e instanceof Error ? e.message : String(e)}; retrying`);
    }
  }
  // Unreachable — fail() above always exits.
  return await fail("plan", "exhausted retry budget");
}

async function stage_storyboard(ctx: Context, brief: Brief): Promise<Brief> {
  // Only required for SeedanceReel video templates.
  if (ctx.template?.kind !== "reel-video" && ctx.template?.compositionId !== "SeedanceReel") {
    return brief;
  }
  if (brief.video?.scenes && brief.video.scenes.length > 0) return brief; // already populated (draft)

  const briefPath = `${RUN_DIR}/brief.json`;
  const prompt = `You are running ONE narrow task headlessly. Goal: append a video-reel storyboard to \`${briefPath}\` for a SeedanceReel composition.

Read \`${briefPath}\` and \`${RUN_DIR}/topic.json\` and \`${RUN_DIR}/research.md\`. Follow the rules in \`.claude/skills/video-storyboard/SKILL.md\`. Add a \`video\` field to the brief:

{
  ...existing brief fields,
  "video": {
    "accent": "<hex from template.accentColor or topic palette>",
    "scenes": [
      {
        "kicker": "string",
        "chapter": "string",
        "headline": "string",
        "body": "string",
        "stat": { "value": "string", "label": "string" },
        "videoPrompt": "Cinematic prompt for Seedance 2.0",
        "durationSec": 5,
        "aspectRatio": "9:16",
        "resolution": "720p",
        "generateAudio": false,
        "firstFrameImagePrompt": "gpt-image-2 prompt for the opening still"
      }
    ]
  }
}

Use 3-5 scenes. Total durationSec should sum to ~22 seconds. Re-write the entire brief.json with the merged content. Use Read + Write tools. Once written, exit.`;

  const r = await runClaude({
    prompt,
    promptFile: `${RUN_DIR}/.storyboard-prompt.txt`,
    timeoutMs: 6 * 60 * 1000,
  });
  accumulateClaudeUsage(r.stdout ?? "");

  // Re-read whatever the model wrote.
  try {
    const updated = JSON.parse(readFileSync(briefPath, "utf8")) as Brief;
    if (!updated.video?.scenes?.length) {
      await fail("storyboard", "video.scenes[] missing after storyboard");
    }
    await api.setBrief(RUN_ID, updated as unknown as Record<string, unknown>);
    return updated;
  } catch (e) {
    return await fail("storyboard", e);
  }
}

async function stage_image(ctx: Context, brief: Brief): Promise<Brief> {
  await api.setRunStatus(RUN_ID, "generating");

  const isVideoTemplate =
    ctx.template?.kind === "reel-video" || ctx.template?.compositionId === "SeedanceReel";
  const mode = ctx.topic.imageMode;

  // ── Slide backgrounds ────────────────────────────────────────────
  if (!isVideoTemplate && brief.reel?.slides?.length) {
    const slides = brief.reel.slides;
    const targets = mode === "ai-all" ? slides.map((_, i) => i) : mode === "ai-first-only" ? [0] : [];

    for (const i of targets) {
      const slide = slides[i];
      if (!slide || slide.bgImageR2Key) continue;
      if (!slide.bgImagePrompt) continue;

      const composedPrompt = composeSlidePrompt(slide.bgImagePrompt, ctx.topic.imageStylePrompt, ctx.template);
      const quality = mode === "ai-first-only" ? "high" : "auto";
      const r = await runBash(
        [
          `bun src/sandbox/image-gen.ts gen`,
          `--prompt ${shellQuote(composedPrompt)}`,
          `--aspect 2:3`,
          `--count 1`,
          `--quality ${quality}`,
          `--output-format webp`,
          `--user-id ${shellQuote(USER_ID)}`,
          `--out-dir ${RUN_DIR}/img`,
          `--run-id ${RUN_ID}`,
          `--kind image-bg`,
        ].join(" "),
        4 * 60 * 1000,
      );
      if (r.status !== 0) {
        console.error(`[image] slide ${i} gen failed (exit=${r.status}): ${(r.stderr ?? "").slice(-300)}`);
        continue;
      }
      const r2Key = parseImageGenStdout(r.stdout ?? "");
      if (r2Key) slides[i] = { ...slide, bgImageR2Key: r2Key };
    }

    // Slides 1..N in ai-first-only mode: leave bgImageR2Key unset so the
    // composition's gradient (tinted by template.accentColor passed to
    // render-reel) shows through. defaultBgR2Key is honored when set.
    if (mode !== "ai-all" && ctx.template?.defaultBgR2Key) {
      for (let i = 0; i < slides.length; i++) {
        if (i === 0 && mode === "ai-first-only") continue; // slide 0 already AI
        if (slides[i] && !slides[i]!.bgImageR2Key) {
          slides[i] = { ...slides[i]!, bgImageR2Key: ctx.template.defaultBgR2Key };
        }
      }
    }
  }

  // ── Video reel: first/last frame images per scene ────────────────
  if (isVideoTemplate && brief.video?.scenes?.length && mode !== "template-only") {
    const scenes = brief.video.scenes;
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i]!;
      if (sc.firstFrameImagePrompt && !sc.firstFrameImageR2Key) {
        const prompt = composeSlidePrompt(sc.firstFrameImagePrompt, ctx.topic.imageStylePrompt, ctx.template);
        const r = await runBash(
          [
            `bun src/sandbox/image-gen.ts gen`,
            `--prompt ${shellQuote(prompt)}`,
            `--aspect 2:3`,
            `--count 1`,
            `--quality high`,
            `--output-format webp`,
            `--user-id ${shellQuote(USER_ID)}`,
            `--out-dir ${RUN_DIR}/img`,
            `--run-id ${RUN_ID}`,
            `--kind video-frame`,
          ].join(" "),
          4 * 60 * 1000,
        );
        if (r.status === 0) {
          const r2Key = parseImageGenStdout(r.stdout ?? "");
          if (r2Key) scenes[i] = { ...sc, firstFrameImageR2Key: r2Key };
        } else {
          console.error(`[image] scene ${i} firstFrame failed: ${(r.stderr ?? "").slice(-300)}`);
        }
      }
    }
  }

  // ── Threads card background ──────────────────────────────────────
  const willRenderThreadsImage =
    ctx.topic.threadsFormat === "image" && !!ctx.topic.targetAccounts.threads;
  if (willRenderThreadsImage && brief.threads?.bgImagePrompt && !brief.threads.bgImageR2Key && mode !== "template-only") {
    const prompt = composeSlidePrompt(
      brief.threads.bgImagePrompt,
      ctx.topic.imageStylePrompt,
      ctx.template,
    );
    const r = await runBash(
      [
        `bun src/sandbox/image-gen.ts gen`,
        `--prompt ${shellQuote(prompt)}`,
        `--aspect 2:3`,
        `--count 1`,
        `--quality high`,
        `--output-format webp`,
        `--user-id ${shellQuote(USER_ID)}`,
        `--out-dir ${RUN_DIR}/img`,
        `--run-id ${RUN_ID}`,
        `--kind image-bg`,
      ].join(" "),
      4 * 60 * 1000,
    );
    if (r.status === 0) {
      const r2Key = parseImageGenStdout(r.stdout ?? "");
      if (r2Key) brief.threads = { ...brief.threads, bgImageR2Key: r2Key };
    } else {
      console.error(`[image] threads bg failed: ${(r.stderr ?? "").slice(-300)}`);
    }
  }

  writeFileSync(`${RUN_DIR}/brief.json`, JSON.stringify(brief, null, 2));
  await api.setBrief(RUN_ID, brief as unknown as Record<string, unknown>);
  return brief;
}

async function stage_video(ctx: Context, brief: Brief): Promise<Brief> {
  if (ctx.template?.kind !== "reel-video" && ctx.template?.compositionId !== "SeedanceReel") {
    return brief;
  }
  if (!brief.video?.scenes?.length) await fail("video", "no scenes to render");
  const scenes = brief.video!.scenes;

  let okCount = 0;
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i]!;
    if (sc.videoR2Key) {
      okCount++;
      continue;
    }
    if (!sc.videoPrompt) continue;

    const args = [
      `bun src/sandbox/video-gen.ts gen`,
      `--prompt ${shellQuote(sc.videoPrompt)}`,
      `--aspect-ratio ${sc.aspectRatio ?? "9:16"}`,
      `--resolution ${sc.resolution ?? "720p"}`,
      `--duration ${sc.durationSec ?? 5}`,
      `--generate-audio ${sc.generateAudio ?? true}`,
      sc.seed !== undefined ? `--seed ${sc.seed}` : "",
      sc.firstFrameImageR2Key ? `--image ${shellQuote(`${R2_PUBLIC_BASE}/${sc.firstFrameImageR2Key}`)}` : "",
      sc.lastFrameImageR2Key ? `--last-frame-image ${shellQuote(`${R2_PUBLIC_BASE}/${sc.lastFrameImageR2Key}`)}` : "",
      `--out-dir ${RUN_DIR}/video`,
      `--run-id ${RUN_ID}`,
      `--kind seedance-mp4`,
      `--scene-index ${i}`,
    ].filter(Boolean).join(" ");

    const r = await runBash(args, 8 * 60 * 1000);
    if (r.status !== 0) {
      console.error(`[video] scene ${i} failed (exit=${r.status}): ${(r.stderr ?? "").slice(-300)}`);
      continue;
    }
    const r2Key = parseVideoGenStdout(r.stdout ?? "");
    if (r2Key) {
      scenes[i] = { ...sc, videoR2Key: r2Key };
      okCount++;
    }
  }

  if (okCount * 2 < scenes.length) {
    await fail("video", `only ${okCount}/${scenes.length} scenes rendered — too few for a coherent reel`);
  }

  writeFileSync(`${RUN_DIR}/brief.json`, JSON.stringify(brief, null, 2));
  await api.setBrief(RUN_ID, brief as unknown as Record<string, unknown>);
  return brief;
}

async function stage_audio(ctx: Context): Promise<{ url?: string; attribution?: string; trackId?: string } | null> {
  // IG-only — skip if no IG target.
  if (!ctx.topic.targetAccounts.instagram) return null;
  const slug = ctx.topic.templateSlugs?.[0];
  const duration = ctx.template?.durationSec ?? 18;

  const args = [
    `bun src/sandbox/select-audio.ts`,
    `--topic-id ${shellQuote(TOPIC_ID)}`,
    slug ? `--template-slug ${shellQuote(slug)}` : "",
    `--duration ${duration}`,
  ].filter(Boolean).join(" ");

  const r = await runBash(args, 30_000);
  if (r.status !== 0) {
    console.error(`[audio] select-audio failed: ${(r.stderr ?? "").slice(-300)} — continuing without BGM`);
    return null;
  }

  try {
    const out = JSON.parse((r.stdout ?? "").trim().split("\n").pop() ?? "{}") as {
      id?: string;
      r2Key?: string;
      attributionText?: string;
    };
    if (!out.r2Key) return null;
    return {
      url: `${R2_PUBLIC_BASE}/${out.r2Key}`,
      attribution: out.attributionText ?? undefined,
      trackId: out.id,
    };
  } catch (e) {
    console.error(`[audio] failed to parse select-audio output: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function stage_render(
  ctx: Context,
  brief: Brief,
  audio: { url?: string; attribution?: string; trackId?: string } | null,
): Promise<{ reelKey?: string; coverKey?: string; threadsKey?: string }> {
  await api.setRunStatus(RUN_ID, "rendering");

  const out: { reelKey?: string; coverKey?: string; threadsKey?: string } = {};

  // ── Reel (IG) ─────────────────────────────────────────────────────
  if (ctx.topic.targetAccounts.instagram && brief.reel?.slides?.length) {
    const compositionId = ctx.template?.compositionId ?? "CardNews";
    const accent = ctx.template?.accentColor ?? "";
    const args = [
      `bun src/sandbox/render-reel.ts`,
      `--run-id ${RUN_ID}`,
      `--composition ${compositionId}`,
      `--brief ${RUN_DIR}/brief.json`,
      audio?.url ? `--audio-url ${shellQuote(audio.url)}` : "",
      audio?.attribution ? `--audio-attribution ${shellQuote(audio.attribution)}` : "",
      `--out-dir ${RUN_DIR}`,
      `--duration-sec ${ctx.template?.durationSec ?? 18}`,
      accent ? `--accent ${shellQuote(accent)}` : "",
    ].filter(Boolean).join(" ");

    const r = await runBash(args, 10 * 60 * 1000);
    if (r.status !== 0) {
      await fail("render", `render-reel failed (exit=${r.status}): ${(r.stderr ?? "").slice(-500)}`);
    }
    out.reelKey = `runs/${RUN_ID}/reel.mp4`;
    out.coverKey = `runs/${RUN_ID}/cover.jpg`;
  }

  // ── Threads photo card ────────────────────────────────────────────
  if (ctx.topic.targetAccounts.threads && ctx.topic.threadsFormat === "image" && brief.threads) {
    const args = [
      `bun src/sandbox/render-threads-image.ts`,
      `--run-id ${RUN_ID}`,
      `--brief ${RUN_DIR}/brief.json`,
      `--out-dir ${RUN_DIR}`,
    ].join(" ");
    const r = await runBash(args, 3 * 60 * 1000);
    if (r.status !== 0) {
      console.error(`[render] threads image failed (exit=${r.status}): ${(r.stderr ?? "").slice(-300)}`);
    } else {
      out.threadsKey = `runs/${RUN_ID}/threads.jpg`;
    }
  }

  return out;
}

async function stage_publish(
  ctx: Context,
  brief: Brief,
  rendered: { reelKey?: string; coverKey?: string; threadsKey?: string },
  audio: { trackId?: string } | null,
): Promise<{ igOk: boolean; threadsOk: boolean; configured: boolean }> {
  await api.setRunStatus(RUN_ID, "publishing");

  const hashtags = composeHashtags(ctx.topic, brief);
  const slug = ctx.topic.templateSlugs?.[0] ?? "";
  const lang: "ko" | "en" = ctx.topic.lang === "en" ? "en" : "ko";

  let igOk = false;
  let threadsOk = false;
  const configured = !!ctx.topic.targetAccounts.instagram || !!ctx.topic.targetAccounts.threads;

  // ── Instagram ────────────────────────────────────────────────────
  if (ctx.topic.targetAccounts.instagram && rendered.reelKey && process.env.IG_ACCESS_TOKEN) {
    const args = [
      `bun src/sandbox/ig.ts publish-reel`,
      `--run-id ${RUN_ID}`,
      `--video-r2-key ${rendered.reelKey}`,
      rendered.coverKey ? `--cover-r2-key ${rendered.coverKey}` : "",
      `--caption-body ${shellQuote(brief.caption?.instagram ?? "")}`,
      `--hashtags ${shellQuote(hashtags.join(","))}`,
      audio && (audio as { attribution?: string }).attribution ? `--attribution ${shellQuote((audio as { attribution?: string }).attribution!)}` : "",
      audio?.trackId ? `--audio-track-id ${shellQuote(audio.trackId)}` : "",
      slug ? `--template-slug ${shellQuote(slug)}` : "",
      `--lang ${lang}`,
    ].filter(Boolean).join(" ");
    const r = await runBash(args, 8 * 60 * 1000);
    igOk = r.status === 0;
    if (!igOk) {
      console.error(`[publish ig] exit=${r.status}: ${(r.stderr ?? "").slice(-500)}`);
    }
  }

  // ── Threads ───────────────────────────────────────────────────────
  if (ctx.topic.targetAccounts.threads && process.env.THREADS_ACCESS_TOKEN) {
    const threadsBody = brief.threads?.text ?? brief.caption?.threads ?? "";
    const tagsForThreads = hashtags.slice(0, 5).join(",");
    const args = [
      `bun src/sandbox/threads.ts publish`,
      `--run-id ${RUN_ID}`,
      `--text-body ${shellQuote(threadsBody)}`,
      tagsForThreads ? `--hashtags ${shellQuote(tagsForThreads)}` : "",
      brief.threadsTopicTag ? `--topic-tag ${shellQuote(brief.threadsTopicTag)}` : "",
      `--lang ${lang}`,
      slug ? `--template-slug ${shellQuote(slug)}` : "",
      ctx.topic.threadsFormat === "image" && rendered.threadsKey ? `--image-r2-key ${rendered.threadsKey}` : "",
    ].filter(Boolean).join(" ");
    const r = await runBash(args, 5 * 60 * 1000);
    threadsOk = r.status === 0;
    if (!threadsOk) {
      console.error(`[publish threads] exit=${r.status}: ${(r.stderr ?? "").slice(-500)}`);
    }
  }

  return { igOk, threadsOk, configured };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function composeSlidePrompt(
  contentPrompt: string,
  styleOverlay: string,
  template: TemplateJson | null,
): string {
  // Content first (the model weights early tokens heaviest), then style,
  // then color directive, then a typography-safe-zone reminder.
  const parts: string[] = [];
  parts.push(contentPrompt.trim());
  parts.push(
    "Vertical 2:3 cover frame, single dominant subject, generous negative space in upper third for kicker text and middle for headline. No on-screen text, no logos, no watermark.",
  );
  const style = [styleOverlay, template?.bgPromptTemplate].filter((s) => s && s.trim()).join(". ");
  if (style) parts.push(`Style: ${style}.`);
  if (template?.accentColor) {
    parts.push(
      `Color palette anchored on ${template.accentColor} as the dominant accent, with secondary tones that harmonize cleanly with the template gradient backdrop so the cover and following template-rendered slides read as one coherent deck.`,
    );
  }
  return parts.join(" ");
}

function composeHashtags(topic: TopicJson, brief: Brief): string[] {
  const ai = (brief.hashtags ?? []).filter(Boolean);
  const fixed = (topic.fixedHashtags ?? []).filter(Boolean);
  let combined: string[];
  switch (topic.hashtagMode) {
    case "fixed":
      combined = fixed;
      break;
    case "mixed":
      combined = Array.from(new Set([...ai, ...fixed]));
      break;
    case "ai":
    default:
      combined = ai;
  }
  return combined.slice(0, 30);
}

function shellQuote(s: string): string {
  // POSIX single-quote: replace ' with '\'' inside the value.
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function parseImageGenStdout(stdout: string): string | undefined {
  for (const line of stdout.split("\n").reverse()) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const o = JSON.parse(line) as { r2Key?: string };
      if (o.r2Key) return o.r2Key;
    } catch {
      // skip
    }
  }
  return undefined;
}

function parseVideoGenStdout(stdout: string): string | undefined {
  for (const line of stdout.split("\n").reverse()) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const o = JSON.parse(line) as { r2Key?: string };
      if (o.r2Key) return o.r2Key;
    } catch {
      // skip
    }
  }
  return undefined;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let setupResult: Awaited<ReturnType<typeof stage_setup>>;
  try {
    setupResult = await stage_setup();
  } catch (e) {
    return await fail("setup", e);
  }
  const ctx: Context = { topic: setupResult.topic, template: setupResult.template };

  let brief: Brief;

  if (setupResult.useDraft && setupResult.draftBrief) {
    // Draft replay: skip research + plan, use the dashboard-edited brief.
    brief = setupResult.draftBrief;
    writeFileSync(`${RUN_DIR}/brief.json`, JSON.stringify(brief, null, 2));
    try {
      await api.setBrief(RUN_ID, brief as unknown as Record<string, unknown>);
      await api.consumeTopicDraft();
    } catch (e) {
      return await fail("draft-replay", e);
    }
    // Storyboard fill-in for video templates whose draft lacked scenes.
    try {
      brief = await stage_storyboard(ctx, brief);
    } catch (e) {
      return await fail("storyboard", e);
    }
  } else {
    try {
      await stage_research(ctx);
    } catch (e) {
      // Research is best-effort; log but continue.
      console.error(`[research] non-fatal: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      brief = await stage_plan(ctx);
    } catch (e) {
      return await fail("plan", e);
    }
    try {
      brief = await stage_storyboard(ctx, brief);
    } catch (e) {
      return await fail("storyboard", e);
    }
  }

  try {
    brief = await stage_image(ctx, brief);
  } catch (e) {
    console.error(`[image] non-fatal: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    brief = await stage_video(ctx, brief);
  } catch (e) {
    return await fail("video", e);
  }

  let audio: Awaited<ReturnType<typeof stage_audio>>;
  try {
    audio = await stage_audio(ctx);
  } catch (e) {
    console.error(`[audio] non-fatal: ${e instanceof Error ? e.message : String(e)}`);
    audio = null;
  }

  let rendered: Awaited<ReturnType<typeof stage_render>>;
  try {
    rendered = await stage_render(ctx, brief, audio);
  } catch (e) {
    return await fail("render", e);
  }

  let pub: Awaited<ReturnType<typeof stage_publish>>;
  try {
    pub = await stage_publish(ctx, brief, rendered, audio);
  } catch (e) {
    return await fail("publish", e);
  }

  if (pub.configured && !pub.igOk && !pub.threadsOk) {
    return await fail("publish", "all configured platforms failed");
  }
  if (!pub.configured) {
    return await fail("publish", "no target accounts configured for this topic");
  }

  await api.setRunStatus(RUN_ID, "done");
  emitFinalUsage();
}

main().catch(async (e: unknown) => {
  await fail("uncaught", e);
});
