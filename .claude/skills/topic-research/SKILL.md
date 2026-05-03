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

     > "Pull from this article the strongest material for a 30-second Instagram Reel about <topic.name>.
     >
     > **Hard filter — reject anything any casual reader of the news would already know.** If a bullet could appear verbatim in a generic newsletter ('AI is changing work', '금리가 오르면 주가가 내린다', '사람들이 SNS를 많이 본다'), drop it. Default to *insider-only* angles: numbers a domain expert would not know off the top of their head, mechanisms only practitioners discuss, or details buried below the article's lede.
     >
     > Return:
     > 1. Up to 3 specific numbers, dates, or named entities that a senior in this field would still pause on (e.g. '신용잔고 38조 돌파', '2026년 4월 23일 발표', 'Anthropic Memory Tool 베타'). Skip vanity stats everyone has seen.
     > 2. One contrarian or counter-intuitive claim — something that contradicts the obvious assumption *and* is supported by a mechanism the article spells out. Cite the mechanism in one sub-bullet.
     > 3. One concrete first-person example (named person, named company, dated moment) that is not the headline anecdote — pull from a side paragraph.
     > 4. The single most quotable sentence from the article — a sentence that reads as a take, not as a summary.
     > 5. **Anti-bullets**: list 1-2 things from the article that are *too well-known* to use, so the next stage knows what to avoid restating.
     >
     > Return as bullet points. Skip filler. If the article is a generic listicle or surface-level recap with no insider angle, say so plainly and return nothing."

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

   ## Scroll-stoppers (insider-grade only — generic news headlines do NOT belong here)
   - Specific number / named-entity / mechanism #1 — would a domain expert raise an eyebrow? (with source)
   - Specific number / named-entity / mechanism #2 — same bar (with source)
   - Specific number / named-entity / mechanism #3 — same bar (with source)

   ## Counter-intuitive angles
   - Claim that contradicts the obvious assumption + the mechanism that explains it (with source).
   - …

   ## Concrete moments / examples
   - Named person / company / date — what they did, what happened (not the headline anecdote — a sidebar one).
   - …

   ## Notable terms to weave in
   - Terms / brand names / acronyms / version numbers that signal the writer is in-the-loop.

   ## Avoid (do NOT restate in slides)
   - Generic phrasing this topic is drowning in (e.g. "AI is changing everything", "투자엔 리스크가 따른다").
   - Things every casual reader already knows — list 3-5 specific examples pulled from the sources.
   - Recycled bad takes that have already saturated Threads.
   ```

   **Failure mode to avoid:** a digest where every Scroll-stopper bullet is a thing your friend who doesn't follow this space could still reasonably know. If you find that pattern, redo step 2 with an explicit "go deeper than the headline" instruction before writing the digest.

5. Stdout: print the digest path.

## Constraints

- Do NOT post URLs verbatim into captions; they are research grounding only.
- Cap your output to ~700 tokens of digest. The downstream `content-plan` skill rewrites this into post copy.
- If a URL fails to fetch, skip it and continue. Do not retry more than once.
- If every source dies (404s, paywalls, JS-only), fall back to `WebSearch` and clearly note the digest was search-derived so content-plan calibrates confidence on numbers.
- Never invent a statistic. If you can't cite which source said it, leave it out.
