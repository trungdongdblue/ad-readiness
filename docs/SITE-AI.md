# AI reading of the store's pages

The keyword lists find the usual links and phrases. The AI covers what they cannot: links named in other words or languages, pages that are not what their link says, and who runs the store. Two model calls per scan, both in the crawl (`src/scenarios/crawl.ts`, `src/app/scan-service.ts`). On when `GOOGLE_GENAI_API_KEY` is set; off with `--no-llm` or `llm: false`. Without it the keyword rules decide alone.

## What it does
| Call | When | Input | Output |
|---|---|---|---|
| **Pick links** (`pickPageLinks`) | before the crawl | the site's links as `index|text|path`, shop links (`/products`, `/collections`, `/blogs`...) blanked, footer links first | up to 2 link indexes per page type (refund, terms, privacy, shipping, contact, about, faq, hub), any language. A link may serve two types ("Shipping & Returns"). The AI's pages are opened first and decide a page's kind; the keyword picks follow and fill what it left out (they decide alone without a key). |
| **Review pages** (`reviewSite`) | after the crawl | one line per page that loaded: path, assigned kind, status, the page's own title (`<title>` and first heading) and the text with menu and footer link names cut out, duplicates and 1-2 word labels removed, 2,500 characters; plus the footer and the start of About and Contact | per page: `covers` (what the page is mainly about), `sections` (other types it has a real section on, with costs, times or conditions) and whether it is substantial; per store: brand, company, address, phone, email |

How the rules use it (`src/parsers/site.ts`, `src/rules/trust/`):
- A page the AI says it *covers* counts for that policy, wherever its link was filed. One "Shipping & Returns" page serves both.
- A page with a real *section* on the policy (a Terms page with a Delivery section, a FAQ answer with charges) = a section (minor), "only inside the FAQ page". FAQ is preferred over Terms and About as the place named. A footer or menu that only lists policy names, or a one-line clause, is not a section.
- A full section that a footer link named for the policy ("Exchange & Returns" -> `/guide#returns`) lands on is a policy page: each `#section` is read as a page of its own.
- Covered by a FAQ, About or Contact page = a section (minor). Covered but not substantial = minor. A page the AI reads as covering nothing, behind a link named for the policy (a returns portal, a form, a stub, a page filed under the wrong policy) = `detected`, minor, "link opens a different page". Never `missing`: the link exists.
- Brand, company, address, phone and email the AI read count for the company and contact findings.
- Without a verdict for a page (no key, call failed, model skipped it) the old rule applies: 60 words or more is a page.

## Safety (hard rules 4 and 5)
- Links come back as indexes, so only real same-site links can be opened; every address still passes `assertSafeUrl`.
- Identity values must occur verbatim in the site text, or they are dropped. Unknown page types and ids are dropped. Output is JSON-schema constrained, temperature 0.
- Page text is untrusted: the prompt says never to follow it, and delimiters are stripped. A page can only change its own verdict; the tests include an injected page and an injected footer.
- **The AI can lower a result** (a page the keyword rules called "found" becomes "link opens a different page"), unlike the claims review that only adds. Its worst effect is a minor finding, never `missing`.
- No TikTok facts are generated. The AI classifies what the store wrote.

## Model choice (`npm run site:eval -- --models a,b --repeat 3`)
Synthetic labelled cases (`src/poc/site-cases.ts`): 12 link sets (vi, es, de, fr, ar, romanised Urdu, brand-named links, product traps, off-site links, tr/id, combined pages), 22 pages (full policies in en/es/ur/ar/vi, returns portal, coming soon, soft 404, product list, a Terms page with a delivery clause and with a real Delivery section, a menu that lists policy names, a title that names the page, injected page...), 7 footers (brand only, Ltd, Arabic, local phone, nothing, product names, injection). 2026-10-06, 3 runs each.

| Model | Links | Pages exactly right | False coverage | Identity | Time | Verdict |
|---|---|---|---|---|---|---|
| gemini-3.1-flash-lite | 162/162 | 54/54 | 0 | 30/30, 0 wrong | 69 s | **chosen** |
| gemini-3.5-flash-lite | 162/162 | 54/54 | 0 | 30/30, 0 wrong | 85 s | same, some invalid JSON |
| gemini-3.5-flash | 162/162 | 51/54 | 3 | 26/30 | 245 s | worse and 4x slower |
| gemini-2.5-flash | 162/162 | 0/54 | 0 | 30/30 | 281 s | page review JSON truncated by thinking |

The set is saturated for the two flash-lite models, so it cannot separate them: the real test is real stores.

## Real stores (2026-10-06/07, PK and AE)
Against `poc/trust-truth.csv` (16 stores, 54 labelled cells; the labels were made from footer dumps and are marked "human review needed"):

| Version | Right | Wrong | Undecided |
|---|---|---|---|
| keyword + AI (before AI-first order, titles, sections) | 51 | 3 | 0 |
| AI-first order, page titles, `sections`, link names cut out | **52** | **2** | 0 |

The two remaining "wrong" cells are nishatlinen.com and priceoye.pk Shipping: the truth says no page, the scan says "only inside the FAQ page" (minor), which is accurate: both stores answer shipping in the FAQ and have no page or footer link for it. A binary column cannot hold that.

What the AI found that keywords cannot:
- **zellbury.com** serves its *privacy policy text* at `/pages/terms-and-condition`; Terms says "link opens a different page". priceoye.pk's Terms page is mostly menu (substantial: false).
- **limelight.pk, nishatlinen.com** keep policies behind a general Policies page; with the AI their Terms and Shipping become pages.
- **gulahmedshop.com**: Terms was "only inside the Privacy page" because the keyword rule saw the words "terms and conditions" in it; the AI reads the page and finds no Terms section, so it is `missing` (matches the truth).
- **outfitters.com.pk**: "Exchange & Returns" in the footer is `/pages/shopping-guide#link-exchange-returns`; the section is read on its own (full policy, 376 words), so it counts as a policy page. Terms and Privacy exist nowhere on the site and stay `missing`.
- **priceoye.pk, telemart.pk:** a footer line "Refund Policy Return Policy Shipping Policy..." made the AI read Terms, Contact and About as shipping and refund pages. Link names are now cut out of the text before it is sent, and a bare menu of policy names is a test case.

Bugs found on the way: the crawler kept only the first 400 links (telemart.pk has 1,240, outfitters.com.pk 1,708, so footer policy links were cut off; footer links now come first, repeats are removed, up to 800); and `/collections/contact-lenses` was opened as a Contact page (shop paths are never classified).

Still `unverifiable` for everything: ebuy.pk, khaadi.com, namshi.com (bot wall or country picker).

## Cost
Measured on 14 real scans (pick call, review call): about 4,500 tokens in and 420 out, 2 calls, 3 to 8 s. At 0.25 / 1.50 USD per 1M tokens that is about 0.0017 USD per scan, about **1.75 USD per 1,000 scans**, on top of the claims review (0.001) and the fix plan (0.0008).

## Limits
- Only the first 2,500 characters of a page are read (after menus, link names and duplicates are removed): a long page whose policy sits far down can be misjudged. Sections a footer link points to with `#name` are read on their own.
- 16 pages and 90 s per scan; one page per type from the keyword rules plus up to 2 per type from the AI.
- Pages the footer does not link to are not opened (no URL guessing, no sitemap).
- The eval pages are synthetic; add real misses to `src/poc/site-cases.ts`.
- Page text of scanned stores goes to Google's Gemini API (see `docs/LLM-REVIEW.md` on tiers and the privacy notice).
