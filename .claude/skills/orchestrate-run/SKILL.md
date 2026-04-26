---
name: orchestrate-run
description: Drive a complete autonomous content cycle for one topic — research, plan, generate images, render reel, publish to Instagram and Threads. Invoked by the Worker queue consumer when a topic is due.
allowed-tools: Bash, Read, Write, WebFetch, WebSearch, Skill
---

# orchestrate-run

You are running one autonomous cycle for a single topic. The runId and topicId are in env vars `LOC_RUN_ID` and `LOC_TOPIC_ID`. All artifacts go under `data/runs/$LOC_RUN_ID/`.

## Steps

1. **Load context + user overrides**
   - `bun src/sandbox/db-cli.ts get-topic "$LOC_TOPIC_ID"` → save the JSON to `data/runs/$LOC_RUN_ID/topic.json`. Note these fields:
     - `lang`, `personaPrompt`, `imageStylePrompt`, `sourceUrls`, `templateSlugs`, `targetAccounts`, `audioPrefs`.
     - `imageMode` ∈ `ai-all | ai-first-only | template-only` — drives step 4.
     - `threadsFormat` ∈ `text | image` — drives step 6 + 7 (Threads).
     - `hashtagMode` ∈ `ai | fixed | mixed`, `fixedHashtags: string[]` — drives publish step.
   - For each platform-side template configured (currently we only honor `templateSlugs[0]`), fetch with `bun src/sandbox/db-cli.ts get-template <slug>` and save to `data/runs/$LOC_RUN_ID/template.json`. Note `platform`, `compositionId`, `durationSec`, `bgMode`, `defaultBgR2Key`, `bgPromptTemplate`, `accentColor`. If `template.platform === "threads"` it applies to the Threads card; pull a separate IG template from `templateSlugs[1]` if present, otherwise the IG flow runs without a custom template.
   - `bun src/sandbox/db-cli.ts get-skill-prompts` → save to `data/runs/$LOC_RUN_ID/skill_overrides.json`. Before invoking each Skill below, read its corresponding override (if any) and treat it as additional, higher-priority instructions for that step.
   - `bun src/sandbox/db-cli.ts get-topic-draft` → save to `data/runs/$LOC_RUN_ID/topic_draft.json`. The shape is `{ useDraft: bool, draft: <brief.json | null>, imageStylePrompt: string }`.
   - **If `useDraft` is true and `draft` is non-null:** copy `draft` verbatim to `data/runs/$LOC_RUN_ID/brief.json`, persist with `set-brief`, then call `bun src/sandbox/db-cli.ts consume-topic-draft` (resets the flag), and **skip steps 2–3** (research + plan) — jump to step 4. **Exception (reel-video):** if `template.kind === "reel-video"` AND `brief.video?.scenes?.length` is 0 or missing, run **only the video-storyboard skill** to populate `brief.video.scenes[]` before continuing — research + content-plan are still skipped (the draft already supplied caption/hashtags).

2. **Research** (status: `researching`)
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" researching`
   - Invoke the **topic-research** skill. It scrapes the topic's sourceUrls and writes research notes.
   - If sourceUrls is empty, fall back to `WebSearch` for "trending topic <topic.name>" plus 1-2 related queries.

3. **Plan** (status: `planning`)
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" planning`
   - Invoke the **content-plan** skill. It produces `data/runs/$LOC_RUN_ID/brief.json`. The brief contains `caption.{instagram,threads}` (BODY only, no hashtags), `hashtags[]`, and `threadsTopicTag`.
   - **If the IG template's `kind === "reel-video"` (or `compositionId === "SeedanceReel"`)**, also invoke **video-storyboard** to append `brief.video.scenes[]` (3-5 cinematic scenes with Seedance prompts).
   - Persist the brief: `bun src/sandbox/db-cli.ts set-brief "$LOC_RUN_ID" data/runs/$LOC_RUN_ID/brief.json`.

4. **Generate images** (status: `generating`) — branch on `topic.imageMode`
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" generating`
   - Compose prompt prefix from `topic.imageStylePrompt` + (if available) the IG template's `bgPromptTemplate`. Concatenate as `<style>. <bgPromptTemplate>. <slide.bgImagePrompt>` skipping empty parts.
   - Slide backgrounds (only when the IG template is **not** `reel-video`):
     - `imageMode = "ai-all"`: for each `slides[i]` lacking `bgImageR2Key`, run **image-gen** (`--aspect 2:3 --kind image-bg --user-id "$LOC_USER_ID"`) and write the resulting `r2Key` into `slides[i].bgImageR2Key`.
     - `imageMode = "ai-first-only"`: only generate for `slides[0]` (if missing). For `slides[1..]`, set `bgImageR2Key = template.defaultBgR2Key` if non-empty; otherwise leave `bgImageR2Key` undefined (the composition renders on its gradient).
     - `imageMode = "template-only"`: for every slide, set `bgImageR2Key = template.defaultBgR2Key` if non-empty; otherwise leave it undefined. Do not call image-gen.
   - **Video-reel templates (`kind === "reel-video"`):**
     - For each `brief.video.scenes[i]`, if `imageMode !== "template-only"`:
       - If `firstFrameImagePrompt` is present and `firstFrameImageR2Key` is empty, call **image-gen** (`--aspect 2:3 --kind video-frame --user-id "$LOC_USER_ID"`) and write the result into `firstFrameImageR2Key`.
       - Same for `lastFrameImagePrompt` → `lastFrameImageR2Key` (only when `firstFrameImageR2Key` is also set).
     - Skip the slides[] background loop entirely.
   - Threads background — **only if step 6 will render Threads** (i.e. `topic.threadsFormat === "image"` AND a Threads target account is configured):
     - Same imageMode logic applied to the single `threads` slot. `template-only` and missing `defaultBgR2Key` → leave key unset; the ThreadsCard composition still renders cleanly on its gradient.
   - Re-save the updated brief with `set-brief`.
   - Honor existing `bgImageR2Key` / `firstFrameImageR2Key` values: if the user pre-generated a slide background in the dashboard, never overwrite it.

4b. **Generate video clips** (only when `kind === "reel-video"`)
   - For each `brief.video.scenes[i]` that lacks `videoR2Key`, invoke **video-gen** with the scene's Seedance 2.0 inputs:
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
   - Capture stdout `r2Key` and write into `scenes[i].videoR2Key`. Re-save the brief with `set-brief`.
   - Failure handling: if a single scene fails after retries, set its `videoR2Key` to undefined and continue — the SeedanceReel composition draws a tasteful gradient fallback for missing clips.

5. **Pick audio** (Reels only — skip if no IG target)
   - Pick the first IG-platform template slug from `topic.templateSlugs`.
   - Run `bun src/sandbox/select-audio.ts --topic-id "$LOC_TOPIC_ID" --template-slug <slug> --duration <durationSec from template>`.
   - The output JSON has `id`, `r2Key`, and `attributionText`. Build `audioUrl = $R2_PUBLIC_BASE/<r2Key>`. **Save the `id` as `audioTrackId`** for step 7.

6. **Render** (status: `rendering`)
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" rendering`
   - **Reels**: invoke **render-reel** with the IG template's `compositionId` (default `CardNews`; `SeedanceReel` for `kind === "reel-video"`), the brief path, the audio URL, and the attribution. The render-reel script auto-detects `SeedanceReel` and feeds `brief.video.scenes[]` to the composition; cards templates feed `brief.reel.slides[]`.
   - **Threads**:
     - `topic.threadsFormat === "image"` → invoke **render-threads-image**.
     - `topic.threadsFormat === "text"` → skip rendering. The post is text-only.

7. **Publish** (status: `publishing`)
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" publishing`
   - Compose hashtags for publish based on `topic.hashtagMode`:
     - `ai`: use `brief.hashtags` verbatim.
     - `fixed`: use `topic.fixedHashtags` verbatim.
     - `mixed`: union of `brief.hashtags` and `topic.fixedHashtags`, deduped, capped at 30.
   - **Instagram** (when `targetAccounts.instagram` and `IG_ACCESS_TOKEN`):
     - For each target language (Phase 1: just `ko` if `lang=ko+en`), run **ig-publish-reel**:
       ```
       --caption-body "<brief.caption.instagram>" \
       --hashtags "<comma-joined hashtags>" \
       --attribution "<attributionText>" \
       --audio-track-id "$audioTrackId" \
       --template-slug "$slug" \
       --lang ko
       ```
   - **Threads** (when `targetAccounts.threads` and `THREADS_ACCESS_TOKEN`):
     - Run **threads-publish**:
       ```
       --text-body "<brief.threads.text or brief.caption.threads>" \
       --hashtags "<comma-joined hashtags, max 5 to leave room>" \
       --topic-tag "<brief.threadsTopicTag>" \
       [--image-r2-key runs/$LOC_RUN_ID/threads.jpg]   # only if threadsFormat=image
       --lang ko --template-slug "$slug"
       ```

8. **Done**
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" done`

## Failure handling

- Any step that throws: write the error to stderr and call `set-status ... failed --error "<message>"`. Do NOT continue further steps.
- Steps are idempotent by `runId`. If you have a partial brief or already-uploaded asset, reuse it instead of re-generating.

## Caption attribution

The publish scripts now compose `body + attribution + hashtags` themselves. **Do NOT** pre-compose attribution into `caption.*` — pass body and attribution separately, or the music line will appear twice.

## Language handling

- `topic.lang === "ko"` → Korean caption + Korean slides.
- `topic.lang === "en"` → English.
- `topic.lang === "ko+en"` → produce both. The brief's `caption` should contain a Korean variant in `caption.instagram` / `caption.threads`. Phase 1: publish `ko` only — full dual is Phase 2.
