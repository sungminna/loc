---
name: topic-research
description: Scrape the topic's configured source URLs and synthesize a brief trend digest. Use when starting an autonomous content cycle to ground content in current information. Writes research notes to D1 via the internal API.
allowed-tools: WebFetch, WebSearch, Bash, Read, Write
---

# topic-research

Inputs: `LOC_TOPIC_ID`, `LOC_RUN_ID` env vars. The topic JSON is at `data/runs/$LOC_RUN_ID/topic.json`.

The downstream `content-plan` skill is judged on whether slide 1 stops the scroll. Your job here is to *find the scroll-stoppers* — concrete numbers, named entities, contrarian angles — not to summarize the source articles.

## Steps

1. Read `data/runs/$LOC_RUN_ID/topic.json`. Extract `sourceUrls`, `name`, `personaPrompt`.

2. For each sourceUrl (max 6):
   - `WebFetch` with this prompt template:

     > "Pull from this article the strongest material for a 30-second Instagram Reel about <topic.name>:
     > 1. Up to 3 specific numbers, dates, or named entities (e.g. '38%', '2025년 4월', 'Anthropic').
     > 2. One contrarian or counter-intuitive claim — something that challenges what most people assume.
     > 3. One concrete first-person example (a person, company, or moment).
     > 4. The single most quotable sentence from the article.
     > Return as bullet points. Skip filler. If the article is a generic listicle, say so plainly."

   - Save title + summary via the wrapper:
     ```
     bun src/sandbox/db-cli.ts get-topic "$LOC_TOPIC_ID" >/dev/null   # warm
     curl -fsS -X POST "$LOC_API_BASE/internal/research-note" \
       -H "authorization: Bearer $LOC_INTERNAL_KEY" \
       -H "loc-run-id: $LOC_RUN_ID" \
       -H "content-type: application/json" \
       -d "$(jq -n --arg t "$LOC_TOPIC_ID" --arg r "$LOC_RUN_ID" --arg u "<url>" --arg ti "<title>" --arg s "<summary>" \
             '{topicId:$t,runId:$r,sourceUrl:$u,title:$ti,summary:$s}')"
     ```

3. If `sourceUrls` is empty OR fewer than 2 source notes succeed, run `WebSearch` for a mix of:
   - `<topic.name> trending 2026`
   - `<topic.name> news this week`
   - `<topic.name> data study`  (look for academic or industry reports)
   - The top 3 results across these searches become sources. Apply the same WebFetch prompt to each.

4. Write a single consolidated digest to `data/runs/$LOC_RUN_ID/research.md` with this structure:

   ```markdown
   # Research digest — <topic.name>
   _Run <runId> · <today>_

   ## Scroll-stoppers (use these in slide 1 hooks)
   - Specific number or fact #1 (with source)
   - Specific number or fact #2 (with source)
   - Specific number or fact #3 (with source)

   ## Counter-intuitive angles
   - Claim that contradicts the obvious assumption (with the source's reasoning).
   - …

   ## Concrete moments / examples
   - Person or company name, what they did, what happened.
   - …

   ## Notable terms to weave in
   - Terms / brand names / acronyms that signal the writer is in-the-loop.

   ## Avoid
   - Generic phrasing this topic is drowning in (e.g. "AI is changing everything").
   - Recycled bad takes that have already saturated Threads.
   ```

5. Stdout: print the digest path.

## Constraints

- Do NOT post URLs verbatim into captions; they are research grounding only.
- Cap your output to ~700 tokens of digest. The downstream `content-plan` skill rewrites this into post copy.
- If a URL fails to fetch, skip it and continue. Do not retry more than once.
- If every source dies (404s, paywalls, JS-only), fall back to `WebSearch` and clearly note the digest was search-derived so content-plan calibrates confidence on numbers.
- Never invent a statistic. If you can't cite which source said it, leave it out.
