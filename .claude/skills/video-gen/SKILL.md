---
name: video-gen
description: Generate video clips via Replicate's bytedance/seedance-2.0 model. Use when the brief contains video.scenes[] (i.e. the chosen template's compositionId is SeedanceReel). Supports text-to-video, image-to-video (first/last frame), reference images, reference videos, reference audios, and native audio generation. Uploads to R2 and records as a seedance-mp4 asset.
allowed-tools: Bash
---

# video-gen (Replicate · bytedance/seedance-2.0)

Generate one MP4 per scene. The orchestrator loops `brief.video.scenes[]` and calls this skill once per scene, then writes the resulting `r2Key` into `scenes[i].videoR2Key`.

```
bun src/sandbox/video-gen.ts gen \
  --prompt "<videoPrompt>" \
  --aspect-ratio 9:16 \                # 16:9|4:3|1:1|3:4|9:16|21:9|adaptive
  --resolution 720p \                  # 480p|720p
  --duration 5 \                       # int seconds, or -1 for adaptive
  --generate-audio true \              # boolean
  --seed 42 \                          # optional, for reproducibility
  --image https://... \                # first-frame image (gpt-image-2 output)
  --last-frame-image https://... \     # last-frame image (paired with --image)
  --reference-image https://... \      # repeatable, up to 9 (mutually exclusive with --image)
  --reference-video https://... \      # repeatable, up to 3, total ≤15s
  --reference-audio https://... \      # repeatable, up to 3, total ≤15s
  --out-dir data/runs/$LOC_RUN_ID/video \
  --run-id $LOC_RUN_ID \
  --kind seedance-mp4 \
  --scene-index <i>                    # informs filename → seedance-mp4-scene-NN.mp4
```

Stdout NDJSON:
```
{ "assetId": "...", "r2Key": "runs/<runId>/seedance-mp4/scene-NN.mp4", "url": "https://pub-...r2.dev/...", "predictionId": "...", ... }
```

## Aspect-ratio mapping

| Need | Use |
|---|---|
| Reels 9:16 | `--aspect-ratio 9:16 --resolution 720p` (1080×1920 trimmed-down to 720×1280; SeedanceReel composition upscales) |
| Square (IG carousel video) | `--aspect-ratio 1:1` |
| 16:9 (landscape promo) | `--aspect-ratio 16:9` |
| Let the model pick | `--aspect-ratio adaptive` |

## Mutual exclusion rules (very important)

- `--image` / `--last-frame-image` (first/last frame mode) **cannot** be combined with `--reference-image` (multimodal mode). Pick one strategy per scene. The CLI rejects the combination at validation time.
- `--reference-audio` requires at least one reference image, reference video, or `--image`.
- `--last-frame-image` requires `--image` (first frame).

## Choosing a strategy per scene

| Scene goal | Strategy |
|---|---|
| Text-to-video (cheap, fast) | only `--prompt`. Best for B-roll-style cinematic shots. |
| Brand-consistent character / scene | gpt-image-2 hero image → `--image` for first frame. The model preserves identity across the clip. |
| Smooth cut between two specific frames | first frame + `--last-frame-image`. Use sparingly — duration must be ≥5s for the model to interpolate naturally. |
| Multi-shot story with same character | generate ≤9 reference images via gpt-image-2 (front, 3/4, profile, full-body) → pass via `--reference-image` repeatedly, label them `[Image1]…[ImageN]` in the prompt. |
| Music-synced edit | provide a reference audio (≤15s). Then use double-quoted dialogue in the prompt for lip-sync. |

## Prompt style

Seedance 2.0 follows directorial instructions. A solid scene prompt has:
1. **Subject** — who/what is in frame, in 5-10 words.
2. **Action** — concrete verb, 1-2 beats.
3. **Camera** — `slow dolly in`, `low-angle pan`, `static medium close-up`, `handheld tracking`.
4. **Lighting/mood** — `golden hour`, `blue-hour neon`, `overcast soft light`, `tungsten interior`.
5. **Style** — `cinematic 35mm`, `documentary handheld`, `retro VHS`, `editorial fashion still`.

Optional but high-leverage:
- Dialogue in **double quotes** triggers lip-sync: `The host smiles and says: "이건 진짜 큰일이야."`
- Reference labels in prompt: `The character from [Image1] walks toward the camera with the lighting from [Image2].`
- For motion transfer: `Apply the camera movement from [Video1] to the scene above.`

Avoid:
- Asking for on-screen text — let the SeedanceReel composition render typography on top.
- Overloading the prompt: ≤80 words is the sweet spot. Longer prompts often produce slow, listless motion.
- Conflicting cues (e.g. `static shot` + `handheld whip pan`).

## Failure handling

- 422 / safety filter → retry once with a tamer prompt, dropping any double-quoted dialogue.
- 429 / quota → wait 30s, retry once.
- After two failures → omit `videoR2Key` for that scene; the SeedanceReel composition draws a tasteful gradient fallback.
- Hard failure → orchestrator marks the run failed.

## Cost / time estimates

Seedance 2.0 costs depend on `duration × resolution × generate_audio`. Rough rule of thumb:
- 5s @ 720p with audio ≈ 60-120s wall clock.
- 5 scenes × 5s ≈ 5-10 minutes total (run scenes sequentially; parallelism is rate-limited).

Plan video reels with **3-5 scenes** of **3-7s each**. Total reel ≈ 15-30s — long enough to retain, short enough to keep cost predictable.
