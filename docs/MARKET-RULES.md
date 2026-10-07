# Market rules: what TikTok requires per country (PK, IQ, AE, SA, EG)

Retrieved 2026-10-07 from the public TikTok Business Help Center, page text read directly (not summaries). Re-read before changing a rule: pages change.
Base URL `https://ads.tiktok.com/help/article/<slug>`.

## Sources read

| Page (slug) | Last updated on page | Country-specific content for our 5 markets |
|---|---|---|
| Healthcare and Pharmaceuticals (`tiktok-ads-policy-healthcare-pharmaceuticals`) | September 2026 | Yes: one table per country or group |
| Weight Management and Body Image (`tiktok-ads-policy-weight-management`) | September 2026 | Yes: market lists |
| Ad Format and Functionality (`tiktok-advertising-policies-ad-creatives-landing-page-ad-format-and-functionality`) | April 2026 | Language rule, e-commerce landing page list, QR codes |
| Misleading and false content (`tiktok-ads-policy-misleading-and-false-content`) | April 2026 | None: same everywhere |
| Deceptive practices (`tiktok-ads-policy-deceptive-practices`) | August 2025 | None |
| Prohibited content (`...-prohibited-content`) | August 2025 | None |
| Best practices for your landing page (`ad-review-checklist-landing-page`) | September 2025 | None, except "local currency" |
| After conversion experience (`tiktok-after-conversion-experience-policy`) | February 2025 | None |
| Other products and services (`tiktok-ads-policy-other-products-and-services`) | August 2026 | Market lists for categories the scanner does not detect (tax, legal, alcohol in film, fertilizer, VPN, horoscope) |
| Standard events (`standard-events-parameters`) | April 2026 | None: no country named (read through a fetch tool that summarises, so confirm by hand) |
| About parameters (`about-parameters`) | March 2026 | None, but the list of supported currency codes decides what a store may send: PKR, AED, SAR, EGP, USD supported, **IQD not** |
| Pixel (`get-started-pixel`, read as raw text) | June 2026 | None: no country, consent or data-residency sentence |
| Event deduplication, reserved events, Test Events, preloading | not read | Not checked |

## Matrix by module

### Policy risk (claims on the landing page)

| Topic | PK | IQ | AE | SA | EG | Source |
|---|---|---|---|---|---|---|
| Medical claims (treat, cure, heal, prevent, "miracle", before/after for medicines, devices, supplements) | Not allowed | Not allowed | Not allowed | Not allowed | Not allowed | Healthcare, Sep 2026 |
| Prescription medicine | Not allowed | Not allowed | Not allowed | Not allowed | Not allowed | Healthcare |
| OTC medicine | May be allowed: approval from local authority, 18+ | same, plus disclose safety and usage | same as PK | same as IQ | same as IQ | Healthcare |
| Medical devices | May be allowed: approval, 18+ | same | same | same | same | Healthcare |
| Healthcare supplements | May be allowed: approval, 18+ (see conflict below) | same | same | same | same | Healthcare |
| Weight loss supplements, meal replacement, weight loss surgery | Allowed in select countries: age restriction, local licence (surgery also via TikTok sales rep) | same | same | **Not on the list** | same | Weight Management, Sep 2026 |
| Unrealistic loss, "without diet or exercise", "easy or guaranteed" | Not allowed | Not allowed | Not allowed | Not allowed | Not allowed | Weight Management (landing pages too) |
| Before/after product-effect comparisons | Not allowed | Not allowed | Not allowed | Not allowed | Not allowed | Misleading, Apr 2026 (landing pages too) |

Grouping on the Healthcare page: Pakistan has its own table. Egypt, Iraq and Saudi Arabia share one table (with Bahrain, Kuwait, Morocco, Oman). The UAE shares one with Qatar and South Africa.

**Conflict inside TikTok's page (all 5 markets):** "Healthcare supplements: may be allowed if approval and 18+", and in the same table "Medical-related products or services: Not allowed", whose examples include supplements ("Private healthcare products such as family planning, supplements..." for IQ, SA, EG, AE; "Dietary supplements and other similar products" for PK). We do not pick a side: the finding tells the owner to confirm with their TikTok sales representative.

**Change from our earlier notes (docs/POLICY-RULES.md, "update May 2026"):** the Weight Management page of September 2026 lists the UAE among the markets where weight loss supplements are allowed with conditions. Saudi Arabia is not in any allowed list.

### Information (landing page)

| Topic | All 5 markets | Source |
|---|---|---|
| Contact details, company name, company address, business licence, price in local currency, shipping, return and refund, terms, privacy | Required for e-commerce ads, same list everywhere | Ad Format and Functionality, Apr 2026 |
| Extra information in "certain countries or territories" | Not named. "Contact your TikTok Sales Representative." | same |
| Language of the page | **Not enforced** for PK, IQ, AE, SA, EG: "We trust you to make the decision to use the language of the target market ... ensure users have a good experience ... a language they understand" | same |

Language is enforced only for some other markets (for example Japan). Third-party pages that say "Pakistan: Urdu and English" are wrong for TikTok's current text. **Do not add a language check for these markets.**

### Tracking

TikTok's Pixel and event pages name no country: the events (ViewContent, AddToCart, InitiateCheckout) and the parameters are the same for every market. One thing still depends on the market: the **supported currency codes** (About parameters, Mar 2026): PKR, AED, SAR, EGP and USD are supported, **IQD is not**. So a store in Iraq that sends `currency: IQD` is flagged by `params.currency_supported` and told to send a supported currency such as USD. The other four markets have no such issue. The rule already exists and applies to every market (docs/TRACKING-RULES.md); only its advice text mentions Iraq.

Not read: event deduplication, reserved events, Test Events. The Standard events and About parameters pages were read through a fetch tool that summarises: the currency list was quoted in full and matches our earlier note.

### Mobile

No country-specific rule found in the pages read. The preloading page was not read.

### Not applicable to the scanner

QR codes in ad content (not allowed in all 5 markets when they lead to third-party sites), static-image ads, alcohol, dating, tax, legal, VPN, horoscope: these concern ad creative or product categories that the scanner does not see.

## What the scanner does with this

- `src/rules/policy/markets.ts`: per market notes appended to the fix text of medical, weight and before/after findings. Severity does not change with the market, because TikTok's bans on these claims are the same in all five.
- Without a market ("Other"), no market note is added.
- `trust.price_currency` (info, never a penalty): says when prices on the page are written in a currency other than the market's. The scanner browses from outside the country, so a store may show USD to us and the local currency to shoppers: it is a prompt to check, not a finding of fault.
