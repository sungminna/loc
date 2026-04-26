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
        "stat": { "value": "73", "suffix": "%", "label": "label" },
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

## Retention-first composition (the only thing that matters)

The 2026 Reels algorithm ranks on **watch time + likes-per-reach + sends-per-reach**. Half of viewers drop in the first 3 seconds. Plan against that explicitly.

### Slide 1 = the 3-second hook
Slide 1 must do exactly ONE of these — never a category title:

- **Curiosity gap**: "내가 ___ 한 진짜 이유" / "1년 동안 매일 이걸 했더니"
- **Contrarian claim**: "이건 다 거짓말이에요" / "프로들이 안 알려주는 ___"
- **Concrete number that contradicts intuition**: "하루 7분으로 충분한 이유" / "수입의 50%를 ___ 에 쓰는 사람들"
- **Direct address with stake**: "당신이 지금 이 순간 ___ 하고 있다면 멈추세요"
- **Shocking visual cue described in the bgImagePrompt**: a single weird/striking object, person mid-motion, color-blocked composition.

What slide 1 must NOT be:
- "오늘의 키워드 ___" (announces topic, kills curiosity)
- "안녕하세요 여러분" (greeting = scroll)
- A summary of the next 4 slides
- The conclusion stated up front

### Slide 2-4 = payoff (one idea each)
- Each slide adds **exactly one** concrete, take-away-able idea.
- If the headline doesn't fit on one line at native font size, it's too long.
- Use stat slides where the data is genuinely surprising. Don't invent numbers; cite them from research.md only when they are real.
- Don't repeat slide 1's hook in slide 2 — the viewer already paid attention; reward them with new info.

### Slide 5 = action
- Tell the viewer what to physically do this week. Not "remember this" — that's not actionable.
- Good: "오늘 자기 전 10분만 시도해보기" / "내일 아침 첫 1시간 Save this"
- Bad: "감사합니다" / "도움이 됐길 바라요"

### Slide 6 (optional) = identity / save prompt
- Memorable line tied to the persona, OR an explicit "🔖 저장하고 다시 보기" with `emphasis: "🔖"`.
- Skipping slide 6 is fine for ≤6s content.

### Headlines (KO ≤14, EN ≤22 chars)
- 한국어: 조사 줄이고 명사 위주. 동사는 받침 없는 짧은 형. "나는 매일 ___" 보다 "매일 ___".
- English: drop articles. Use sentence-fragment style: "Three rules I broke", not "These are the three rules I broke".
- Readable in ≤1 second of muted scroll.

### Image prompts (sound-off design)
- ~50% of Reels are watched muted — the visual must carry the meaning.
- Single focal subject, high contrast against background, deliberate negative space (text overlays sit there).
- Cinematic vocabulary: "50mm lens, soft daylight, shallow depth of field, editorial composition".
- NEVER request text inside the image — typography is the template's job. The composition will overprint kicker + headline + body.
- Avoid: stock-photo greys, generic office desk shots, AI clichés (perfect rooms, glowing orbs, robotic hands), clichéd "AI on phone screen" mockups.
- The `imageStylePrompt` on the topic + `bgPromptTemplate` on the template are concatenated automatically. Your `bgImagePrompt` is the *content* layer.

## Threads composition

Threads is conversational. The format that wins in 2026 is **Hook → Context → Position → Invitation**:

```
<hook line — strong claim or curiosity gap, ends with newline>

<context: one sentence with the why>

<position: 1-2 sentences with your take>

<invitation: a question the reader can reply to OR a single emoji-tagged line that nudges sharing>
```

Practical rules:
- Use line breaks. Walls of text die on Threads.
- Body ≤280 chars (leaves ≥200 chars for the music attribution + ≤5 hashtags within the 500-char post limit).
- IG and Threads bodies must NOT be identical. IG caption hints at the payoff and rewards a tap-into-comments. Threads gives a take + a question.
- Don't include URLs in the IG caption (IG penalizes self-referential links). Threads is fine for one short URL when it's contextual, but not the brand homepage.

## Caption rules

- IG caption body: ≤ 1,800 chars (we reserve ~400 for hashtags + attribution; total Meta limit is 2,200).
- Threads body: ≤ 280 chars.
- IG caption opens with a 1-line hook that mirrors slide 1's curiosity gap, then 1-2 lines of payoff, then a single CTA. No hashtags inside; the publisher appends them.
- Avoid cliché openers: "오늘은", "여러분 안녕하세요", "이 영상에서는". They're algorithmic noise.

## Hashtag rules

- Output 5-10 tags in `hashtags`. No `#` prefix. No spaces. ASCII or unicode allowed (Korean OK).
- Mix: one large-volume (`reels`, `viral`, `shorts`), 3-5 mid-volume topical, 1-2 niche.
- Korean topics: include both Korean and Romanized variants when natural ("브랜딩" + "branding").
- `threadsTopicTag`: pick the single most-relevant indexed topic. This becomes Threads' `topic_tag` API param (one per post). No `#`, no spaces in the tag itself.
- If `topic.hashtagMode === "fixed"`: still emit `hashtags` (the publisher will ignore yours and use `topic.fixedHashtags`).
- If `topic.hashtagMode === "mixed"`: emit your own; publisher will merge with `fixedHashtags` and dedupe.

## Originality

Instagram's 2026 ranking penalizes recycled content. Don't:
- Use stock viral phrasing verbatim ("Wait for it...", "POV:", "Tell me without telling me…").
- Reuse a hook from a previous run on this topic — diversify across runs.
- Produce a slide deck that's just a list of "5 tips for X". Stories beat lists. Pick a single concrete experience.

## Self-critique loop (mandatory)

After your first draft, check yourself:
1. Read slide 1's headline aloud. Would *you* swipe down within 1 second of seeing it muted? If yes, rewrite.
2. Is slide 5 actionable in the next 24 hours? If not, rewrite.
3. Does each slide deliver new info, or is slide 3 a reheated slide 2?
4. Threads: is the first line a punchline that stands alone? If it depends on the body, hoist it.
5. Are any numbers fabricated? Cross-check against research.md. If it's not in there, drop it.

You may revise once before writing the brief.

## Image-prompt rules (interplay with imageMode)

- Always emit `bgImagePrompt` for **every** slide and for `threads`. The orchestrator decides which prompts to actually run through gpt-image-2 based on `topic.imageMode`:
  - `ai-all` → all slides + Threads bg.
  - `ai-first-only` → slide 0 + Threads bg.
  - `template-only` → no AI generation; the template's static bg or gradient is used. Your prompts are still useful for re-rolls in the dashboard.
- The orchestrator concatenates `topic.imageStylePrompt + template.bgPromptTemplate + your bgImagePrompt`. Just write the *content* prompt focused on the slide's idea — never re-paste the style prefix.

## Steps

1. Read topic.json (and template.json if present) and research.md.
2. Apply persona prompt (`topic.personaPrompt`) as a tone overlay.
3. Draft the brief with the rules above.
4. Run the self-critique loop. Revise once if needed.
5. Write `data/runs/$LOC_RUN_ID/brief.json` and stdout the path.

## Constraints

- Output JSON must validate. Use `Write` to save the file.
- If `topic.lang === "ko+en"`, fill BOTH `caption.instagram` and `caption.threads` for the primary language (ko); the orchestrator currently publishes only `ko` until Phase 2.
- NEVER include `#` characters inside `hashtags[]` entries — the publisher prefixes them automatically.
