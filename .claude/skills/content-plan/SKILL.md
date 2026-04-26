---
name: content-plan
description: Turn research notes + topic persona into a viral-ready brief.json (slide outline + Threads copy + per-platform captions + hashtags + image prompts). Use after topic-research and before image generation.
allowed-tools: Read, Write
---

# content-plan

Inputs:
- `data/runs/$LOC_RUN_ID/topic.json` — full topic row including `lang`, `personaPrompt`, `imageStylePrompt`, `imageMode`, `threadsFormat`, `hashtagMode`, `fixedHashtags`.
- `data/runs/$LOC_RUN_ID/research.md`
- (optional) `data/runs/$LOC_RUN_ID/template.json` — the IG template row when one is configured. Use its `bgPromptTemplate` as a style overlay if present.

Output:
- `data/runs/$LOC_RUN_ID/brief.json` matching the schema below.

## When to also call video-storyboard

If `template.json` has `kind === "reel-video"` (or `compositionId === "SeedanceReel"`), **stop after writing the brief** and let the orchestrator invoke the **video-storyboard** skill — it will append `video.scenes[]` to the brief. content-plan's job in that case is to nail down the caption, hashtags, threadsTopicTag, and a 1-line topic description; do NOT try to also invent the video scenes.

`reel.slides[]` is still useful for video-reel briefs (it acts as the textual outline the storyboard skill turns into scenes), so keep producing it.

## Brief schema (canonical — keep keys exactly as written)

```json
{
  "brand": { "handle": "<from topic, default '@yourhandle'>", "name": "Loc" },
  "lang": "ko" | "en" | "ko+en",
  "reel": {
    "slides": [
      {
        "kicker": "<2-4 word category, ALL CAPS>",
        "headline": "<≤14 chars Korean / ≤22 chars English. Punchy.>",
        "body": "<≤40 chars supporting line. Optional.>",
        "emphasis": "<single emoji used as stamp on a key slide. Optional.>",
        "bgImagePrompt": "<vivid prompt for gpt-image-2, vertical, no text in image>"
      }
    ]
  },
  "threads": {
    "headline": "<≤14 chars Korean / ≤22 chars English>",
    "body": "<≤80 chars supporting line>",
    "bgImagePrompt": "<vivid prompt for gpt-image-2, 4:5, no text>",
    "text": "<post body, ≤280 chars (leaves headroom for attribution + hashtags within Threads' 500-char limit)>"
  },
  "caption": {
    "instagram": "<IG caption BODY only — NO hashtags, NO music attribution>",
    "threads":   "<Threads BODY only — NO hashtags, NO music attribution>"
  },
  "hashtags": ["tag1", "tag2", "..."],
  "threadsTopicTag": "<single indexed tag, no #, ≤50 chars, no '.' or '&'>"
}
```

> **Why split caption and hashtags?** The publish scripts compose
> `body + attribution + hashtags`. If you bake hashtags into `caption.*`,
> they'll be appended twice and the IG 30-tag limit will trip.

## Composition rules (viral instinct)

- **Slide 1 = hook**: a curiosity gap, contrast, or shocking number. Not a topic announcement.
- **Slides 2-4 = payoff**: each slide adds ONE concrete idea. No filler.
- **Slide 5 = action**: tell the viewer what to do (save, try, share).
- **Slide 6 (optional) = identity**: a memorable line that ties to the brand.
- 5-6 slides total. Never more.
- Headlines should be readable in 1 second. If you need to read it twice, shorten.
- Korean: 한 줄 14자 이내. 조사 줄이고 명사 위주. 영어: 22 chars.
- Image prompts: never request text in the image (leave text to the template). Mood: cinematic, editorial, high contrast, modern.
- Threads body and IG caption should NOT be the same. Threads is conversational; IG caption is curiosity + concrete payoff hint.

## Caption rules

- IG caption body: ≤ 1,800 chars (we reserve ~400 for hashtags + attribution; total Meta limit is 2,200).
- Threads body: ≤ 280 chars (leaves room for attribution + ≤5 hashtags within the 500-char total).
- DO NOT include URLs in IG captions — they aren't clickable and IG penalizes self-referential links.

## Hashtag rules

- Output 5-10 tags in `hashtags`. No `#` prefix. No spaces. ASCII or unicode allowed (Korean OK).
- Mix: one big-volume (e.g. `shorts`, `reels`, `viral`), 3-5 mid-volume topical, 1-2 niche.
- Korean topics: include both Korean and Romanized variants when natural.
- `threadsTopicTag`: pick the single most-relevant indexed topic. This becomes Threads' `topic_tag` API param (one per post).
- If `topic.hashtagMode === "fixed"`: still emit `hashtags` (the publisher will ignore yours and use `topic.fixedHashtags`).
- If `topic.hashtagMode === "mixed"`: emit your own; publisher will merge with `fixedHashtags` and dedupe.

## Image-prompt rules (interplay with imageMode)

- Always emit `bgImagePrompt` for **every** slide and for `threads`. The orchestrator decides which prompts to actually run through gpt-image-2 based on `topic.imageMode`:
  - `ai-all` → all slides + Threads bg.
  - `ai-first-only` → slide 0 + Threads bg.
  - `template-only` → no AI generation; the template's static bg or gradient is used. Your prompts are still useful for re-rolls in the dashboard.
- Prefix every prompt with `topic.imageStylePrompt` and (when present) `template.bgPromptTemplate`. The orchestrator handles concatenation; just write the *content* prompt focused on the slide's idea.

## Steps

1. Read topic.json (and template.json if present) and research.md.
2. Apply persona prompt (`topic.personaPrompt`) as a tone overlay.
3. Draft and self-critique once: would *you* stop scrolling at slide 1?
4. Write `data/runs/$LOC_RUN_ID/brief.json` and stdout the path.

## Constraints

- Output JSON must validate. Use `Write` to save the file.
- If `topic.lang === "ko+en"`, fill BOTH `caption.instagram` and `caption.threads` for the primary language (ko); the orchestrator currently publishes only `ko` until Phase 2.
- NEVER include `#` characters inside `hashtags[]` entries — the publisher prefixes them automatically.
