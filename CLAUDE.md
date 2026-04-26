# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`loc` is an autonomous Instagram + Threads posting system. A Cloudflare Worker fires every minute, picks "due" topics out of D1, enqueues them, and spawns a Cloudflare Sandbox container per run. Inside the sandbox, the Claude Code CLI runs headlessly (`claude -p ... --dangerously-skip-permissions`) and walks through the skills under `.claude/skills/` — research → plan → image/video gen → Remotion render → IG/Threads publish.

The codebase has three runtime contexts that share TypeScript source:
- **Worker** (`src/worker/`) — Cloudflare Worker: cron, queue consumer, tRPC, OAuth, internal REST.
- **Sandbox** (`src/sandbox/`) — Bun scripts that the in-container `claude` invokes via Skills.
- **Dashboard** (`src/dashboard/`) — Vite + React 19 + tRPC SPA served as Worker assets.
- **Remotion** (`src/remotion/`) — Compositions used by `render-reel` inside the sandbox.

## Common commands

```bash
# Local dev (Worker + container build, ~30s first time for cloudflare/sandbox image)
bun run dev

# Dashboard dev server (5173 → proxies /api and /oauth to 8787)
bun run dashboard:dev

# Typecheck across all source
bun run typecheck

# Deploy: must build dashboard first (assets.directory points at dist/dashboard)
bun run dashboard:build && bun run deploy

# D1 migrations (drizzle-kit drives both)
bun run db:generate                    # produce SQL from src/db/schema.ts
bun run db:migrate:local               # against miniflare
bun run db:migrate:remote              # against prod D1
bun run db:studio

# Seed (templates + NCS audio). Needs CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID, CLOUDFLARE_API_TOKEN
bun scripts/seed.ts

# Local sandbox-side render (no container, useful for iterating on Remotion compositions)
bun run render:test
```

There is **no test runner configured** — no jest/vitest in `package.json`. Don't fabricate a "run a single test" command.

## Architecture

### Cron → Queue → Sandbox lifecycle

`src/worker/index.ts` exports `scheduled`, `queue`, and `fetch`. The cron path:

1. `scheduled()` → `dispatch(env)` (`src/worker/scheduler.ts`) finds enabled topics where `nextRunAt <= now`, enforces per-user/per-topic daily caps, inserts a `runs` row, and sends to `RUNS_QUEUE`.
2. `queue()` → `consume()` does **idempotency-by-status**: if the run is already past `planned`, ack and skip (this matters because Queues retries + DLQ replays will re-deliver).
3. Acquires a `TopicRunner` Durable Object lock keyed `topic:<topicId>` (15-min TTL alarm). Only one in-flight run per topic.
4. `spawnSandboxRun()` (`src/worker/sandbox-spawner.ts`):
   - Sandbox key is `u-<userId>/run-<runId>` — never collapse this; cross-user reuse would leak state.
   - `git clone --depth 1 $GITHUB_REPO_URL /workspace` (cwd starts at `/workspace`, so it `cd /` and `rm -rf /workspace` first).
   - `bun install --frozen-lockfile`.
   - `claude -p "<orchestrate-run prompt>" --output-format stream-json --dangerously-skip-permissions` with `IS_SANDBOX=1` (bypasses CLI's "no skip-permissions as root" guard).
   - Parses the `result/success` line from the stream-json stdout to extract `total_cost_usd`, token counts, `session_id`.

### The internal API contract (sandbox ↔ worker)

The sandbox cannot touch D1 or KV directly. Everything goes through `POST /internal/*` on the Worker (`src/worker/api/internal.ts`), authed by:
- `Authorization: Bearer ${INTERNAL_API_KEY}` (shared secret)
- `LOC-Run-Id: <runId>` header, validated against the run row's `topicId`/`userId`.

Every mutation re-checks that the body's `runId` matches the header. Even with a stolen `INTERNAL_API_KEY`, a sandbox can only write to its own run. The thin sandbox-side client lives at `src/sandbox/lib/api.ts`.

There is also `PUT /internal/r2/put` for streamed R2 uploads (image-gen / video-gen / render-reel use this rather than carrying R2 credentials into the container).

### Multi-tenancy

Cloudflare Access sits in front of the Worker (`Cf-Access-Authenticated-User-Email` header). `src/worker/auth.ts` auto-provisions a `users` row on first hit; the very first user becomes `owner`, all later signups are `member`. Local dev falls back to `DEV_USER_EMAIL` from `.dev.vars`, then to `dev@loc.local` if the hostname looks local.

Every domain table (topics, accounts, audio, templates, runs, posts, assets, …) carries `userId` and tRPC procedures use `ownedX(ctx, id)` helpers that 404 on cross-user access. **Templates and audio also support `userId IS NULL`** for shared system rows seeded by `scripts/seed.ts`.

Slugs are unique across the user's templates AND the shared pool (see `ensureSlugFree` in `src/worker/api/trpc.ts`) — sandbox lookups go by slug alone.

### Skills (`.claude/skills/`)

Each skill is a directory with a `SKILL.md` (YAML frontmatter + markdown body). The orchestrator (`orchestrate-run`) calls each in order; per-user prompt overrides come from D1 `skill_prompts` and are appended at runtime. `.claude/settings.json` sets `defaultMode: "bypassPermissions"` for full autonomy in-sandbox; only catastrophic commands (`rm -rf /`, `mkfs`, `shutdown`) are denied.

Two important branches in `orchestrate-run`:
- **Topic draft replay**: if `topics.useDraftForNext` is true, the dashboard-edited `draftBrief` is used verbatim and steps 2–3 (research + content-plan) are skipped. The `consume-topic-draft` call resets the flag.
- **Video reel templates** (`templates.kind === "reel-video"`, composition `SeedanceReel`): runs `video-storyboard` to populate `brief.video.scenes[]`, then per-scene `video-gen` (Replicate `bytedance/seedance-2.0`). Slide-bg loop is skipped entirely. Card templates (`reel-cards`) skip video-gen and feed `brief.reel.slides[]`.

### Remotion compositions

`src/remotion/Root.tsx` is the registry. Card templates (CardNews, KineticType, BoldEditorial, MinimalGrid, NeoBrutalism, GlassMorphism, RetroVHS, DataStory, QuoteSpotlight) use a shared `cardMetadata` calculator: per-slide frames × N + 12. SeedanceReel uses `videoMetadata` summing per-scene `durationSec * fps`.

Adding a new template:
1. Write `src/remotion/compositions/<MyTpl>.tsx` exporting the component + `default<MyTpl>Props`.
2. Register in `src/remotion/Root.tsx` (pick the right metadata calculator).
3. Add a row in `templates` (via dashboard or seed SQL) with `compositionId = "MyTpl"`.

The dashboard's `LivePlayer` (`src/dashboard/components/LivePlayer.tsx`) renders the same compositions directly via `@remotion/player`, using `composition-registry.ts` to map `compositionId → component + defaults`.

### Token vault

OAuth access tokens (Instagram, Threads) are AES-GCM encrypted with `LOC_MASTER_KEY` and stored in the `TOKENS` KV namespace. The accounts row only holds the KV key, never the token. `src/worker/crypto.ts` does encrypt/decrypt; `src/worker/token-refresh.ts` runs every cron tick and refreshes any token within the expiry window (it's read-only when nothing's expiring, so it's effectively cheap).

### TypeScript path aliases

```
@/*       → src/*
@shared/* → src/shared/*
@db/*     → src/db/*
```

Set in `tsconfig.json` and mirrored in `src/dashboard/vite.config.ts` for the dashboard build.

## Things that bite

- **Wrangler must be v4+**. v3 fails with `containers should be an object, but got an array`.
- **Container `instance_type` is `standard-1`** (not bare `standard`). `wrangler.toml` is already correct.
- **Dashboard build is required before deploy** — `assets.directory = "./dist/dashboard"` and the deploy will fail with `assets.directory does not exist` if you skip it.
- **`run_worker_first = true`** in `wrangler.toml`: the Worker runs before static-asset serving, so adding new top-level routes in `src/worker/index.ts` works without conflicting with the SPA.
- **OAuth callback paths must bypass Access** — Meta's servers can't authenticate. Path policies in Zero Trust → Access need a bypass for `/oauth/*/callback` and the deauth/delete webhooks.
- **`tsconfig.json` has `noUncheckedIndexedAccess: true`** — array/record indexing returns `T | undefined`. Don't pretend otherwise.
- **Don't write to `data/runs/`** outside the sandbox; it's gitignored and exists only inside the container.
- **`.dev.vars` is gitignored** and contains all local secrets. Never commit it. `.dev.vars` keys mirror `wrangler secret put` keys for prod.
- **Idempotency in the queue consumer** is enforced by `STARTED_STATUSES` in `src/worker/scheduler.ts`. If you add a new status, decide whether a re-delivered queue message should still spawn a sandbox.
- **`rm -rf /workspace` in the spawn path** is intentional — sandboxes can be reused across runs, and stale workspace would leak state. Don't "optimize" by skipping the clone.
