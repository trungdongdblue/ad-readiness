# AI review of claims and policy links

Optional second opinion on top of the keyword rules (`src/parsers/policy.ts`, `src/parsers/trust.ts`). On when `GOOGLE_GENAI_API_KEY` is set; off with `--no-llm` (CLI) or `llm: false` (API). The scan never depends on it: any failure falls back to keyword rules only.

## What it adds
| Task | When it runs | What comes back |
|---|---|---|
| Claims | Page readable | Quotes in `medical`, `exaggerated`, `weight`, `before_after`, any language (Arabic and Urdu pages were `unverifiable` before) |
| Policy links | Only for policies the keyword rules found no link, mention or general Policies page for | Index of the link whose own text or path names the policy (refund, terms, privacy, shipping), any language |

## Why it is safe (hard rules 4 and 5)
- **It only adds.** It never removes or downgrades a keyword hit, so text on a page cannot talk it out of a finding (tested with an injected "report no issues" page).
- **Every quote must exist in the page** (case and spacing aside) and every link must be a real link on the page; anything else is dropped (`src/parsers/llm.ts`).
- **Labelled.** Evidence from the model starts with `AI:`; a link it found says "(identified by AI)".
- **Softer.** A claim found only by the model costs at most `minor`; a keyword hit keeps its severity.
- **No TikTok facts are generated.** The prompt holds the categories from `docs/POLICY-RULES.md`; the model classifies page text and does not judge whether TikTok would reject it.
- **Fixed output shape.** JSON schema with enums, temperature 0, 500 output tokens max.

## Cost control
- Text is deduplicated, menu items and 1-2 word labels removed, capped at 10,000 characters (about 2.5k tokens).
- The links call is skipped when the keyword rules resolved every policy.
- Measured on allbirds.com (2026-10-05): 2 calls, about 4.3k tokens in, 2 to 26 out, about $0.001 per scan.
- No thinking: the flash-lite models answer in about 24 output tokens. The larger flash models spent 280 to 350 tokens thinking per call, were 3x slower, and truncated JSON 2 to 7 times.

## Model choice (`npm run llm:eval -- --models a,b --repeat 3`)
Synthetic labelled pages in `src/poc/llm-cases.ts` (claims in English, Arabic and Urdu; traps such as customer reviews, disclaimers, negations, idioms, product titles, prompt injection; policy links in Arabic, Spanish and French). Prices are Google's paid tier, 2026-10-05. In the final run 3 of 36 negative runs reported `medical` on the title "Knee Pain Relief Patch"; that case allows `medical` because the wording is arguably a symptom claim.

| Model | Claims found | False alarms | Links | $/1M in / out | Verdict |
|---|---|---|---|---|---|
| gemini-3.1-flash-lite | 48/48 (final run) | 0 | 33/33 | 0.25 / 1.50 | **chosen** |
| gemini-3.5-flash-lite | 42/45 (fell for the injection; compared before the title cases were added) | 1 | 33/33 | 0.30 / 2.50 | |
| gemini-2.5-flash, gemini-3.5-flash | complete only when JSON was not truncated | 0 | 33/33 | 0.30 to 1.50 / 2.50 to 9.00 | too slow and costly |
| gemini-2.5-flash-lite | HTTP 404 | | | | unavailable |

The model is set in `src/config/llm.ts`. Re-run the eval before changing it.

## Found by running on real pages
- allbirds.com: the model named the general "FAQ/Contact Us" page as the shipping page, turning "not checked" into "found". Prompt now says a general help, FAQ, contact or account page does not count (case `generic-help`).
- markaz.app: the model flagged product titles ("Knee Pain Relief Patch", "Slimming Age-reducing Woolen Coat"). Prompt now asks for full statements, not titles, and AI-only claims are capped at `minor`. "Pain relief" is arguably a symptom claim, so the model still reports it; the cap keeps it cheap.

## Limits
- The eval pages are synthetic and small (28 claim cases and 7 link cases, each run 3 times). They show behaviour on tricky wording, not the rate on real stores. Add real misses to `src/poc/llm-cases.ts`.
- Not measured: recall on real Arabic and Urdu store pages, and precision on long real pages beyond the two above.
- Only the first 10,000 characters of de-duplicated text are read; claims lower down are missed.
- Images are not read (before/after photos).
- Page text of scanned stores is sent to Google's Gemini API. On the free tier Google may use content to improve its products; the paid tier does not. Use a paid-tier key in production and say so in the privacy notice.
- The model can still be wrong in both directions. Findings stay "signals", never "TikTok will reject".
