---
name: gemini-image
description: Generate a background or asset image with Gemini 2.5 Flash Image (Nano Banana). Use when the brief specifies bgImagePrompt fields. Uploads to R2 and records as an asset.
allowed-tools: Bash
---

# gemini-image

Run:

```
bun src/sandbox/gemini.ts gen \
  --prompt "<the bgImagePrompt verbatim>" \
  --aspect 9:16        # or 4:5 for Threads, 1:1 for square
  --count 1 \
  --out-dir data/runs/$LOC_RUN_ID/img \
  --run-id $LOC_RUN_ID \
  --kind gemini-bg
```

Stdout is one NDJSON line per image: `{ "assetId": "...", "r2Key": "runs/<runId>/gemini-bg/<file>", "url": "https://...", ... }`.

Capture the `r2Key` and put it back into the brief.json at the corresponding location (e.g. `slides[i].bgImageR2Key` or `threads.bgImageR2Key`).

## Tips

- The image must NOT contain text — typography is rendered by the template.
- For 9:16, use prompts that describe vertical-natural compositions (portraits, columns, vertical landscapes, vertical product hero).
- One image per slide is fine; reusing one shared bg across slides is also fine if the prompt is generic.
- If the call fails (quota / safety filter), retry once with a slightly tamer prompt. Then fall back to no background (omit `bgImageR2Key`) and continue.
