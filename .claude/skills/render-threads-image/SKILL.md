---
name: render-threads-image
description: Render a single 1080x1350 (4:5) JPG for Threads using the ThreadsCard composition. Use after image-gen has produced the threads bg.
allowed-tools: Bash
---

# render-threads-image

Run:

```
bun src/sandbox/render-threads-image.ts \
  --run-id $LOC_RUN_ID \
  --brief data/runs/$LOC_RUN_ID/brief.json \
  --composition ThreadsCard
```

Stdout: `{ "r2Key": "runs/<runId>/threads.jpg", "url": "...", "assetId": "..." }`.

Pass the `r2Key` to **threads-publish** as `--image-r2-key`.
