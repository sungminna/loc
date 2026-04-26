---
name: threads-publish
description: Publish a Threads post (text or text+image) via graph.threads.net v1.0 container/publish flow. Use when the topic has a Threads target account.
allowed-tools: Bash
---

# threads-publish

Pre-conditions:
- `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`, `THREADS_ACCOUNT_ID` env vars set.
- For `image` format, the Threads image is already in R2 (from render-threads-image). For `text` format, no media required.

Run:

```
bun src/sandbox/threads.ts publish \
  --run-id $LOC_RUN_ID \
  --text-body "<brief.threads.text or brief.caption.threads — BODY only>" \
  --hashtags "tag1,tag2"   # optional, max ~5 leaves room under 500-char limit \
  --topic-tag "<brief.threadsTopicTag, single indexed tag, optional>" \
  --attribution "<select-audio attributionText, optional>" \
  --lang ko \
  --template-slug <slug, optional> \
  [--image-r2-key runs/$LOC_RUN_ID/threads.jpg]   # only when threadsFormat=image
  [--reply-control everyone | accounts_you_follow | mentioned_only]
  [--alt-text "..."]                              # accessibility, image posts only
  [--link-attachment "https://..."]               # text-only posts only
```

The script composes the final post text: `body + 🎵 attribution line + #hashtags`. Drops the tag line first if it would push past the 500-char limit, then truncates body. **Do not pre-compose** attribution or `#`-prefixed tags into `--text-body`.

For text-only posts, omit `--image-r2-key`. The script flips `media_type` to `TEXT`.

## Notes

- API: `graph.threads.net/v1.0` (still v1.0 as of April 2026).
- Media containers (`media_type=IMAGE|VIDEO`) are not immediately publishable; the script polls `status` until `FINISHED` (up to 5 min, exp backoff). TEXT containers are published immediately.
- Hard limits enforced by the script: text ≤500 chars; `topic_tag` 1–50 chars (Meta strips `.` and `&`).
- Pass `--audio-track-id` only when the post is paired with audio (rare for Threads photo posts; the field is purely informational on the `posts` row).

## Rate limit

250 posts per profile per rolling 24h. Replies count. The dailyRunCap should keep you well under.

## Carousel / video / replies

Not exposed by this skill yet. If you need them later, they map to Meta's `media_type=CAROUSEL` (parent + children with `is_carousel_item=true`), `media_type=VIDEO`, and the `reply_to_id`/`quote_post_id` params respectively.
