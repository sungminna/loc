---
name: image-gen
description: Generate background or asset images via Replicate's openai/gpt-image-2 model. Use when the brief specifies bgImagePrompt fields. Uploads to R2 and records as an asset.
allowed-tools: Bash
---

# image-gen (Replicate · openai/gpt-image-2)

Run:

```
bun src/sandbox/image-gen.ts gen \
  --prompt "<bgImagePrompt verbatim>" \
  --aspect 2:3 \                # 1:1 (square) | 3:2 (landscape) | 2:3 (portrait)
  --count 1 \
  --quality auto \              # low | medium | high | auto
  --output-format webp \        # webp | png | jpeg
  --output-compression 90 \     # 0-100
  --background auto \           # auto | opaque  (no transparency on this model)
  --moderation auto \           # auto | low
  --user-id "$LOC_USER_ID" \    # OpenAI abuse tracking
  --out-dir data/runs/$LOC_RUN_ID/img \
  --run-id $LOC_RUN_ID \
  --kind image-bg               # asset.kind for any AI-generated background
```

Stdout: NDJSON, one line per image.
`{ "assetId": "...", "r2Key": "runs/<runId>/image-bg/<file>.webp", "url": "https://pub-...r2.dev/...", ... }`

Capture the `r2Key` and write it back into the brief.json at:
- `slides[i].bgImageR2Key` for slide backgrounds (use `--aspect 2:3`)
- `threads.bgImageR2Key` for the Threads card (use `--aspect 2:3` or `--aspect 1:1`)

## Aspect-ratio mapping

| Need | Use |
|---|---|
| Reels 9:16 slide bg | `--aspect 2:3` (closest portrait the model supports; template covers it) |
| Threads 4:5 photo bg | `--aspect 2:3` |
| Square cover/thumb | `--aspect 1:1` |
| Landscape OG image | `--aspect 3:2` |

GPT Image 2 only supports 1:1, 3:2, 2:3. Remotion templates use `objectFit: cover` so any input fills the slide.

## The prompt template (always use this order)

gpt-image-2 weighs the **earliest tokens hardest** and reads the prompt as a directed sequence. The OpenAI cookbook documents this five-section structure; the section everyone skips ("Constraints") is where most AI-looking outputs come from. Write every prompt as:

```
1. Scene        — environment, time, atmosphere (1 line)
2. Subject      — who/what is the focal point (1 line)
3. Key details  — materials, light source, lens, surface texture, imperfection (1-2 lines)
4. Use case     — what this image is for (1 line — sets composition mode)
5. Constraints  — what must NOT appear (1 line — negatives)
```

Stay terse. Each section is 1-2 lines, not a paragraph. The orchestrator appends sections 4 and 5 automatically (use case = "vertical 2:3 cover frame for an Instagram Reel"; constraints = "no text/logo/watermark/UI"), so the **bgImagePrompt you write only needs to cover sections 1-3 plus a tonality cue**. Don't repeat the use case or the constraints — duplication confuses the parser.

## Photographic vocabulary cheatsheet

These are the words that flip gpt-image-2 from "AI illustration" to "actual photo":

**Lens / camera**
- `35mm film`, `50mm prime`, `85mm portrait lens`, `medium format`, `Polaroid SX-70`, `disposable camera`
- `shallow depth of field`, `bokeh`, `subtle film grain`, `slight chromatic aberration`, `lens flare from window`
- `documentary handheld`, `eye-level`, `top-down flat-lay`, `Dutch tilt at 5°`

**Light source (name it specifically)**
- `soft north window light`, `single overhead tungsten`, `mixed fluorescent + neon`
- `golden hour through dust`, `blue-hour overcast`, `late-afternoon side rake`, `harsh midday`
- `bounce card on the right, no key light from above`

**Material / surface (this is what kills the plastic look)**
- `chipped paint`, `wet concrete`, `worn canvas`, `scratched aluminum`, `condensation on glass`
- `rumpled linen`, `faded denim`, `cracked leather`, `rusted bolt`, `dog-eared paper`, `coffee stain on the desk`
- For people: `visible pores, fine lines, slight skin redness, hair flyaway, unretouched`

**Mood (in concrete nouns, not adjectives)**
- Not `nostalgic` — `a half-empty mug, the radio is on, rain on the window`
- Not `cinematic` — `rim light from a single street lamp, the rest is shadow`
- Not `cozy` — `a wool blanket bunched over the armrest, two cushions out of place`

## Anti-slop list (REMOVE these from any prompt)

These words push the model into synthetic / concept-art mode. Strip them before sending:

- ❌ Vague praise: `stunning`, `incredible`, `epic`, `masterpiece`, `gorgeous`, `insane detail`, `award-winning`, `breathtaking`, `jaw-dropping`
- ❌ Resolution flexing: `8K`, `4K`, `ultra-realistic`, `hyper-realistic` (use `35mm film` or `documentary photograph` instead)
- ❌ AI-art clichés: `glowing orb`, `holographic interface`, `cyberpunk neon city`, `dramatic god rays`, `floating particles`, `magic energy aura`
- ❌ Stock-tech tropes: `robot hand reaching toward human hand`, `brain made of circuits`, `perfect minimalist office`, `smiling business team in a sunlit conference room`
- ❌ Style soup: `minimalist brutalist editorial luxury photoreal cinematic` (pick ONE register and commit)
- ❌ Emotion abstractions: `evoking trust`, `feeling of innovation`, `sense of empowerment` (replace with what's in the frame)

## Worked examples (copy these patterns)

### Slide-0 cover for an AI-tools topic
```
A solo developer at a kitchen table at 1am, hunched over a 13-inch laptop, half-eaten ramen cup pushed to the edge of the desk, three dim Slack notifications glowing on the screen. Single warm desk lamp and the laptop's cold backlight crossing on the face. 35mm film grain, shallow depth of field, the keyboard out of focus. Subject sits to the right; the upper-left third is dark wall. Muted earth tones, one pale-amber accent from the lamp.
```

### Slide-0 cover for a finance topic
```
A trader's desk just after market close — three monitors dimmed, a coffee cup with a faint lipstick mark, a paper printout with red-inked annotations and one circled number. Window blinds cast late-afternoon striped shadows across the keyboard. Documentary 50mm, shallow depth of field, no person visible, just the aftermath. Negative space along the upper third where the morning light hits the wall. Cool blue tonality with a single warm tungsten desk lamp as accent.
```

### Slide-0 cover for a trends / culture topic
```
A small hand-painted sign in a Seoul side-alley reading "오늘 마감", taped to a glass door at dusk, the neon sign of a 24-hour convenience store reflected in the glass. A cyclist out of focus passing in the background, motion blur on the wheel. 35mm film, soft drizzle on the asphalt, mixed neon and sodium-vapor light. Subject lower-third, upper two-thirds is wet sky and reflection.
```

### Threads card (vertical 2:3, single subject)
```
A pair of weathered hands holding an open paperback, the page-edge yellowed, a thumbprint smudge near the spine. Window light from the left, the rest of the room dropping into shadow. 50mm portrait lens, shallow depth of field, subtle film grain. The book takes the lower half; the upper half is a muted off-white wall. No face, no text on the page (page is intentionally blurred).
```

## Editing existing images

Pass one or more `--input-image https://...` flags. The model uses them as references — for style transfer, character consistency across slides, or targeted edits. Be explicit in the prompt about what should change vs. stay the same.

When iterating an edit, use **preserve language**:
- `Do not change the subject's face, pose, or clothing.`
- `Keep everything else identical to the reference.`
- `Only modify the background — replace the studio backdrop with a sun-lit kitchen.`

One edit per turn. Stacking three changes ("change the background, swap the shirt, add a cat") drifts the result.

## Quality settings

- `low` — bulk ideation, dashboard previews. Cheap.
- `medium` — sufficient for any slide that's a background under typography (the template overlays heavily). Default for most slides.
- `high` — slide 0 of `ai-first-only` mode (the cover that defines the run), Threads card, hero scenes in video reels, anything with a face or hand the viewer will inspect.
- `auto` — let the model decide. Fine for non-critical assets but unpredictable for hero frames; prefer explicit choice for the cover.

## Failure handling

- 422 / safety filter → retry once with a tamer prompt (drop people, drop charged words, keep environment + material).
- Quota / rate limit (429) → wait 30s, retry once.
- After two failures → omit `bgImageR2Key` for that slide and continue (template renders on solid gradient).
- Hard fail (bad token, etc.) → orchestrator marks the run failed and stops.

## How the orchestrator composes the final prompt

The orchestrator (`composeSlidePrompt` in `src/sandbox/orchestrator.ts`) prepends/appends to your `bgImagePrompt` like this:

```
[your bgImagePrompt — Scene, Subject, Details]

Visual treatment: [topic.imageStylePrompt]. [template.bgPromptTemplate].
Color anchor: [template.accentColor] reads as the dominant accent (one or two surfaces only)…
Use case: vertical 2:3 cover frame for an Instagram Reel…
Constraints: no on-screen text, no watermark, no logos, no UI mockups…
```

So your job is sections 1-3 plus a tonality cue. Don't re-paste the style prefix and don't re-paste the constraint list — they get duplicated and the model loses the priority signal.
