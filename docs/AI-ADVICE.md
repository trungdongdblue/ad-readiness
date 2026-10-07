# AI fix plan

After a scan, one model call turns the decided findings into a plan: steps per fix, ordered by score gain. It never delays or changes the result: the report is saved first (`advice: pending`), the plan arrives on the same job a few seconds later (`done` or `failed`), and every finding keeps its fixed "How to fix" text.

On when `GOOGLE_GENAI_API_KEY` is set on the worker (the same key as `docs/LLM-REVIEW.md`). No key, or nothing to fix: no `advice` field, no panel, no call.

## What the plan shows
Written for a store owner who is not technical. Only blockers and majors are planned (at most 5); minors appear only when nothing bigger is left (at most 2). The rest keep their fixed text.

| Done by code (pure, tested) | Done by the model |
|---|---|
| Which fixes: decided findings above `info`, never `unverifiable` (`src/engine/advice.ts`) | `headline`: the problem in plain words |
| Order and "+N pts": the real scoring engine re-scores with each finding fixed | `why`: what it costs the owner if left unfixed |
| Projected score after the listed fixes | `steps` (3 to 6): where to click, what you should see; jargon explained in brackets |
| Rejecting unsafe output (`src/parsers/advice.ts`) | `check`, `effort`, and `safe_copy` (a compliant rewrite of a quoted claim, policy findings only) |

A developer-level fix says in its first step that it is best forwarded to a developer or freelancer; "Copy plan" exports the whole plan as Markdown for that.

## Safety (hard rules 4 and 5)
- Input is only the findings (id, severity, title, 2 evidence lines, the fixed hint), never the page. Delimiters are stripped from page text so it cannot close the `<findings>` block; the prompt says it is untrusted.
- Output is dropped when it has a link, promises a TikTok decision ("will approve/reject"), names an unknown fix number, repeats one, or has a bad `effort`. `safe_copy` is dropped outside `policy.*`.
- The prompt allows only event and parameter names found in the finding or its hint. The eval counts invented event names.
- Any failure returns no plan: the panel says so and the fixed texts below still apply.

## Cost and model choice (`npm run advice:eval -- --models a,b --repeat 3`)
Four synthetic reports (Shopify without Pixel, WooCommerce missing params, Arabic claims, a prompt-injection page), 3 runs each, 2026-10-06, with the detailed plain-words format. Prices: Google paid tier, USD per 1M tokens in / out: 3.1-flash-lite 0.25 / 1.50, 3.5-flash-lite 0.30 / 2.50, 2.5-flash 0.30 / 2.50.

| Model | Plans OK | Fixes covered | Avg time | Tokens in / out | USD per 1000 scans | Verdict |
|---|---|---|---|---|---|---|
| gemini-3.1-flash-lite | 12/12 | 24/24 | 2.4 s | 594 / 413 | **0.77** | **chosen** |
| gemini-3.5-flash-lite | 12/12 | 24/24 | 2.3 s | 594 / 371 | 1.10 | same quality, dearer |
| gemini-2.5-flash | 12/12 | 24/24 | 8.0 s | 594 / 1506 | 3.94 | thinking tokens, 3x slower |

No model invented an event name, repeated the injected text, or left out `why` or `check` (one `why` missing on 2.5-flash). The earlier short-format run showed gemini-3.5-flash (not lite) failing 7 of 12 runs because thinking truncated the JSON, so it was not run again.

## Token budget
- At most 5 fixes, one compact line each; one call per scan, none when nothing needs fixing.
- Ranking, gain, the headline score and the summary are computed, not generated.
- Temperature 0, no thinking (flash-lite), 2,800 output cap (about twice what a plan uses, because truncated JSON is a total loss).
- The plan lives on the job (30 minutes), so reloading or sharing the page never calls the model again.

## Limits
- The eval is synthetic and small. Menu paths ("Event Builder") are model knowledge, not facts from our docs, which is why the panel says to check names in the store admin.
- Fixes beyond the 5 most important keep their fixed text.
- English only, except `safe_copy`, which follows the language of the quote.
