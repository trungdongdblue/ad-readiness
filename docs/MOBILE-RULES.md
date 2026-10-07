# Mobile experience rules - sources and thresholds

Checked 2026-10-01. Page text was read through a summarising fetch, not verbatim: re-open the links before quoting.

## What TikTok officially says (no numbers, no scoring method)
| Topic | Statement | Source (last updated shown on page) |
|---|---|---|
| Mobile-friendly | Landing page must be mobile-friendly; viewable in horizontal and vertical orientation | [Best practices for your landing page](https://ads.tiktok.com/help/article/ad-review-checklist-landing-page?lang=en) (Sep 2025) |
| Readability | All text, including buttons, readable without zooming | same |
| Sensitive data | Landing page must not demand sensitive data (ID, card, health, biometric) to access the site | same |
| Load speed | Mobile-first design, fewer redirects, CDN, async third-party scripts, compressed images with set dimensions | [Landing Page Loading Optimization](https://ads.tiktok.com/help/article?aid=10001889) (Jun 2025) |
| Preloading | In-feed landing pages are preloaded by default; compress files, host in multiple regions, prefer static HTML | [Preloading](https://ads.tiktok.com/help/article/how-to-optimize-your-site-for-preloading-content) (Jul 2026) |
| CTA / checkout | One clear CTA, critical content visible without scrolling, short forms or simple checkout | [Website advertising guide](https://ads.tiktok.com/business/en/guides/website-advertising-guide) (no date) |

TikTok publishes **no** load-time threshold, no tap-target size and no checkout-step count. Any "under 1s / 3s" figure seen in blogs is third party, not TikTok.

## Load speed is shown, not graded (calibration 2026-10-02, asimjofa.com, mobile)
| | LCP | CLS | TBT / INP |
|---|---|---|---|
| Lighthouse lab via PSI (Moto G Power, slow 4G) | 19.4s | 0 | TBT 920ms |
| This tool (Pixel 7, slow 4G, 4x CPU) | 12.7s | 0.00 | TBT measured via longtask |
| Real users (CrUX p75, 1-28 Sep 2026) | 3.0s | 0 | INP 409ms (Core Web Vitals: failed) |

Lab and tool agree in magnitude; both are far above real users. So lab numbers are `info` only. Reuse the web.dev thresholds (LCP 2.5s/4s, CLS 0.1/0.25, INP 200ms/500ms) only on real-user data (CrUX), once wired in. TBT is a lab stand-in for INP, which needs real users.

## Real-user data (CrUX API) and what happens when Google has none
Source: [CrUX API docs](https://developer.chrome.com/docs/crux/api) (read 2026-10-02 via summary). `POST .../v1/records:queryRecord?key=KEY`, body `{url|origin, formFactor: "PHONE"}`. 28-day rolling p75, updated daily, about 2 days behind. 150 queries/min per Google Cloud project, free, quota cannot be bought. Key from env `CRUX_API_KEY` (never in the repo).

Confirmed with live calls (2026-10-05): response fields and p75 shapes match; no data = `404 NOT_FOUND "chrome ux report data not found"`.

Gotchas found live:
- Origin match is exact. `limelight.pk` redirects to `www.limelight.pk`: the non-www origin returns 404, the www one has data. So query the landing page's URL after redirects, never the typed URL and never the last funnel page (checkout).
- Coverage on the PoC store list: all 10 probed Pakistani stores had data on at least one host variant (e.g. zellbury.com yes, www.zellbury.com 404). The "no data" path was verified at API level and in unit tests, but no scanned store has hit it yet.
- 2026-10-05, asimjofa.com page-level p75: LCP 3.0s, INP 410ms, CLS 0, FCP 2.1s, TTFB 0.7s: matches PageSpeed Insights from 2026-10-02.

| Case | What the tool does |
|---|---|
| Page-level data | Graded with web.dev bands (LCP 2.5s/4s, INP 200ms/500ms, CLS 0.1/0.25): worst one wins |
| Only domain-level data | Same, labelled "domain-level" |
| 404 for page and domain | Lab run (about 90s), shown ungraded, reason "no real-user data" |
| No key / API error / network | Lab run, reason recorded, scan never fails |
| Some metrics missing (e.g. no INP) | Grades what exists |

Lab runs only when real-user data is missing, to save about 90s per scan. Limits: Chrome users in general, not TikTok's in-app browser; stale by about 2 days.

## Thresholds this tool uses (third-party standards, not TikTok's)
| Check | Rule | Source |
|---|---|---|
| Tap target | >= 44px | WCAG 2.5.5 (AAA), Apple HIG |
| Contrast | >= 3:1 flagged below | WCAG 1.4.11 (UI components) |
| Throttle | 150ms RTT, 1.6 Mbps down, 750 Kbps up, 4x CPU | Lighthouse mobile preset, approximated. TODO verify |

Not yet re-verified against the live web.dev / WCAG pages. Checkout: only counts (fields, step indicator) are reported, with no good/bad judgement, since no source defines one.

## Measurement limits
- Emulated Pixel 7 on the scanner's network, not TikTok's in-app browser and not a real PK connection.
- CLS is a plain sum of layout shifts, which can overstate Chrome's session-window CLS.
- Checkout: first screen only (we never type or submit).
