# Landing page trust / compliance rules - sources and limits

Checked 2026-10-05. Page text was read through a summarising fetch, not verbatim: re-open the links before quoting.

## What TikTok officially says
| Topic | Statement | Source (last updated shown on page) |
|---|---|---|
| E-commerce landing page | "E-commerce ads must display complete and accurate information on the landing page." | [Ad Format and Functionality](https://ads.tiktok.com/help/article/tiktok-advertising-policies-ad-creatives-landing-page-ad-format-and-functionality) (Apr 2026) |
| Contact | "telephone number, email address, or optional fax number"; also company name, company address, business license | same |
| Price | "Price displayed in local currency" | same |
| Returns | "Shipping information", "Return and refund policy"; also terms and conditions, privacy policy | same |
| Region extras | Some regions need more info; if insufficient, a notification asks for it before approval | same |
| Support | "clear refund policies, accessible customer service, reasonable customer service response times, and product guarantees" | [After Conversion Experience Policy](https://ads.tiktok.com/help/article/tiktok-after-conversion-experience-policy) (Feb 2025) |
| Hidden fees | Recurring billing / subscriptions: disclose "recurring charges, and any hidden fees before checkout", opt-in checkbox | same |
| Misleading price | "avoid promotions with prices that are unusually low or high in ways that could mislead or scam users" | same |
| Where | Info in visible places such as the footer: owner, policies, prices in local currency, terms, licenses (best practice) | [Best practices for your landing page](https://ads.tiktok.com/help/article/ad-review-checklist-landing-page) (Sep 2025) |

**Not in any TikTok doc found:** a "payment methods" requirement, what makes a refund policy "sufficient" (length, return window), or an exact location. So "payment is clear" is read as price + currency visible, and payment methods are shown as information only.

## What the scan checks (`--only trust`, also in the default run)
After the funnel, the scan **crawls the site** (`src/scenarios/crawl.ts`, `src/parsers/crawl.ts`): it opens the store's own refund, terms, privacy, shipping, contact, About and FAQ pages (one per kind, same host or a subdomain, at most 12 pages and 75 s), and the policy pages a general Policies page links to. It reads text, links, icon names (payment logos), mailto/tel links and iframes (help centers). Read only; every address passes `assertSafeUrl`, and the crawl tab is not recorded as funnel evidence. The first checkout screen is read too (payment methods).

With a Gemini key, an AI picks links in any language before the crawl and reads every opened page after it (what the page really covers, who runs the store): `docs/SITE-AI.md`. Keyword rules alone decide without a key.

The answer is yes or no. `unverifiable` is kept for what cannot be seen: a bot wall, an unreadable page, a page that answered 403/429/5xx or never loaded, a product or checkout never reached, or a crawl that did not run.

| Finding | detected | missing | unverifiable |
|---|---|---|---|
| `trust.refund_policy`, `terms`, `privacy`, `shipping` | its own page opened with 60+ words = info; a link we did not open = info; page nearly empty = minor; a section inside another page (FAQ, Terms, About, landing) with no page of its own = minor | link leads to a 404/410 page, or nothing anywhere on a parsed site (30+ links, a footer-type link) = major | the page it names blocked the scanner, page unreadable, or the footer did not load |
| `trust.contact` | email or phone anywhere on the site = info; only WhatsApp or a contact-page link = minor | none of that after the crawl = major | contact page blocked us, or the footer did not load |
| `trust.company` | legal-entity suffix, license/registration/tax id, a street address, a brand name in the copyright line ("© 2026 Brand"), or an About page with real text = info | none of that, after the crawl = **info** (a note, never a penalty: many stores are a brand, not a registered company) | one of About/Contact/Terms blocked us, or the crawl did not run |
| `trust.price` | any price next to a currency symbol or code, or after the word "price" | a product page was reached and shows none = minor | no product page reached |
| `trust.payment` | payment names in text, icon names, crawled pages or the first checkout screen = info | none anywhere = **info** (a note, never a penalty: TikTok does not require it) | the crawl did not run |

## Limits
- Presence only. A link to an empty or auto-generated policy page still counts. Quality is not judged.
- One-page COD landings often have few footer links (policy in a modal): fewer than 30 links gives `unverifiable`. Real stores in the PoC had 200-1700 links.
- **Unreadable page** (under 500 characters of text, or a bot-wall phrase such as "security verification" / "just a moment"): every finding is `unverifiable`, including positives. Found 2026-10-05: ishopping.pk (Cloudflare wall, its own "Privacy" link was counted), khaadi.com (country picker, exactly 5 links).
- **Footer not loaded:** `missing` also needs at least one footer-type link (About, Contact, FAQ, Help, Track, Blog...). ishopping.pk (2026-10-05): scanner passed the Cloudflare wall, 367 links, but the DOM ended at a product carousel with the challenge overlay still on top ("Performance and Security by Cloudflare", 37k chars): no footer, so no verdict.
- A general "Policies" / "Legal" page is opened and the policy pages it links to are read one level down. Without the crawl it stays `unverifiable`.
- Link text and URL are both matched, including the `#hash` (outfitters.com.pk links `/pages/shopping-guide#link-exchange-returns` as "Exchange & Returns"). Both were missed by the first version.
- Anchors without href are read too: allbirds.com opens Privacy/Terms in a JS modal (checked 2026-10-05), so `a[href]` alone gave a false "no link".
- Region redirects and bot walls can still hide links; the scan also scrolls to the bottom once before reading.
- Prices: a short list of symbols and codes, plus any 3-letter code next to a number and the word "price". Whether the currency is the market's local one is not judged (the scanner is not in the market, so a store may show another currency).
- Hidden fees, subscription disclosure and real payment methods appear only after data entry at checkout: never observed (hard rule 2).
- Company or brand identity: never costs points. A brand in the copyright line counts, but "Limited time" and a bare "All rights reserved" do not.
- Not crawled: pages the footer does not link to (no URL guessing, no sitemap), help-center articles below the first page, PDFs, and more than one page per kind.
- A policy that sits inside a help-center iframe is read only for the first 4 frames and the first 20,000 characters of each.
- Shipping/terms link text is broad ("shipping", "delivery", "conditions"): a product named "Shipping Container Lamp" could count. That errs towards `detected`, never towards a false accusation.
- Arabic/Urdu keywords are a first guess: tune on real PK/IQ/AE stores in the PoC.
