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

## Match the prompt to the chosen template

Each of the curated 5 templates has its own photographic register encoded in the `template.bgPromptTemplate` (concatenated automatically by the orchestrator). Your `bgImagePrompt` should *agree* with that register, not fight it. If the template is **Cover** (Vogue/W) and you write a prompt that asks for a Bloomberg-style trader desk, gpt-image-2 receives mixed signals and produces a generic AI-stock image. Read `template.json.bgPromptTemplate` first, then write a content prompt that honors it.

| compositionId | Reference publication | Photographic register |
|---|---|---|
| `Editorial` | NYT Magazine, The New Yorker, Cereal | 35mm documentary, single window light, real surface texture, paper-cream non-image areas, one quiet brick accent. Subject in right two-thirds, left column empty for type. |
| `Monocle` | Monocle, Bloomberg Businessweek, FT Weekend | Low-key environmental still life, single overcast/fluorescent, low contrast, navy + cream + one coral note. Subject central, upper third plain. |
| `Riso` | RISOTTO Studio, Print magazine | Single subject flat on hot-red seamless paper, hard side light, faint cyan-magenta misregistration. 032c red carrying the page. |
| `Cover` | Vogue, W, Numéro | Full-bleed editorial portrait or still life, charcoal/neutral surroundings, single softbox/window light, one warm-metal accent. Subject in central upper half. |
| `Index032c` | Wallpaper*, 032c, Index magazine | Industrial-design product shot or environmental architecture, single subject on infinite cyc or matte-black wall, hard side light, deep blacks dominating, one chartreuse note. |

## Worked examples (copy and adapt these — one per template)

### Editorial — NYT Magazine register, slide 0 for an opinion topic
```
A worn wooden floor at the corner of a Yeouido apartment, a paperback cracked open spine-up beside a half-empty cream-colored mug, the steam catching the morning light. Subject sits in the right two-thirds of the frame; the upper-left is a plain warm-cream wall with no objects on it. 35mm film grain, shallow depth of field, single north-facing window light, dust motes visible. Real paper-edge texture, condensation on the mug, slight skin tone in a hand barely entering the frame from the right. Muted earth tones, one quiet brick accent from a folded scarf at the edge of the floor.
```

### Monocle — Briefing register, slide 0 for a finance topic
```
A Yeouido high-rise lobby photographed at low elevation early morning, the security desk's stainless rim catching one warm tungsten lamp, the rest of the lobby in cool overcast tone from the floor-to-ceiling glass. A single printed Bloomberg Terminal page lies on the marble, three numbers circled in red pen. Documentary 50mm, no person in frame, the upper third of the photograph is plain dark glass with a faint city haze behind. Cool navy and paper-cream palette, one coral-red note from the pen circles only.
```

### Riso — Hot Poster register, slide 0 for a trend / hot-take topic
```
A single ripe persimmon balanced on top of a 1990s rotary telephone, photographed dead-center on a flat hot-red seamless paper backdrop. Hard key light from camera-left producing a sharp short shadow on the right. Color separation pushed slightly so faint cyan dot misregistration is visible on the persimmon's midtones (offset-print artifact). Waxy fruit skin, scuffed bakelite phone, dust on the cord. Upper 25% of the frame is plain hot-red seamless with no objects, ready for a headline. Pantone-032c red and paper-cream margin only.
```

### Cover — Vogue/Numéro register, slide 0 for a quote / lifestyle topic
```
A wool coat draped over a vintage chair photographed at the shoulder line, charcoal wallpaper behind, one single softbox window light from camera-right falling across the lapel and dying into shadow on the left. The coat's wool weave is visible up close, a brass button catches a single warm-metal highlight. No face, no logo. Composition is full-bleed; the subject occupies the central upper two-thirds of the frame, leaving the lower third in plain shadow for typography. Cool charcoal palette, one burnished-gold note on the button only.
```

### Index — Wallpaper*/032c register, slide 0 for an AI / tech topic
```
A single Korean mechanical keyboard with hangul-engraved keycaps photographed dead-center on an infinite matte-black cyc, one hard key light from camera-right producing a clean short shadow on the cyc. The keyboard's stainless top plate catches the light; the keycaps are slightly worn at the most-pressed letters. Negative space dominates: roughly 60% of the frame is empty matte black around the subject. One acid chartreuse note appears on a single packaging sticker on the side of the keyboard, no other color. No glamour, no glow, no studio polish.
```

### Threads card (vertical 2:3, single subject)
```
A pair of weathered hands wrapping a paper bag at a Mangwon-dong bakery counter at 8am, the brown paper edge curled and slightly scuffed, a single coffee ring on the wooden counter. Window light from the left falls across the hands, the rest of the room drops into shadow. 50mm portrait lens, shallow depth of field, subtle film grain, dust on the wood. The hands and bag take the lower half; the upper half is a plain warm-cream wall ready for headline overlay. No face, no text in the image.
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
