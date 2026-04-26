---
name: orchestrate-run
description: Drive a complete autonomous content cycle for one topic — research, plan, generate images, render reel, publish to Instagram and Threads. Invoked by the Worker queue consumer when a topic is due.
allowed-tools: Bash, Read, Write, WebFetch, WebSearch, Skill
---

# orchestrate-run

You are running one autonomous cycle for a single topic. The runId and topicId are in env vars `LOC_RUN_ID` and `LOC_TOPIC_ID`. All artifacts go under `data/runs/$LOC_RUN_ID/`.

## Steps

1. **Load context**
   - `bun src/sandbox/db-cli.ts get-topic "$LOC_TOPIC_ID"` → save the JSON to `data/runs/$LOC_RUN_ID/topic.json`.
   - Read the topic. Note: `lang`, `personaPrompt`, `sourceUrls`, `templateSlugs`, `targetAccounts`, `audioPrefs`.

2. **Research** (status: `researching`)
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" researching`
   - Invoke the **topic-research** skill. It scrapes the topic's sourceUrls and writes research notes.
   - If sourceUrls is empty, fall back to `WebSearch` for "trending topic <topic.name>" plus 1-2 related queries.

3. **Plan** (status: `planning`)
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" planning`
   - Invoke the **content-plan** skill. It produces `data/runs/$LOC_RUN_ID/brief.json` matching the schema in that skill.
   - Persist the brief: `bun src/sandbox/db-cli.ts set-brief "$LOC_RUN_ID" data/runs/$LOC_RUN_ID/brief.json`.

4. **Generate images** (status: `generating`)
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" generating`
   - For each `slides[i].bgImagePrompt` in the brief, run the **image-gen** skill with `--aspect 2:3 --kind gemini-bg --user-id "$LOC_USER_ID"`. Capture the resulting r2Key into the brief at `slides[i].bgImageR2Key`.
   - For `threads.bgImagePrompt`, run with `--aspect 2:3 --kind gemini-bg --user-id "$LOC_USER_ID"`. Set `threads.bgImageR2Key`.
   - (GPT Image 2 only supports 1:1, 3:2, 2:3. Templates `objectFit: cover` so any input fills the slide.)
   - Re-save the updated brief.

5. **Pick audio**
   - Pick the first template slug from `topic.templateSlugs` (if any).
   - Run `bun src/sandbox/select-audio.ts --topic-id "$LOC_TOPIC_ID" --template-slug <slug> --duration <durationSec from template>`.
   - The output JSON has `r2Key` and `attributionText`. Build `audioUrl = $R2_PUBLIC_BASE/<r2Key>`.

6. **Render** (status: `rendering`)
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" rendering`
   - Invoke the **render-reel** skill with the chosen composition (default `CardNews`), the brief path, the audio URL, and the attribution.
   - Invoke the **render-threads-image** skill.

7. **Publish** (status: `publishing`)
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" publishing`
   - If the topic has `targetAccounts.instagram` and `IG_ACCESS_TOKEN` env is set:
     - For each target language (ko, en, or both per `topic.lang`), invoke **ig-publish-reel** with the rendered reel and the per-language caption from the brief.
   - If the topic has `targetAccounts.threads` and `THREADS_ACCESS_TOKEN` is set:
     - Invoke **threads-publish** with the rendered Threads image and per-language text.

8. **Done**
   - `bun src/sandbox/db-cli.ts set-status "$LOC_RUN_ID" done`

## Failure handling

- Any step that throws: write the error to stderr and call `set-status ... failed --error "<message>"`. Do NOT continue further steps.
- Steps are idempotent by `runId`. If you have a partial brief or already-uploaded asset, reuse it instead of re-generating.

## Caption attribution

Append the audio attribution (when present) to every caption on a new line. Example:
```
<caption body>

🎵 Music: <attributionText>
```

## Language handling

- `topic.lang === "ko"` → Korean caption + Korean slides.
- `topic.lang === "en"` → English.
- `topic.lang === "ko+en"` → produce both. The brief's `captions` should contain `{ko, en}` and you publish twice to each platform when both target accounts are configured for that language. (Phase 1: just pick `ko` if the topic has both — full dual is Phase 2.)
