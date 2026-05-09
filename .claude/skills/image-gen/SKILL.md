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

Each of the curated 5 templates (May 2026 redesign) has its own photographic register encoded in the `template.bgPromptTemplate` (concatenated automatically by the orchestrator). Your `bgImagePrompt` should *agree* with that register, not fight it. If the template is **Aurora** (atmospheric gradient) and you write a prompt that asks for a flat hot-red Riso poster, gpt-image-2 receives mixed signals and produces a generic AI-stock image. Read `template.json.bgPromptTemplate` first, then write a content prompt that honors it.

Crucially: the bg image is **fixed scenery** in this system — the template positions it (full-bleed, rounded tile, torn-edge clip, small inset, or specimen frame) and it does not move per slide. So your prompt describes *what is in the photo*, not where it sits on the slide.

| compositionId | Concept | Photographic register |
|---|---|---|
| `Aurora` | Atmospheric gradient (Cool Blue / Drama Club) | Single subject silhouetted against deep navy → opal-lilac volumetric haze, single soft directional light, cool palette dominates, one cosmic-pink note. Image renders full-bleed beneath a vertical scrim, so frame for ambient legibility. |
| `Gummy` | Hyperreal-3D candy (Gimme Gummy) | Single glossy/jelly object photographed flat on butter-cream seamless, hard side light producing a short crisp shadow, real-object-on-paper register (NOT CGI glass), one bubblegum-pink or electric-lime accent. Image renders inside a tilted rounded card, so center the subject with breathing space. |
| `Zine` | Counterculture photocopy (Pick-and-Mix / Warning Low Ink) | Torn ticket / faded receipt / stencilled wall on newsprint paper, high contrast, visible cyan/magenta misregistration on midtones, paper grain, risograph-red or acid-yellow note. Image renders inside a torn-edge polygon clip with halftone overlay, so subject can fill the frame. |
| `Kinetic` | Industrial black-field (Typographic Maximalism) | Single hard-lit subject (key-cap, stainless hinge, server-rack ear, PCB trace) on matte-black, deep blacks dominate, one acid chartreuse note. Image renders as a small 280×280 inset stamp behind huge type, so frame the subject TIGHT with empty matte-black around it. |
| `Dossier` | Specimen-sheet (Micrographics / Heritage / Blueprint) | Single object on warm cream paper #f1ead6, top-down or near-top-down, single overcast/window light, low contrast, paper grain visible, blueprint-cyan accent + crimson FILED stamp. Image renders inside a specimen frame with corner brackets, so center the object on a clean cream field. |

## Worked examples (copy and adapt these — one per template)

### Aurora — atmospheric gradient, slide 0 for an essay / opinion topic
```
A single hand emerging slowly from cool gradient fog, fingers half-lit, the rest of the figure dissolving into deep navy haze that bleeds upward into opal lilac. 50mm portrait lens, single soft window light from camera-left, the rest of the frame is volumetric atmosphere — no walls, no floor, just gradient depth. Cool palette only: deep navy → indigo → lilac. One cosmic-pink note from a thin enamel ring on the index finger, nothing else colored. The subject sits in the central vertical band; the upper third is pure gradient sky, the lower third bleeds into deep navy. No CGI, no glow, no holographic interfaces — only ambient atmosphere and depth.
```

### Gummy — hyperreal-3D candy, slide 0 for a trend / MZ topic
```
A single glossy strawberry-shaped jelly candy photographed flat on a butter-cream seamless paper backdrop, one hard key light from camera-left producing a sharp short shadow on the right. The candy's surface catches a tight specular highlight — translucent gel, faint sugar dust, slight stickiness on the tile beside it. 50mm macro, real-object-on-paper register (NOT CGI glass, NOT 3D render). One bubblegum-pink note from a tiny plastic tag attached by a string, no other accent color. The subject sits centered with breathing space around it; upper 25% of the frame is plain butter-cream backdrop ready for a headline tile.
```

### Zine — counterculture photocopy, slide 0 for a quote / counterculture topic
```
A torn paper ticket stub stuck to a stencilled wall with a single piece of masking tape, photographed flat at slight oblique angle. The wall paint is chipped, the ticket's edge is uneven from being torn by hand, half-faded ink lettering on it. High contrast lighting with visible cyan-magenta misregistration on the midtones (offset-print artifact, NOT digital glow). Paper grain, photocopy debris around the edges. Risograph red on the masking tape's faint pattern, acid-yellow stencil mark on the wall behind. Subject fills most of the frame; upper 25% is plain wall texture for a ransom-note kicker stamp overlay. No on-screen text inside the photograph itself.
```

### Kinetic — industrial black-field, slide 0 for an AI / tech topic
```
A single Korean mechanical keyboard keycap with a hangul-engraved 'ㄱ' character photographed at a tight oblique angle on a matte-black surface, one hard key light from camera-right producing a clean short shadow. The keycap's plastic edge catches a single highlight; the rest of the frame is deep matte black with subtle dust grain visible only at the keycap's base. The keycap occupies roughly 25% of the frame, sitting in the upper-right quadrant — the rest of the image is empty matte black so the typography overlay (which fills most of the slide) can sit cleanly. One acid chartreuse note from a tiny status LED beside the keycap, no other color. No glamour, no glow, no studio polish.
```

### Dossier — specimen-sheet, slide 0 for a finance / data topic
```
A folded printed ledger sheet on warm cream paper, photographed top-down, with a fountain pen and a single brass paperweight resting on the corner. A faint pale-cyan blueprint grid is just visible beneath the cream paper. Single overcast natural light from a north-facing window, low contrast, paper grain and ink texture visible. The cream paper takes up the entire field; the ledger and pen sit slightly off-center to leave the upper third of the frame for the italic-serif headline overlay. One small crimson 도장 stamp at the corner of the ledger, one blueprint-cyan note from a thin pen-line on the printed sheet. No glamour, no studio set, no people.
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
