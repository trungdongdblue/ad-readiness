# Ad policy risk (landing page claims) - sources and detectability

Checked 2026-10-05. Pages were read through a summarising fetch, not verbatim: re-open the links before quoting. Scope: ads.tiktok.com policy pages only (TikTok Shop / Seller Center rules are a different rulebook, not used here).

## What TikTok officially says
| Topic | Statement | Source (last updated shown on page) |
|---|---|---|
| Scope | Prohibited-content list for creatives AND landing pages includes Deceptive Practices, Misleading and False Content, Weight Management, Dangerous Products. The page does not say how landing pages are enforced. | [Prohibited Content](https://ads.tiktok.com/help/article/tiktok-advertising-policies-ad-creatives-landing-page-prohibited-content?redirected=2) (Feb 2025) |
| Exaggerated results | "Ad content and landing pages must not promise or exaggerate results concerning a product's effect." Examples: "Get slim legs right away", "Get money in 10 seconds", cures for incurable diseases, "Number 1 song on TikTok" | [Misleading and false content](https://ads.tiktok.com/help/article/tiktok-ads-policy-misleading-and-false-content) (Apr 2026) |
| Before/after | Product-effect comparisons "may cause viewers to have a false or distorted impression"; example: wrinkles disappearing after a cream | same |
| Ad vs page mismatch | Mismatched "promotion, price, discounts" or missing disclaimers/terms; ad shows a product not matching the landing page | same |
| Low price | Prohibited: offering products/deals "at unreasonably low prices compared to the market average to scam individuals out of money or personal data". Sits under *Financial misrepresentation*; the test is scam intent, not low price alone | [Deceptive practices](https://ads.tiktok.com/help/article/tiktok-ads-policy-deceptive-practices) (Aug 2025) |
| Unrealistic claims | Prohibited: "setting unrealistic expectations regarding a product or service's effectiveness or characteristics"; omitting fees/charges | same |
| Medical claims | "Do not make medical claims" unless you hold "an approved medical license or certification". Examples: remove/cure acne, remove wrinkles, treat hair loss; "permanent changes to the human body"; "miracle" / "holds the secret or cure" | [Healthcare and Pharmaceuticals](https://ads.tiktok.com/help/article/tiktok-ads-policy-healthcare-pharmaceuticals) (Sep 2026) |
| Treat/cure | Prohibited: claims to "treat, cure, heal, or prevent any medical condition, disease, or symptoms"; discouraging medical advice; self-diagnosis | same |
| Supplements / OTC | Allowed in many markets with conditions (18+, local approval); prescription medicine "not allowed" in most markets. Rules differ per market | same |
| Weight | Prohibited: unrealistic weight loss / muscle gain; product alone without diet or exercise; "easy or guaranteed"; appearance-shaming. Applies to ad AND landing page | [Weight Management](https://ads.tiktok.com/help/article/tiktok-ads-policy-weight-management) (Sep 2026) |
| Weight, markets | From May 2026 supplements/meal replacement/surgery may be allowed in APAC (supplements too) and MEA incl. Pakistan, Iraq, UAE (no supplements), with sales-rep approval, age targeting, local licence | [Update May 2026](https://ads.tiktok.com/help/article/update-to-weight-management-and-body-image-policy-may-2026) (Jun 2026) | **Superseded 2026-10-07 by docs/MARKET-RULES.md** (Weight Management page, Sep 2026): the UAE is now listed for supplements; Saudi Arabia is in no allowed list.
| Hidden products | "Landing Pages cannot display prohibited products, even if you are not promoting them via ads." Also no demanding sensitive info (ID, card, health, biometric) to enter | [Best practices](https://ads.tiktok.com/help/article/ad-review-checklist-landing-page) (Sep 2025) |
| Page quality | No expired/under-construction pages, incomplete content, high ads-to-content ratio, non-mobile-friendly, auto-download | [Ad Format and Functionality](https://ads.tiktok.com/help/article/tiktok-ads-policy-ad-format-and-functionality) (Apr 2026) |

**Not in any TikTok doc found (do not assert as a rule):** fake reviews/testimonials, fake countdown or scarcity timers, a numeric "too cheap" threshold (e.g. % off), a list of banned words, "unverified" as a defined term (closest: unrealistic/exaggerated claims). The deceptive-practices page was checked for these and does not mention them.

## Mapping the three risks to the scanner
| Risk (user wording) | TikTok basis | Detectable from page text/DOM? | Verdict type |
|---|---|---|---|
| Market-dumping price | Deceptive: unreasonably low price vs market average, to scam | Weak. Needs a market benchmark we do not have and intent we cannot see. Only proxies: compare-at vs price ratio, "90% off" copy, price vs category median across scanned stores | `review` signal only, never `missing`/violation |
| Medical claims | Healthcare: no medical claims without licence; treat/cure/permanent | Good. Claim phrases in visible text (cure, treat, heal, regrow, remove acne/wrinkles, "clinically proven", disease names) per language | `risk` with the matched phrase quoted; licence and market allowance unknowable |
| Unverified / exaggerated claims | Misleading: exaggerate results; Weight: guaranteed/easy | Medium. Absolutes and guarantees ("guaranteed", "100%", "#1", "miracle", "in 7 days", "lose X kg") are matchable; whether they are *true* is not | `risk` on phrase, never "false" |
| Before/after | Misleading + Weight | Only via alt/title/filename or section text ("before", "after"); image content is out of scope | `unverifiable` unless text hints |
| Prohibited product shown | Best practices | Possible via product titles/categories (supplement, slimming, prescription terms) | `risk` |

## Design implications (from hard rules)
- Rule 4: policy findings say "risk signal: phrase X on page Y", never "TikTok will reject". We cannot see the ad creative, the licence, the target market allowance or reviewer behaviour.
- Rule 5: only claim rules in the table above; each finding cites its source row and date. Anything in the "not found" list stays out until a doc is found.
- Market matters: the same phrase is allowed with a licence/age target in some markets (supplements, weight) and banned in others. Findings should carry `--market`; unknown market = lower severity.
- Keyword lexicon is the weak link: needs per-language lists (EN first; AR/UR/VI/ID later) and tuning on real PoC stores, like the trust module's Arabic/Urdu note.
- Price check cannot be a fact check. Recommended minimum: report extreme discount copy as `review` and leave "market average" out.

## What the scan checks (`--only policy`, also in the default run)
Keyword scan of the landing + product page text (the trust capture, no extra page loads). Code: `src/parsers/policy.ts` (lists), `src/rules/policy/index.ts`.

| Finding | Severity | Matches (English) |
|---|---|---|
| `policy.medical_claim` | major | cure/treat/heal/prevent + a condition (acne, hair loss, cancer, diabetes...), remove wrinkles, "permanent" hair/fat/results, "miracle cure" |
| `policy.exaggerated_result` | minor | "guaranteed results", "100% effective", "instant/overnight results", "lose/results in N days", "#1 selling", bare "miracle" |
| `policy.weight_claim` | major | "lose N kg", "without diet/exercise", fat burner, slimming tea/pills, "lose weight fast" |
| `policy.before_after` | minor | the words "before and after" / "before & after" (text only) |
| `policy.extreme_discount` | info | 70-100% off / discount |
| `policy.claims` | info | summary: unverifiable on unreadable or non-English pages; "no hits" is not a clearance |

Status is always `detected` (a signal), never `missing`; evidence is the quoted page text.

## Limits
- English only. A page with under 60% Latin letters is `unverifiable`: Arabic/Urdu (IQ, PK, AE stores) get no verdict until lists exist for them.
- Phrase lists are a first guess, untuned: no store in the PoC has been scanned with them yet. Expect false positives ("treats acne" in a testimonial or a disclaimer) and misses (paraphrases).
- Not checked: images (before/after photos), ad creative vs page mismatch, prohibited products on the page, licences, whether the market allows the product (weight/supplements differ by market), real market price.
- Text only from landing and product pages; claims on other pages or behind tabs/accordions that stay hidden are not seen.
- Next step if noise is high: send only the matched snippets to an LLM to confirm (see conversation 2026-10-05), keeping the verdict at `risk` and requiring the quote to exist in the page.

## First real-page results (2026-10-05, no tuning done)
- 16 PoC stores (fashion/electronics, PK/AE): 12 readable, 0 medical/weight/exaggerated/before-after hits; 3 `extreme_discount` (real sales); 4 unverifiable (bot wall/short page, same as trust).
- 4 health/beauty pages found by search (derma.pk x2, yourmart.pk, markaz.app): 1 hit, a true positive (markaz.app: "effectively to treat Acne, pimples, Scars, dark spots"). The 2 misses use soft wording ("reduce hair fall, support natural regrowth", "Anti Acne", "improve the appearance of acne marks", "Whitening"): not in any TikTok example, so left unmatched (rule 5). Precision looks high, recall is only tested on a handful of pages.
