import type { Source } from '../domain/types';

const tt = (title: string, slug: string, date: string): Source => ({ kind: 'tiktok', title, url: `https://ads.tiktok.com/help/article/${slug}`, date });
const other = (title: string, url?: string, date?: string): Source => ({ kind: 'third-party', title, ...(url ? { url } : {}), ...(date ? { date } : {}) });

/** Every fact is from docs/*-RULES.md (hard rule 5). Update the doc first, then this file. */
const S = {
  pixel: tt('Pixel', 'get-started-pixel', '2026-10-05'),
  testEvents: tt('Test Events', 'tiktok-events-manager-monitor-and-diagnose', '2025-11'),
  events: tt('Standard events', 'standard-events-parameters', '2026-04'),
  reserved: tt('Reserved events', 'reserved-events', '2025-09'),
  params: tt('About parameters', 'about-parameters', '2026-03'),
  dedup: tt('Event deduplication', 'event-deduplication', '2025-05'),
  loading: { kind: 'tiktok', title: 'Landing Page Loading Optimization', url: 'https://ads.tiktok.com/help/article?aid=10001889', date: '2025-06' } satisfies Source,
  guide: { kind: 'tiktok', title: 'Website advertising guide', url: 'https://ads.tiktok.com/business/en/guides/website-advertising-guide', date: 'undated' } satisfies Source,
  bestPractice: tt('Best practices for your landing page', 'ad-review-checklist-landing-page', '2025-09'),
  adFormat: tt('Ad Format and Functionality', 'tiktok-advertising-policies-ad-creatives-landing-page-ad-format-and-functionality', '2026-04'),
  afterConv: tt('After Conversion Experience Policy', 'tiktok-after-conversion-experience-policy', '2025-02'),
  prohibited: tt('Prohibited Content (ad creatives and landing page)', 'tiktok-advertising-policies-ad-creatives-landing-page-prohibited-content?redirected=2', '2025-02'),
  health: tt('Healthcare and Pharmaceuticals', 'tiktok-ads-policy-healthcare-pharmaceuticals', '2026-09'),
  weight: tt('Weight Management', 'tiktok-ads-policy-weight-management', '2026-09'),
  misleading: tt('Misleading and false content', 'tiktok-ads-policy-misleading-and-false-content', '2026-04'),
  deceptive: tt('Deceptive practices', 'tiktok-ads-policy-deceptive-practices', '2025-08'),
  cwv: other('web.dev Core Web Vitals: LCP 2.5s/4s, INP 200ms/500ms, CLS 0.1/0.25 (not a TikTok threshold)'),
  crux: other('Chrome UX Report API: real-user p75, 28 days', 'https://developer.chrome.com/docs/crux/api', '2026-10-02'),
  tap: other('WCAG 2.5.5 and Apple HIG: tap target 44px (not a TikTok threshold)'),
  contrast: other('WCAG 1.4.11: contrast 3:1 (not a TikTok threshold)'),
};

/** First match wins, so specific ids go before their prefix. A rule with no row has no source (e.g. mobile.checkout counts only). */
const MAP: readonly (readonly [RegExp, Source[]])[] = [
  [/^pixel\.silent$/, [S.testEvents, S.pixel]],
  [/^pixel\./, [S.pixel]],
  [/^(event\.duplicate|serverside\.)/, [S.dedup]],
  [/^event\./, [S.events, S.reserved]],
  [/^params\./, [S.params]],
  [/^mobile\.speed$/, [S.cwv, S.crux, S.loading]],
  [/^mobile\.buy_button$/, [S.tap, S.contrast, S.guide]],
  [/^trust\.price_currency$/, [S.bestPractice, S.adFormat]],
  [/^trust\.refund_policy$/, [S.adFormat, S.afterConv]],
  [/^trust\.contact$/, [S.adFormat, S.afterConv, S.bestPractice]],
  [/^trust\./, [S.adFormat]],
  [/^policy\.medical_claim$/, [S.health]],
  [/^policy\.weight_claim$/, [S.weight]],
  [/^policy\.(exaggerated_result|before_after)$/, [S.misleading]],
  [/^policy\.extreme_discount$/, [S.deceptive]],
  [/^policy\.claims$/, [S.prohibited]],
];

export const sourcesFor = (id: string): Source[] | undefined => MAP.find(([re]) => re.test(id))?.[1];
