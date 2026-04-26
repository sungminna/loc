---
name: threads-publish
description: Publish a Threads post (text + optional image) via graph.threads.net v1.0 container/publish flow. Use when the topic has a Threads target account.
allowed-tools: Bash
---

# threads-publish

Pre-conditions:
- `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`, `THREADS_ACCOUNT_ID` env vars set.
- Threads image already in R2 (from render-threads-image).

Run:

```
bun src/sandbox/threads.ts publish \
  --run-id $LOC_RUN_ID \
  --image-r2-key runs/$LOC_RUN_ID/threads.jpg \
  --text "<brief.threads.text>$'\n\n'🎵 Music: <attribution>" \
  --lang ko \
  --audio-track-id <id from select-audio output> \
  --template-slug <slug used to render>
```

For text-only posts, omit `--image-r2-key`. Pass `--audio-track-id` only when the post is paired with audio (rare for Threads photo posts; the field is purely informational on the `posts` row).

## Notes

- The script waits ~30s between container creation and publish for media containers (Threads requires this).
- 250 posts per profile per 24h. The dailyRunCap should keep you well under.
- A `posts` row is inserted before publish and updated with permalink after.
