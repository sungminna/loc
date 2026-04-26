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
  --kind gemini-bg              # asset.kind (legacy name; covers any AI-gen bg)
```

Stdout: NDJSON, one line per image.
`{ "assetId": "...", "r2Key": "runs/<runId>/gemini-bg/<file>.webp", "url": "https://pub-...r2.dev/...", ... }`

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

## Editing existing images

Pass one or more `--input-image https://...` flags. The model uses them as references — for style transfer, character consistency across slides, or targeted edits. Be explicit in the prompt about what should change vs. stay the same.

## Tips for Reel-friendly images

- Mention lens / lighting / framing for photorealism: "Shot with 50mm lens, soft daylight, shallow depth of field".
- Avoid baking text into the image — the Remotion template renders typography on top.
- For viral hooks: high-contrast subjects, bold composition, single clear focal point.
- Quality `medium` is usually enough for a 1080×1920 background; bump to `high` only for hero frames.

## Failure handling

- 422 / safety filter → retry once with a tamer prompt.
- Quota / rate limit (429) → wait 30s, retry once.
- After two failures → omit `bgImageR2Key` for that slide and continue (template renders on solid gradient).
- Hard fail (bad token, etc.) → orchestrator marks the run failed and stops.
