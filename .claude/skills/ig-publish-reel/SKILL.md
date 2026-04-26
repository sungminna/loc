---
name: ig-publish-reel
description: Publish a rendered MP4 to Instagram as a Reel via Graph API v25.0 (Instagram Login flow). Use when render-reel has finished and the topic has a target instagram account configured. Records a posts row.
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
  --caption-body "<brief.caption.instagram (BODY only — no #tags, no music line)>" \
  --hashtags "tag1,tag2,..." \
  --attribution "<select-audio attributionText, optional>" \
  --lang ko \
  --template-slug <slug used to render> \
  --audio-track-id <id from select-audio output>
```

The script composes the final caption itself: `body + 🎵 Music line + #hashtags`. **Do not pre-compose** any of these into `--caption-body` — it'll get duplicated.

`--audio-track-id` flows into the `posts.audio_track_id` column so analytics and the Audio detail page can show usage.

Stdout: `{ "postId": "...", "remoteId": "...", "permalink": "https://www.instagram.com/reel/..." }`.

## Notes

- Graph API host: `graph.instagram.com/v25.0` (Instagram Login flow).
- Container creation → status poll (≤5 min, exp backoff) → media_publish.
- A `posts` row is inserted before publishing and updated with status/permalink after.
- If the call fails, the script marks the post `failed`, records the API's `error_message`, and exits non-zero. The orchestrator should catch that and call `set-status ... failed`.
- Caption hard limits (enforced by the script): ≤2,200 chars total, ≤30 hashtags, drops tags-line first if oversized.
- DO NOT include any URL in the caption that points to your media (IG dislikes self-referential links).

## Rate limit

100 published posts per IG user per rolling 24h. The dailyRunCap on a topic should keep you well under this. On rate-limit (HTTP 4xx with `code=4` or `code=10`), retry once after 60s.
