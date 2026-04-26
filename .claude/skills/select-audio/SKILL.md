---
name: select-audio
description: Pick a BGM track from the audio library based on topic mood preferences and template default mood. Returns track metadata including R2 key and attribution text. Use before render-reel.
allowed-tools: Bash
---

# select-audio

Run:

```
bun src/sandbox/select-audio.ts \
  --topic-id $LOC_TOPIC_ID \
  --template-slug <slug> \
  --duration <durationSec>
```

Stdout is one JSON line:

```json
{
  "id": "...",
  "name": "...",
  "artist": "...",
  "source": "ncs" | "upload" | "suno",
  "r2Key": "audio/ncs/<slug>.mp3",
  "durationSec": 120,
  "attributionText": "Music: <Title> by <Artist> (NCS)"
}
```

Use:
- `audioUrl = "$R2_PUBLIC_BASE/" + r2Key`
- pass `audioUrl` to **render-reel** as `--audio-url`
- pass `attributionText` as `--audio-attribution` (and append it to the IG/Threads captions, prefixed with `🎵 Music: `)

If the script errors out with "no audio tracks available", continue without audio (omit `--audio-url` from render-reel). The reel will be silent.
