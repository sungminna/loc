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
  --lang ko
```

For text-only posts, omit `--image-r2-key`.

## Notes

- The script waits ~30s between container creation and publish for media containers (Threads requires this).
- 250 posts per profile per 24h. The dailyRunCap should keep you well under.
- A `posts` row is inserted before publish and updated with permalink after.
