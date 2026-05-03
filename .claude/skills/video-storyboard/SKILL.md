---
name: video-storyboard
description: Plan a Seedance 2.0 video reel — turn research notes + topic persona into a brief.video.scenes[] storyboard with cinematic prompts, optional first-frame images, and infographic overlay copy. Use after content-plan when the chosen template's compositionId is SeedanceReel.
allowed-tools: Read, Write
---

# video-storyboard

Plan a 3-5 scene video reel using Seedance 2.0. The output extends the standard brief.json with a `video.scenes[]` array; the existing `caption.*` and `hashtags` are still produced by content-plan.

Inputs:
- `data/runs/$LOC_RUN_ID/topic.json` — including `lang`, `personaPrompt`, `imageStylePrompt`, `imageMode`.
- `data/runs/$LOC_RUN_ID/research.md`
- `data/runs/$LOC_RUN_ID/template.json` — the IG template row. Use `accentColor` and `bgPromptTemplate` as style overlays.
- `data/runs/$LOC_RUN_ID/brief.json` — content-plan's draft. You **augment** it with `video.scenes[]`, you do not replace it.

## Output schema (added to brief.json)

```json
{
  "video": {
    "accent": "#facc15",
    "scenes": [
      {
        "chapter": "OPENING",
        "kicker": "TRENDING",
        "headline": "<≤14 chars KO / ≤22 chars EN — overlaid on the clip>",
        "body": "<≤40 chars supporting line>",
        "stat": { "value": "73", "suffix": "%", "label": "초기 진입자 우위" },

        "videoPrompt": "<5-step directorial prompt: subject, action, camera, lighting, style>",
        "durationSec": 5,
        "aspectRatio": "9:16",
        "resolution": "720p",
        "generateAudio": true,
        "seed": null,
        "cameraMove": "slow dolly in",
        "mood": "golden hour, soft daylight",

        "firstFrameImagePrompt": "<gpt-image-2 prompt for first-frame still, 2:3 portrait, no text>",
        "lastFrameImagePrompt": "<optional, only if you want a controlled cut>"
      }
    ]
  }
}
```

The orchestrator turns each scene into a Seedance 2.0 prediction and writes back `videoR2Key` once the MP4 is uploaded.

## Storyline arc (3-5 scenes)

| Scene | Role | Length |
|---|---|---|
| 1 — HOOK | curiosity / shock / contrast — must justify watching | 3-5s |
| 2 — PAYOFF A | one concrete idea | 4-6s |
| 3 — PAYOFF B | a second angle, often a stat or comparison | 4-6s |
| 4 — ACTION | what to do this week | 3-5s |
| 5 — CLOSE | save / share prompt + brand stamp | 2-4s |

**Total target: 18-25s.** Reels >30s lose retention sharply; <12s rarely have room for payoff. Use `durationSec: -1` only when you have an artistic reason to let the model decide — most of the time, pick an integer.

## Prompt-writing rules

Write each `videoPrompt` as **one paragraph** with this scaffold:
> [Subject doing a specific physical action], [camera move with speed], [named light source], [lens / film stock cue], [one material or imperfection].

The discipline is the same as `image-gen`'s 5-section structure: scene→subject→details, with constraints implicit in what you don't ask for. Name a real lens, a real light source, and at least one tactile material per scene. Don't ask for "cinematic vibes" — describe a moment.

Concrete examples:

- HOOK: "A young office worker freezes mid-sentence, eyes widening as a single Slack notification glows on the laptop screen. Slow dolly-in on the face over 2 seconds, blue-hour overcast light through a side window, 35mm film with shallow depth of field, the keyboard out of focus, a coffee ring on the desk visible at the edge of frame."
- PAYOFF: "A pair of weathered hands slides three magnetic cards across a wooden desk one at a time. Top-down shot panning right, single warm tungsten desk lamp, 50mm prime, the wood grain visible, the corners of the cards slightly worn."
- ACTION: "A woman writes a single line in a paper notebook with a fountain pen, close-up on the pen tip leaving a small ink bloom on the page. Documentary handheld, soft daylight from a side window, 35mm film grain, ink-spot imperfection visible."

Avoid baking on-screen text — the composition handles typography. Keep dialogue rare; only when a single line of voice would land hard, use double quotes (e.g. `The host turns to camera and says: "지금 시작하세요."`).

### Anti-slop list (REMOVE these from any `videoPrompt` or frame prompt)

These words push Seedance and gpt-image-2 into synthetic mode:
- ❌ `stunning`, `incredible`, `epic`, `masterpiece`, `breathtaking`, `award-winning`, `cinematic masterpiece`, `8K`, `4K`, `ultra-realistic`, `hyper-realistic`
- ❌ `glowing orb`, `holographic interface`, `dramatic god rays`, `floating particles`, `magic energy aura`, `cyberpunk neon city`
- ❌ `robot hand reaching toward human hand`, `brain made of circuits`, `perfect minimalist office`, `smiling business team in a sunlit conference room`
- ❌ Style soup like `minimalist brutalist editorial luxury photoreal cinematic` — pick ONE register
- ❌ Emotion abstractions like `evoking trust`, `feeling of innovation` — replace with what's literally in the frame

## When to use a first-frame image

Default: **no first-frame image**. Pure text-to-video is cheaper and faster.

Use `firstFrameImagePrompt` when:
- The hero face/character must look identical across multiple scenes — generate one gpt-image-2 hero, pass it as `--image` to scene 1, then re-use as `--reference-image` to scenes 2-5.
- Brand color must be exact in the opener.
- The first beat is a stylized still that morphs (use `lastFrameImagePrompt` to define the destination of that morph).

Image prompts go through gpt-image-2 (`--aspect 2:3`). Same rules as the main image-gen skill: cinematic, editorial, no text in the image, single clear focal point.

## Stat overlay strategy

Pick exactly **one or two scenes** to carry a `stat`. Stats compete with motion for attention; if every scene has a number, the viewer parses none. Numbers should be:
- ≤4 chars when rendered (e.g. `73%`, `4.8x`, `1.6M`, `#1`).
- A single concrete claim that the body line explains.
- Believable — don't fabricate. Cite a research note in your `body` if needed.

## Aspect ratio

For Reels: always `9:16`. For square IG carousels (future): `1:1`. The model's `adaptive` mode is convenient but unpredictable for a multi-scene reel — pick explicitly.

## Audio

Default `generateAudio: true`. Seedance includes a synced ambient bed and any double-quoted dialogue. The SeedanceReel composition ducks the BGM track underneath. Set `generateAudio: false` only when you intend to fully replace audio with the BGM track.

## Persona + image style

- Always prefix `videoPrompt` with the topic's `personaPrompt` style cue when relevant (e.g. "in the brand's editorial-cinematic visual language, …").
- Always honor `imageStylePrompt` and `template.bgPromptTemplate` for `firstFrameImagePrompt` — these compose the same way as in image-gen.

## Steps

1. Read `topic.json`, `template.json`, `research.md`, and the existing `brief.json`.
2. Plan the 3-5 scene arc (HOOK → PAYOFF → ACTION → CLOSE).
3. Draft each scene: chapter label, overlay copy (kicker/headline/body/stat), Seedance prompt, optional first-frame image prompt.
4. Self-critique: would *you* keep watching after scene 1? Rewrite the hook if not.
5. Merge `video` block into `brief.json` and persist via `bun src/sandbox/db-cli.ts set-brief "$LOC_RUN_ID" data/runs/$LOC_RUN_ID/brief.json`.

## Constraints

- Total duration ≤ 30s. Each scene 3-7s.
- 1-2 stat scenes max.
- Korean overlay headlines ≤ 14 chars; English ≤ 22.
- Never request on-screen text inside `videoPrompt`.
- If `topic.imageMode === "template-only"`, set every `firstFrameImagePrompt` and `lastFrameImagePrompt` to `null` — the orchestrator will skip image generation, and Seedance will run pure text-to-video.
