---
name: ig-publish-reel
description: Publish a rendered MP4 to Instagram as a Reel via Graph API container/publish flow. Use when render-reel has finished and the topic has a target instagram account configured. Records a posts row.
allowed-tools: Bash
---

# ig-publish-reel

Pre-conditions:
- `IG_ACCESS_TOKEN`, `IG_USER_ID`, `IG_ACCOUNT_ID` env vars are set (the Worker injects them when the topic has a configured Instagram target).
- The reel mp4 and cover jpg are already in R2.

Run:

```
bun src/sandbox/ig.ts publish-reel \
  --run-id $LOC_RUN_ID \
  --video-r2-key runs/$LOC_RUN_ID/reel.mp4 \
  --cover-r2-key runs/$LOC_RUN_ID/cover.jpg \
  --caption "<from brief.captions[lang]>$'\n\n'🎵 Music: <attribution>" \
  --lang ko \
  --template-slug <slug used to render>
```

Stdout: `{ "postId": "...", "remoteId": "...", "permalink": "https://www.instagram.com/reel/..." }`.

## Notes

- The script handles container creation, status polling (≤5 min), and publishing.
- A `posts` row is inserted before publishing and updated with status/permalink after.
- If the call fails, the script marks the post `failed` and exits non-zero. The orchestrator should catch that and call `set-status ... failed`.
- Captions: keep ≤ 2,200 characters. Hashtags max 30. The brief should already respect this.
- DO NOT include any URL in the caption that points to your media (IG dislikes self-referential links).

## Rate limit

100 published posts per IG user per rolling 24h. The dailyRunCap on a topic should keep you well under this. If a 4 errors with `code=10` rate-limit, retry once after 60s.
