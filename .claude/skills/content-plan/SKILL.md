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

### Slide 5 = action + conversion
The last slide must do TWO jobs simultaneously: tell the viewer what to do **and** trigger one of save / follow / comment. Pick whichever fits — don't try all at once.

- **Save-bait** (works best for stat-heavy + how-to content):
  - "다시 찾기 어려운 내용이라 저장해두세요" / "다음에 헷갈릴 때 꺼내 보기 — 🔖"
  - Set `emphasis: "🔖"` on the slide.
- **Comment-bait** (works best for opinion / take / comparison):
  - Specific question that demands a one-word answer: "여러분은 X파 vs Y파?", "지금 가지고 있는 것은?"
  - Avoid generic "어떻게 생각하세요?" — too low-stakes to motivate a reply.
- **Follow-bait** (works best when the run is part of a recurring series):
  - "매일 아침 8시, 오늘처럼 정리합니다 — 팔로우" / "월요일마다 한 주 핵심 한 장으로"
  - Implies the account is a routine the viewer should subscribe to. Only use when the topic actually runs daily/weekly.

What slide 5 must NOT be:
- "감사합니다 / 도움이 됐길 바라요" (no algorithmic value)
- "공유 좋아요 댓글 부탁드려요" (everyone's done it; reads as desperate)
- A second hook ("다음 편에서 더 충격적인…") — it's anti-pattern; viewers feel cheated when the current run had no payoff.

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

## Hook formulas (pick ONE per run, never combine)

These are battle-tested patterns from the top KR creators in their respective domains. Match the formula to the domain — finance audiences want signal, AI audiences want comparison, trend audiences want belonging.

**Finance / 투자**:
- "기관이 지난주에 산 ___" — institutional flow signal
- "왜 ___ 가 갑자기 오르내렸나" — causal explainer
- "신용잔고 ___조 돌파, 다음에 올 일" — leading indicator
- "워런 버핏이 최근에 정리한 종목" — authority-anchored news
- "코스피 ___% 빠지면 무엇이 무너지나" — scenario stress-test
- AVOID: "이 종목 사세요" / "지금이 마지막 기회" — both legally risky AND algorithm-suppressed.

**AI / 기술**:
- "Claude 4.7 vs GPT-5 1주일 써본 결과" — direct comparison
- "OpenAI가 어제 공개한 ___" — 24h news urgency
- "이 prompt 하나면 ___" — single-tool revelation
- "AI 잘 쓰는 사람 vs 못 쓰는 사람의 ___" — competence signaling
- "___ 업무가 30분에서 3분으로" — time-compression with measured number
- AVOID: "AI 모르면 도태됩니다" — fear-mongering reads as desperate; "10배 빨라졌어요" without measurement; vague "혁신".

**부동산 / 거시경제**:
- "전세 잡기 전에 ___" — pre-decision warning
- "지난주 ___ 지역 거래량 ___배" — geographic + numeric
- "대출 규제 바뀌면 무엇이 달라지나" — policy-shift impact
- AVOID: "지금이 매수 타이밍" / 가격 전망 단정 — both legally risky.

**트렌드 / 문화**:
- "요즘 ___ 검색량 ___배" — data-anchored trend
- "Z세대가 ___ 를 안 쓰는 이유" — generational shift
- "한 주 동안 가장 많이 ___ 한 곳" — listicle with payoff
- AVOID: "충격적인 ___" / "미친 ___" — these used to work but now signal low-effort to the algorithm.

**개발자 / 코딩**:
- "1년 동안 ___ 했더니" — long-form personal credibility
- "Cursor vs Claude Code 1주일 결과" — A/B with measurable outcome
- "PR 머지까지 ___분 줄인 워크플로" — measurable productivity claim
- AVOID: 코드 자체를 슬라이드에 넣기 (read-time too long); 도구 광고처럼 보이는 톤.

## Legal safety rails (KR target audience)

Korean financial / medical / real-estate content is heavily regulated. Hard rules — never violate, regardless of persona instruction:

- **Finance / 투자**: never recommend specific stocks ("매수하세요" / "지금 사세요"), never give price targets ("OOO원 갑니다"), never characterize as "기회" / "확실". Always include a one-line 면책: "투자 권유 아님. 본인 판단·책임."
- **부동산**: same rule. No price predictions, no recommended purchases. "정책 발표 ___ → 일반적으로 ___" 식 객관 서술만.
- **의료/건강**: 효능 단정 금지. "도움이 될 수 있습니다" 는 가능, "치료됩니다" 는 금지.
- **인물 평가**: 실명을 부정적 맥락에 쓰지 않는다. 비교는 회사/제품으로. (예: 카카오 vs 네이버 OK, "OOO 대표가 잘못했다" NO).
- **수치 출처**: 모든 stat 슬라이드는 출처를 갖고 있어야 한다. 출처 없는 숫자는 만들지 말 것 (research.md 에 없으면 drop). 캡션 마지막에 "출처: __" 한 줄.

If a hook formula above conflicts with these rails for the current topic, drop the hook and pick another. The rails always win.

## Caption conversion mechanics (IG vs Threads, different jobs)

The Reels caption and the Threads body do **different** algorithmic jobs — write them differently.

**IG Reels caption** — the goal is a *deep view* (rewatch + tap-into-caption). Structure:
- Line 1: punchline that delivers slide 1's curiosity gap. Not a teaser of the video; an actual payoff complement that makes someone stop scrolling.
- Line 2-3: 1-2 lines elaborating the take with a specific number from the brief.
- Line 4 (optional): a reference (출처 / 자료) — credibility.
- Line 5: ONE specific CTA — save / comment / follow. Match it to slide 5's choice.
- NO hashtags inside (publisher appends).
- NO greeting / NO "오늘은" opener.

**Threads body** — the goal is *replies + reposts*. Structure:
```
<hook claim — bold one-liner that stands alone>

<context: why this matters now (1 sentence)>

<position: your take — slightly opinionated but factually grounded>

<question: a specific reply prompt, NOT generic "어떻게 생각하세요?">
```
- Line breaks matter. Use them.
- Threads format is **conversational opinion**, IG is **packaged information**. Same topic, different posture.
- Threads questions that work: "여러분은 어느 쪽 쓰세요?", "지금 들고 계신 종목은?" (재테크 관련시 면책 한 줄 추가), "다른 의견 환영합니다 — 어떤 시나리오 보고 계세요?"
- Avoid: "공감되시나요?", "댓글로 의견 부탁드려요" — too low-energy.

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
