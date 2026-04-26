---
name: content-plan
description: Turn research notes + topic persona into a viral-ready brief.json (slide outline + Threads copy + image prompts). Use after topic-research and before image generation.
allowed-tools: Read, Write
---

# content-plan

Inputs:
- `data/runs/$LOC_RUN_ID/topic.json`
- `data/runs/$LOC_RUN_ID/research.md`

Output:
- `data/runs/$LOC_RUN_ID/brief.json` matching the schema below.

## Brief schema

```json
{
  "brand": { "handle": "<from topic or default>", "name": "Loc" },
  "lang": "ko" | "en" | "ko+en",
  "captions": {
    "ko": "<IG/Threads caption in Korean, ≤140 chars body + 5-10 hashtags>",
    "en": "<English variant if lang=ko+en>"
  },
  "reel": {
    "slides": [
      {
        "kicker": "<2-4 word category, ALL CAPS>",
        "headline": "<≤14 chars Korean / ≤22 chars English. Punchy.>",
        "body": "<≤40 chars supporting line. Optional.>",
        "emphasis": "<single emoji used as stamp on a key slide. Optional.>",
        "bgImagePrompt": "<vivid prompt for Gemini, vertical 9:16, no text in image>"
      }
    ]
  },
  "threads": {
    "headline": "<≤14 chars Korean / ≤22 chars English>",
    "body": "<≤80 chars supporting line>",
    "bgImagePrompt": "<vivid prompt for Gemini, 4:5, no text>",
    "text": "<the post text body, ≤280 chars>"
  }
}
```

## Composition rules (viral instinct)

- **Slide 1 = hook**: a curiosity gap, contrast, or shocking number. Not a topic announcement.
- **Slides 2-4 = payoff**: each slide adds ONE concrete idea. No filler.
- **Slide 5 = action**: tell the viewer what to do (save, try, share).
- **Slide 6 (optional) = identity**: a memorable line that ties to the brand.
- 5-6 slides total. Never more.
- Headlines should be readable in 1 second. If you need to read it twice, shorten.
- Korean: 한 줄 14자 이내. 조사 줄이고 명사 위주. 영어: 22 chars.
- Image prompts: never request text in the image (leave text to the template). Mood: cinematic, editorial, high contrast, modern.
- Threads body and IG caption should NOT be the same. Threads is conversational; IG caption is curiosity + hashtags.

## Hashtag rules

- 5-10 tags. Mix of one big-volume (e.g. #shorts), a few mid-volume topical, one or two niche.
- Korean topics include both Korean and Romanized tags when natural.

## Steps

1. Read topic.json and research.md.
2. Apply persona prompt (`topic.personaPrompt`) as a tone overlay.
3. Draft and self-critique once: would *you* stop scrolling at slide 1?
4. Write `data/runs/$LOC_RUN_ID/brief.json` and stdout the path.

## Constraints

- Output JSON must validate. Use `Write` to save the file.
- If `topic.lang === "ko+en"`, fill BOTH `captions.ko` and `captions.en`. For now, the orchestrator will publish only `ko` until Phase 2.
