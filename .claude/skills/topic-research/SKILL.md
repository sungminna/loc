---
name: topic-research
description: Scrape the topic's configured source URLs and synthesize a brief trend digest. Use when starting an autonomous content cycle to ground content in current information. Writes research notes to D1 via the internal API.
allowed-tools: WebFetch, WebSearch, Bash, Read, Write
---

# topic-research

Inputs: `LOC_TOPIC_ID`, `LOC_RUN_ID` env vars. The topic JSON is at `data/runs/$LOC_RUN_ID/topic.json`.

## Steps

1. Read `data/runs/$LOC_RUN_ID/topic.json`. Extract `sourceUrls` and `name`.

2. For each sourceUrl (max 6):
   - `WebFetch` the URL with a prompt like: "Extract 3-5 short bullets covering the most current/trending angle of <topic.name>. Include any concrete numbers, named entities, dates."
   - Save title + summary via internal API:
     ```
     curl -X POST "$LOC_API_BASE/internal/research-note" \
       -H "authorization: Bearer $LOC_INTERNAL_KEY" \
       -H "content-type: application/json" \
       -d '{"topicId":"'"$LOC_TOPIC_ID"'","runId":"'"$LOC_RUN_ID"'","sourceUrl":"<url>","title":"<title>","summary":"<3-5 bullets>"}'
     ```
   - Note: prefer the `bun src/sandbox/db-cli.ts` wrapper if you add a `record-note` command later. For now, the curl form is acceptable since curl is in the allowlist for skill scripts (use `Bash`).

3. If `sourceUrls` is empty, run `WebSearch` for `<topic.name> trending 2026` and `<topic.name> news this week`. Treat top 3 results as sources.

4. Write a single consolidated digest to `data/runs/$LOC_RUN_ID/research.md`:
   - 3-5 most surprising or actionable points across all sources
   - 1-2 viral hook angles (questions, contrasts, numbers)
   - Notable terms/entities to use in the post

5. Stdout: print the digest path so the orchestrator can read it.

## Constraints

- Do NOT post URLs verbatim into captions; use them only as research grounding.
- Cap your output to ~600 tokens. The downstream `content-plan` skill rewrites this into post copy.
- If a URL fails to fetch, skip it and continue. Do not retry more than once.
