import type { Effort, GroupKey, Market, Stage, Verdict } from '@domain/api';
import type { Severity } from '@domain/types';

/** All customer-facing text lives here (DS voice: confident, specific, no emoji, no hype). */
export const CTA_URL: string = import.meta.env['VITE_CTA_URL'] ?? 'https://ecomdy.com';

export const MARKET_LABEL: Record<Market, string> = { PK: 'Pakistan', IQ: 'Iraq', AE: 'United Arab Emirates', SA: 'Saudi Arabia', EG: 'Egypt' };

export const GROUP_COPY: Record<GroupKey, { title: string; blurb: string; checks: string[] }> = {
  tracking: {
    title: 'Tracking',
    blurb: 'Can TikTok see what shoppers do?',
    checks: ['TikTok Pixel installed and firing', 'ViewContent, AddToCart and InitiateCheckout reach the wire', 'Value, currency and product parameters are sent', 'No duplicate or non-standard events'],
  },
  mobile: {
    title: 'Mobile experience',
    blurb: 'Does it convert on a phone?',
    checks: ['Real-user load speed (Core Web Vitals)', 'Buy button visible, large and readable', 'Checkout length on the first screen'],
  },
  trust: {
    title: 'Information',
    blurb: 'Does the store look safe to buy from?',
    checks: ['Return and refund policy, terms, privacy, shipping', 'Contact details and company information', 'Price shown in local currency, payment methods named'],
  },
  policy: {
    title: 'Policy risk',
    blurb: 'Will TikTok review flag the page?',
    checks: ['Medical and weight-loss claims', 'Exaggerated or guaranteed results', 'Before/after wording and extreme discounts'],
  },
};

export const WHY = [
  { title: 'Scored for TikTok Sales', body: 'Generic site graders ask whether a website is good. We ask whether this store can run TikTok conversion campaigns today.' },
  { title: 'Walks the funnel like a shopper', body: 'We open the landing page, a product, add to cart and checkout on an emulated phone, and capture the Pixel events each step sends.' },
  { title: 'Honest about what it cannot see', body: 'If something cannot be verified from outside, we say so. It is never counted against your score.' },
];

export const STAGE_STEPS: { stage: Stage; label: string; hint: string }[] = [
  { stage: 'landing', label: 'Opening your landing page', hint: 'Loading as a mobile shopper and accepting cookie banners.' },
  { stage: 'product', label: 'Finding a product page', hint: 'Looking for ViewContent and the buy button.' },
  { stage: 'add-to-cart', label: 'Adding to cart', hint: 'No order is placed. Nothing is submitted.' },
  { stage: 'checkout', label: 'Reaching checkout', hint: 'We stop at the first screen and never enter data.' },
  { stage: 'crawl', label: 'Reading your policy and contact pages', hint: 'Opening About, Contact, Refund, Terms, Privacy and Shipping pages. Read only.' },
  { stage: 'mobile', label: 'Measuring mobile speed', hint: 'Real-user data first. An emulated test can take about a minute.' },
  { stage: 'analysis', label: 'Scoring your store', hint: 'Checking tracking, information and policy wording.' },
];

export const PHASE_LABEL = { landing: 'Landing', product: 'Product', 'add-to-cart': 'Add to cart', checkout: 'Checkout' } as const;

export const VERDICT_COPY: Record<Verdict | 'none', { title: string; lead: string }> = {
  ready: { title: 'Ready to run', lead: 'Your store clears the main checks for TikTok Sales campaigns. Fix the small items below to protect your results.' },
  fixes: { title: 'Fixes needed before you scale', lead: 'You can run ads, but gaps below will cost you optimisation data, conversions or approvals.' },
  not_ready: { title: 'Not ready for TikTok ads', lead: 'Critical gaps below will stop campaigns from tracking or get them rejected. Fix these first.' },
  none: { title: 'We could not score this store', lead: 'Too little of the store could be checked. The sections below explain what blocked the scan.' },
};

export const SEVERITY_COPY: Record<Severity, { label: string; badge: string }> = {
  blocker: { label: 'Blocker', badge: 'badge--solid' },
  major: { label: 'Major', badge: 'badge--red' },
  minor: { label: 'Minor', badge: 'badge--warning' },
  info: { label: 'OK', badge: 'badge--success' },
};

export const EFFORT_COPY: Record<Effort, string> = { minutes: 'Quick fix', hour: 'About an hour', developer: 'Needs a developer' };

export const ADVICE_COPY = {
  eyebrow: 'AI fix plan',
  title: 'What to fix first',
  hint: 'The most important fixes first, in plain steps. Each one shows how much it lifts your score. Written by AI from your scan results.',
  loading: 'Writing your fix plan…',
  failed: 'The AI plan is not available right now. Every issue below still has fix steps.',
  note: 'Check menu names in your store admin before you start. This is guidance, not a TikTok approval.',
} as const;

export const DISCLAIMER =
  'Based only on what a scan can observe from outside the store. Policy checks combine a keyword list with an AI review of the page text (AI findings are labelled "AI:") and are signals, not a TikTok verdict or approval. Real-user speed data is from Chrome users, not the TikTok in-app browser.';
