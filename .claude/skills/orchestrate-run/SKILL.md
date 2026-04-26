---
name: orchestrate-run
description: Drive a complete autonomous content cycle for one topic — research, plan, generate images, render reel, publish to Instagram and Threads. Invoked by the Worker queue consumer when a topic is due.
allowed-tools: Bash, Read, Write, WebFetch, WebSearch, Skill
---

# orchestrate-run

You are running one autonomous cycle for a single topic. The runId, topicId, and userId are in env vars `LOC_RUN_ID`, `LOC_TOPIC_ID`, `LOC_USER_ID`. All artifacts go under `data/runs/$LOC_RUN_ID/`.

You are running headlessly inside a Cloudflare Sandbox container. There is no human to ask. Don't pause for clarification — make a defensible choice and move forward. Failures should be loud (stderr + `set-status ... failed --error`) and short, not silent.

## Status discipline (read this twice)

Every stage transition MUST emit a status update via the db-cli before doing the work. The Worker watches `runs.status` to drive the dashboard's "running now" indicator and to decide when to release the per-topic mutex. If you skip a transition, the dashboard will show the wrong stage and the run will look hung.

The valid status sequence is:

```
planned → researching → planning → generating → rendering → publishing → done
                                                                            └── failed (terminal)
```

Always call:

```sh
bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" <next-status>
```

before starting that stage. On any uncaught failure, end with:

```sh
bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" failed --error "<short message>"
exit 1
```

The Worker reconciles unset states as a safety net but the dashboard UX depends on per-stage updates from here.

## Steps

### 0. Set up workspace

```sh
mkdir -p "data/runs/$LOC_RUN_ID"
```

### 1. Load context + user overrides

- `bun src/sandbox/db-cli.ts get-topic "$LOC_TOPIC_ID"` → save the JSON to `data/runs/$LOC_RUN_ID/topic.json`. Note these fields:
  - `lang`, `personaPrompt`, `imageStylePrompt`, `sourceUrls`, `templateSlugs`, `targetAccounts`, `audioPrefs`.
  - `imageMode` ∈ `ai-all | ai-first-only | template-only` — drives step 4.
  - `threadsFormat` ∈ `text | image` — drives step 6 + 7 (Threads).
  - `hashtagMode` ∈ `ai | fixed | mixed`, `fixedHashtags: string[]` — drives publish step.
- For each platform-side template configured (currently we only honor `templateSlugs[0]`), fetch with `bun src/sandbox/db-cli.ts get-template <slug>` and save to `data/runs/$LOC_RUN_ID/template.json`. Note `platform`, `compositionId`, `durationSec`, `bgMode`, `defaultBgR2Key`, `bgPromptTemplate`, `accentColor`. If `template.platform === "threads"` it applies to the Threads card; pull a separate IG template from `templateSlugs[1]` if present, otherwise the IG flow runs without a custom template.
- `bun src/sandbox/db-cli.ts get-skill-prompts` → save to `data/runs/$LOC_RUN_ID/skill_overrides.json`. Before invoking each Skill below, read its corresponding override (if any) and treat it as additional, higher-priority instructions for that step.
- `bun src/sandbox/db-cli.ts get-topic-draft` → save to `data/runs/$LOC_RUN_ID/topic_draft.json`. The shape is `{ useDraft: bool, draft: <brief.json | null>, imageStylePrompt: string }`.

**Draft replay branch.** If `useDraft` is true and `draft` is non-null:
1. Copy `draft` verbatim to `data/runs/$LOC_RUN_ID/brief.json` and persist with `set-brief`.
2. Call `bun src/sandbox/db-cli.ts consume-topic-draft` (resets the flag so the next scheduled run regenerates from scratch).
3. **Skip steps 2–3** (research + plan) — jump to step 4.
4. **Reel-video exception**: if `template.kind === "reel-video"` AND `brief.video?.scenes?.length` is 0 or missing, run **only the video-storyboard skill** to populate `brief.video.scenes[]`. Research + content-plan are still skipped (the draft already supplied caption / hashtags).

### 2. Research

```sh
bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" researching
```

Invoke the **topic-research** skill. It scrapes the topic's sourceUrls and writes research notes. If `sourceUrls` is empty, it falls back to WebSearch.

If research fully fails (zero notes saved AND empty `research.md`), still continue to step 3 — content-plan will fall back to a more generic angle off the persona alone, which is better than failing the entire run.

### 3. Plan

```sh
bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" planning
```

Invoke the **content-plan** skill. It produces `data/runs/$LOC_RUN_ID/brief.json`. The brief contains `caption.{instagram,threads}` (BODY only, no hashtags), `hashtags[]`, and `threadsTopicTag`.

If the IG template's `kind === "reel-video"` (or `compositionId === "SeedanceReel"`), also invoke **video-storyboard** to append `brief.video.scenes[]` (3-5 cinematic scenes with Seedance prompts).

Persist the brief: `bun src/sandbox/db-cli.ts set-brief "$LOC_RUN_ID" data/runs/$LOC_RUN_ID/brief.json`.

### 4. Generate images — branch on `topic.imageMode`

```sh
bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" generating
```

Compose prompt prefix from `topic.imageStylePrompt` + (if available) the IG template's `bgPromptTemplate`. Concatenate as `<style>. <bgPromptTemplate>. <slide.bgImagePrompt>` skipping empty parts.

Slide backgrounds (only when the IG template is **not** `reel-video`):
- `imageMode = "ai-all"`: for each `slides[i]` lacking `bgImageR2Key`, run **image-gen** (`--aspect 2:3 --kind image-bg --user-id "$LOC_USER_ID"`) and write the resulting `r2Key` into `slides[i].bgImageR2Key`.
- `imageMode = "ai-first-only"`: only generate for `slides[0]` (if missing). For `slides[1..]`, set `bgImageR2Key = template.defaultBgR2Key` if non-empty; otherwise leave `bgImageR2Key` undefined.
- `imageMode = "template-only"`: for every slide, set `bgImageR2Key = template.defaultBgR2Key` if non-empty; otherwise leave it undefined. Do not call image-gen.

**Video-reel templates (`kind === "reel-video"`):**
- For each `brief.video.scenes[i]`, if `imageMode !== "template-only"`:
  - If `firstFrameImagePrompt` is present and `firstFrameImageR2Key` is empty, call **image-gen** (`--aspect 2:3 --kind video-frame --user-id "$LOC_USER_ID"`) and write the result into `firstFrameImageR2Key`.
  - Same for `lastFrameImagePrompt` → `lastFrameImageR2Key` (only when `firstFrameImageR2Key` is also set).
- Skip the `slides[]` background loop entirely.

Threads background — only if step 6 will render Threads (i.e. `topic.threadsFormat === "image"` AND a Threads target account is configured): apply the same imageMode logic to the single `threads` slot. `template-only` and missing `defaultBgR2Key` → leave key unset; the ThreadsCard composition still renders cleanly on its gradient.

**Idempotence**: honor existing `bgImageR2Key` / `firstFrameImageR2Key` values. If the user pre-generated a slide background in the dashboard, never overwrite it.

**Failure tolerance**: a single image-gen 422/429 should NOT fail the whole run. The image-gen skill already retries once. If it returns non-zero after the retry, leave that slide's `bgImageR2Key` unset and keep going — the composition gradients are tasteful enough on their own.

Re-save the updated brief with `set-brief`.

### 4b. Generate video clips (only when `kind === "reel-video"`)

For each `brief.video.scenes[i]` that lacks `videoR2Key`, invoke **video-gen** with the scene's Seedance 2.0 inputs:

```
bun src/sandbox/video-gen.ts gen \
  --prompt "<scenes[i].videoPrompt>" \
  --aspect-ratio "<scenes[i].aspectRatio || 9:16>" \
  --resolution "<scenes[i].resolution || 720p>" \
  --duration <scenes[i].durationSec || 5> \
  --generate-audio <scenes[i].generateAudio ?? true> \
  [--seed <scenes[i].seed>] \
  [--image $R2_PUBLIC_BASE/<firstFrameImageR2Key>] \
  [--last-frame-image $R2_PUBLIC_BASE/<lastFrameImageR2Key>] \
  --out-dir data/runs/$LOC_RUN_ID/video \
  --run-id $LOC_RUN_ID \
  --kind seedance-mp4 \
  --scene-index <i>
```

Capture stdout `r2Key` and write into `scenes[i].videoR2Key`. Re-save the brief with `set-brief`.

If a single scene fails after retries, set its `videoR2Key` to undefined and continue — the SeedanceReel composition draws a tasteful gradient fallback for missing clips. If MORE than half the scenes failed, mark the run failed — the reel won't be coherent.

### 5. Pick audio (Reels only — skip if no IG target)

Pick the first IG-platform template slug from `topic.templateSlugs`.

```
bun src/sandbox/select-audio.ts \
  --topic-id "$LOC_TOPIC_ID" \
  --template-slug <slug> \
  --duration <durationSec from template>
```

The output JSON has `id`, `r2Key`, and `attributionText`. Build `audioUrl = $R2_PUBLIC_BASE/<r2Key>`. Save the `id` as `audioTrackId` for step 7. If select-audio errors with "no audio tracks available", continue without audio and pass no `--audio-url` to render-reel.

### 6. Render

```sh
bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" rendering
```

- **Reels**: invoke **render-reel** with the IG template's `compositionId` (default `CardNews`; `SeedanceReel` for `kind === "reel-video"`), the brief path, the audio URL, and the attribution. The render-reel script auto-detects `SeedanceReel` and feeds `brief.video.scenes[]` to the composition; cards templates feed `brief.reel.slides[]`.
- **Threads**:
  - `topic.threadsFormat === "image"` → invoke **render-threads-image**.
  - `topic.threadsFormat === "text"` → skip rendering. The post is text-only.

If render-reel fails, mark the run failed — the publish step has nothing to upload.

### 7. Publish

```sh
bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" publishing
```

Compose hashtags for publish based on `topic.hashtagMode`:
- `ai`: use `brief.hashtags` verbatim.
- `fixed`: use `topic.fixedHashtags` verbatim.
- `mixed`: union of `brief.hashtags` and `topic.fixedHashtags`, deduped, capped at 30.

**Instagram** (when `targetAccounts.instagram` and `IG_ACCESS_TOKEN`):

```
bun src/sandbox/ig.ts publish-reel \
  --run-id $LOC_RUN_ID \
  --video-r2-key runs/$LOC_RUN_ID/reel.mp4 \
  --cover-r2-key runs/$LOC_RUN_ID/cover.jpg \
  --caption-body "<brief.caption.instagram>" \
  --hashtags "<comma-joined hashtags>" \
  --attribution "<attributionText>" \
  --audio-track-id "$audioTrackId" \
  --template-slug "$slug" \
  --lang ko
```

**Threads** (when `targetAccounts.threads` and `THREADS_ACCESS_TOKEN`):

```
bun src/sandbox/threads.ts publish \
  --run-id $LOC_RUN_ID \
  --text-body "<brief.threads.text or brief.caption.threads>" \
  --hashtags "<comma-joined hashtags, max 5 to leave room>" \
  --topic-tag "<brief.threadsTopicTag>" \
  --lang ko --template-slug "$slug" \
  [--image-r2-key runs/$LOC_RUN_ID/threads.jpg]   # only if threadsFormat=image
```

**Independence**: if Instagram publishes succeed but Threads fails (or vice versa), record the failure in `posts.errorMessage` for that platform but DO NOT fail the run as long as at least one platform succeeded. The orchestrator marks the run `done` and the failed post row reflects the per-platform error.

If both platforms fail OR no platform target was configured AND no posts were created, mark the run failed.

### 8. Done

```sh
bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" done
```

## Failure handling

- Any step that throws: write the error to stderr and call `set-status ... failed --error "<message>"`. Do NOT continue further steps.
- Steps are idempotent by `runId`. If you have a partial brief or already-uploaded asset, reuse it instead of regenerating.
- If you crash mid-step without setting status, the Worker reconciles to `failed` after the CLI exits — but the dashboard will show whichever state you last set, so be liberal with status updates.

## Caption attribution

The publish scripts compose `body + attribution + hashtags` themselves. **Do NOT** pre-compose attribution into `caption.*` — pass body and attribution separately, or the music line will appear twice.

## Language handling

- `topic.lang === "ko"` → Korean caption + Korean slides.
- `topic.lang === "en"` → English.
- `topic.lang === "ko+en"` → produce both. The brief's `caption` should contain a Korean variant in `caption.instagram` / `caption.threads`. Phase 1: publish `ko` only — full dual is Phase 2.
