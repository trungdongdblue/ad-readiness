/**
 * Plain-language help for every term and finding a customer can meet. Written for a store owner, not an ad specialist.
 * Facts about TikTok must trace to docs/*-RULES.md (hard rule 5); anything else stays general.
 */
export interface Term {
  name: string;
  plain: string;
}

export const TERMS: Record<string, Term> = {
  LCP: { name: 'Largest Contentful Paint', plain: 'How long until the main content, usually the big product image, appears on screen.' },
  INP: { name: 'Interaction to Next Paint', plain: 'How quickly the page reacts when a shopper taps a button or a menu.' },
  CLS: { name: 'Cumulative Layout Shift', plain: 'How much the page jumps around while it loads. Jumping makes shoppers tap the wrong thing.' },
  FCP: { name: 'First Contentful Paint', plain: 'How long until anything at all shows on screen.' },
  TTFB: { name: 'Time To First Byte', plain: 'How long your server takes to start answering. Slow hosting shows up here.' },
  TBT: { name: 'Total Blocking Time', plain: 'How long the page is frozen and ignores taps while its scripts run.' },
  p75: { name: '75th percentile', plain: 'Three out of four real visits were this fast or faster. It shows a typical visit, not the best one.' },
  ROAS: { name: 'Return on ad spend', plain: 'Revenue you earn for each unit of money spent on ads.' },
  COD: { name: 'Cash on delivery', plain: 'The shopper pays when the order arrives.' },
};

export interface FindingHelp {
  /** What this check is, in one sentence. */
  plain: string;
  /** Why it matters for TikTok ads. */
  why: string;
}

export const FINDING_HELP: Record<string, FindingHelp> = {
  'pixel.present': { plain: 'The TikTok Pixel is a small piece of tracking code on your site. It tells TikTok what shoppers do there.', why: 'Without it TikTok cannot find buyers for you or measure your sales.' },
  'pixel.multiple': { plain: 'More than one TikTok Pixel loads on your site.', why: 'One for the store and one for an agency can be fine. TikTok recommends one per website, and two feeding the same ad account can double-count.' },
  'pixel.silent': { plain: 'The Pixel loaded, but reported no shopper action while we browsed.', why: 'Often a cookie banner blocks it, or its events are not set up. TikTok then learns nothing.' },
  'event.ViewContent': { plain: 'Reported when a shopper views a product page.', why: 'TikTok uses it to learn who is interested in which products.' },
  'event.AddToCart': { plain: 'Reported when a shopper adds a product to the cart.', why: 'A strong sign someone is close to buying, so TikTok can look for more people like them.' },
  'event.InitiateCheckout': { plain: 'Reported when a shopper starts checkout.', why: 'Shows who is serious about buying, and lets you show ads again to people who left.' },
  'event.Purchase': { plain: 'Reported when an order is completed. We never place orders, so we cannot see this one.', why: 'It is how TikTok measures sales. Check it yourself in TikTok Events Manager under Test Events.' },
  'event.unknown_name': { plain: 'Some events use names that TikTok does not treat as standard.', why: 'Custom events cannot be used to optimise campaigns. Use a standard event where one fits.' },
  'event.alias': { plain: 'Some events use an older name that TikTok converts for you.', why: 'It works today. Switching to the standard name keeps your setup clean.' },
  'event.duplicate': { plain: 'The same event was sent more than once for a single shopper action.', why: 'It can inflate your conversion numbers and mislead TikTok.' },
  'serverside.events_api': { plain: 'Server-side tracking (Events API) sends events from your server as a backup to the browser Pixel. It cannot be seen from outside.', why: 'If you use it, send the same event_id from both so TikTok does not count one action twice.' },
  'params.value': { plain: 'Events should carry the order value as a plain number.', why: 'TikTok needs the value to report revenue and to optimise for return on ad spend.' },
  'params.value_currency_pair': { plain: 'Value and currency must be sent together.', why: 'TikTok needs both to report revenue correctly.' },
  'params.currency_supported': { plain: 'The currency code is not one TikTok accepts in events.', why: 'Revenue in that currency will not be reported.' },
  'params.content_type': { plain: 'Events should say what kind of item was involved, "product" or "product_group".', why: 'It helps TikTok match shoppers to your products.' },
  'params.content_ids': { plain: 'Events should list the product IDs involved.', why: 'It helps TikTok match shoppers to your products.' },
  'mobile.speed': { plain: 'How fast your page feels to real visitors on phones, based on Google Chrome data from the last 28 days.', why: 'Slow pages lose shoppers before they see the product. TikTok asks for fast, mobile-first landing pages.' },
  'mobile.buy_button': { plain: 'Whether a shopper can easily see and tap your main buy button on a phone.', why: 'TikTok advises one clear button in the first screen, readable without zooming.' },
  'mobile.checkout': { plain: 'How many fields a shopper sees when checkout opens.', why: 'Shorter forms usually mean fewer abandoned orders. We only count fields; there is no official target.' },
  'trust.refund_policy': { plain: 'A page that explains returns and refunds.', why: 'TikTok requires it on e-commerce landing pages, and shoppers look for it before paying.' },
  'trust.terms': { plain: 'A terms and conditions page.', why: 'TikTok requires it on e-commerce landing pages.' },
  'trust.privacy': { plain: 'A privacy policy page.', why: 'TikTok requires it on e-commerce landing pages.' },
  'trust.shipping': { plain: 'A page with delivery costs and times.', why: 'TikTok lists shipping information as required on e-commerce landing pages.' },
  'trust.contact': { plain: 'A phone number or email shoppers can reach.', why: 'TikTok requires contact details, and shoppers trust stores they can reach.' },
  'trust.company': { plain: 'Who runs the store: a company or brand name, an address or a business licence.', why: 'Shoppers and ad reviewers look for who is behind a store. A brand name in the footer works if you are not a registered company. It is shown for information only.' },
  'trust.price': { plain: 'Prices shown next to a currency.', why: 'TikTok requires prices in the local currency.' },
  'trust.price_currency': { plain: 'Prices that may be written in a currency other than your target market\'s.', why: 'TikTok asks for prices in the local currency of the market you advertise to. Check what shoppers in that country see.' },
  'trust.payment': { plain: 'Payment methods named before checkout, such as COD, Visa or JazzCash.', why: 'TikTok does not require this. It is shown for information only.' },
  'policy.claims': { plain: 'A summary of the claim wording check.', why: 'It is a signal from a keyword list and an AI review, not a TikTok decision.' },
  'policy.medical_claim': { plain: 'Wording that suggests the product cures or treats a medical condition.', why: 'TikTok does not allow medical claims without an approved medical licence.' },
  'policy.exaggerated_result': { plain: 'Wording that promises or guarantees results.', why: 'TikTok does not allow ad content or landing pages that promise or exaggerate results.' },
  'policy.weight_claim': { plain: 'Wording that promises unrealistic or effortless weight loss.', why: 'TikTok restricts these claims on the ad and on the landing page.' },
  'policy.before_after': { plain: 'Before and after comparisons of a product effect.', why: 'TikTok restricts them because they can give a false impression.' },
  'policy.extreme_discount': { plain: 'Very large discounts, such as 70% off.', why: 'A big discount alone is not a violation. Make sure prices and compare-at prices are honest.' },
};

export const EXPECTED_EVENTS = [
  { name: 'ViewContent', plain: 'A shopper views a product' },
  { name: 'AddToCart', plain: 'A shopper adds it to the cart' },
  { name: 'InitiateCheckout', plain: 'A shopper starts checkout' },
  { name: 'Purchase', plain: 'An order is completed' },
] as const;

/** Events the Pixel sends by itself; they are normal and not something to fix. */
export const TIKTOK_AUTO_EVENTS = new Set(['LandingPageView', 'EngagedSession', 'PageView']);

export const METRIC_COPY = {
  lcp: { term: 'LCP', title: 'Loading speed', format: (v: number) => `${(v / 1000).toFixed(1)} s` },
  inp: { term: 'INP', title: 'Tap response', format: (v: number) => `${Math.round(v)} ms` },
  cls: { term: 'CLS', title: 'Layout stability', format: (v: number) => v.toFixed(2) },
} as const;

export const GRADE_COPY = { good: 'Good', needs: 'Needs improvement', poor: 'Poor' } as const;
