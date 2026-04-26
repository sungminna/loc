---
name: render-reel
description: Render the brief into a 1080x1920 H.264 MP4 using Remotion, mux BGM, upload to R2. Use after content-plan and image-gen (and video-gen, for reel-video templates) are done and audio is selected.
allowed-tools: Bash
---

# render-reel

Run:

```
bun src/sandbox/render-reel.ts \
  --run-id $LOC_RUN_ID \
  --composition CardNews \
  --brief data/runs/$LOC_RUN_ID/brief.json \
  --audio-url "<from select-audio output, optional>" \
  --audio-attribution "<attributionText, optional>" \
  --out-dir data/runs/$LOC_RUN_ID \
  --duration-sec 18
```

Stdout JSON:

```json
{
  "reel":  { "r2Key": "runs/<runId>/reel.mp4", "url": "...", "assetId": "..." },
  "cover": { "r2Key": "runs/<runId>/cover.jpg", "url": "...", "assetId": "..." }
}
```

Pass these `r2Key`s to **ig-publish-reel** as `--video-r2-key` and `--cover-r2-key`.

## Choosing the composition

Default `CardNews`. For animated typography templates use the corresponding `compositionId` from the template row. The orchestrate-run skill will tell you which slug to use.

## Rendering takes 30-90s

- 1080x1920 @ 30fps with 5-6 slides ≈ 18s output, ~60s wall clock.
- The script emits progress to stderr; don't worry about it.
- If rendering fails with a Chromium error, the sandbox image is missing libs. Bail out via `set-status ... failed`.
