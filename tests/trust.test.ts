import { describe, expect, it } from 'vitest';
import type { Finding, Observation, TrustCapture, TrustPage } from '../src/domain/types';
import { trustScore } from '../src/engine/trust-score';
import { TRUST_RULES } from '../src/rules/trust';

const link = (text: string, href: string) => ({ text, href });
const FILLER = [link('About us', 'https://s.test/about'), ...Array.from({ length: 29 }, (_, i) => link(`Page ${i}`, `https://s.test/pages/p${i}`))];
/** Enough visible text for the page to count as readable (500+ chars); test text is appended to it. */
const PAD = 'Shop now. '.repeat(60);
const trust = (over: Partial<TrustCapture> = {}): TrustCapture => ({ links: FILLER, ...over, text: `${PAD} ${over.text ?? ''}` });
const run = (t?: TrustCapture): Finding[] => {
  const o: Observation = { trust: t, platform: 'unknown', pixels: [], events: [], undecodedBeacons: 0, consentClicked: false, consentBannerSeen: false, phases: [] };
  return TRUST_RULES.flatMap((r) => r(o, {}));
};
const get = (fs: Finding[], id: string): Finding | undefined => fs.find((f) => f.id === id);

describe('pages that cannot be judged', () => {
  const all = (t: TrustCapture) => run(t).every((f) => f.status === 'unverifiable');
  it('country picker, empty shell and bot wall give unverifiable for everything', () => {
    expect(all({ links: FILLER, text: 'Select your country Pakistan UK' })).toBe(true);
    expect(all({ links: [link('Privacy', 'https://www.cloudflare.com/privacypolicy')], text: `Performing security verification ${PAD}`.slice(0, 700) })).toBe(true);
    expect(all({ links: FILLER, text: `Just a moment... ${PAD}` })).toBe(true);
  });
});

describe('footer that did not load', () => {
  it('many links but no footer-type link: never missing', () => {
    const noFooter = Array.from({ length: 40 }, (_, i) => link(`Product ${i}`, `https://s.test/p/${i}`));
    const f = run(trust({ links: noFooter }));
    expect(get(f, 'trust.refund_policy')?.status).toBe('unverifiable');
    expect(get(f, 'trust.contact')?.status).toBe('unverifiable');
  });
  it('a bot wall still sitting on a long page makes everything unverifiable', () => {
    expect(run(trust({ text: 'Performance and Security by Cloudflare' })).every((f) => f.status === 'unverifiable')).toBe(true);
  });
});

describe('refund policy', () => {
  it('detects a policy link by text or path', () => {
    expect(get(run(trust({ links: [...FILLER, link('Refund Policy', 'https://s.test/x')] })), 'trust.refund_policy')).toMatchObject({ status: 'detected', severity: 'info' });
    expect(get(run(trust({ links: [...FILLER, link('Terms', 'https://s.test/policies/refund-policy')] })), 'trust.refund_policy')?.status).toBe('detected');
    expect(get(run(trust({ links: [...FILLER, link('سياسة الاسترجاع', 'https://s.test/a')] })), 'trust.refund_policy')?.status).toBe('detected');
  });
  it('recognises "Exchange & Returns" and a returns section in the URL hash', () => {
    expect(get(run(trust({ links: [...FILLER, link('Exchange & Returns', 'https://s.test/a')] })), 'trust.refund_policy')?.status).toBe('detected');
    expect(get(run(trust({ links: [...FILLER, link('Guide', 'https://s.test/pages/shopping-guide#link-exchange-returns')] })), 'trust.refund_policy')?.status).toBe('detected');
  });
  it('a general Policies page is unverifiable, not missing', () => {
    const f = run(trust({ links: [...FILLER, link('Policies', 'https://s.test/pages/policies')] }));
    expect(get(f, 'trust.refund_policy')?.status).toBe('unverifiable');
    expect(get(f, 'trust.privacy')?.status).toBe('unverifiable');
  });
  it('does not mistake "return to shop" for a policy', () => {
    const f = get(run(trust({ links: [...FILLER, link('Return to shop', 'https://s.test/collections/all')] })), 'trust.refund_policy');
    expect(f?.status).toBe('missing');
  });
  it('text mention without a link is only minor', () => {
    expect(get(run(trust({ text: '30-day money back guarantee' })), 'trust.refund_policy')).toMatchObject({ status: 'detected', severity: 'minor' });
  });
  it('says missing only when the page was parsed (30+ links), else unverifiable', () => {
    expect(get(run(trust()), 'trust.refund_policy')).toMatchObject({ status: 'missing', severity: 'major' });
    expect(get(run(trust({ links: FILLER.slice(0, 5) })), 'trust.refund_policy')?.status).toBe('unverifiable');
    expect(get(run(undefined), 'trust.refund_policy')?.status).toBe('unverifiable');
  });
});

describe('terms, privacy, shipping (same link logic as refund)', () => {
  const only = (id: string, links: ReturnType<typeof link>[], text = 'Shop now') => get(run(trust({ links: [...FILLER, ...links], text })), id);
  it('detects by link text or path', () => {
    expect(only('trust.terms', [link('Terms of Service', 'https://s.test/a')])?.status).toBe('detected');
    expect(only('trust.terms', [link('Legal', 'https://s.test/policies/terms-of-service')])?.status).toBe('detected');
    expect(only('trust.privacy', [link('Privacy Policy', 'https://s.test/b')])?.status).toBe('detected');
    expect(only('trust.privacy', [link('سياسة الخصوصية', 'https://s.test/b')])?.status).toBe('detected');
    expect(only('trust.shipping', [link('Shipping & Delivery', 'https://s.test/c')])?.status).toBe('detected');
  });
  it('"photos" is not a TOS path, "free shipping" banner is not a shipping page', () => {
    expect(only('trust.terms', [link('Gallery', 'https://s.test/photos/1')])?.status).toBe('missing');
    expect(only('trust.shipping', [], 'Free shipping on all orders')?.status).toBe('missing');
  });
  it('shipping is missing like the others when no page, FAQ or text says anything about it', () => {
    expect(get(run(trust()), 'trust.shipping')?.status).toBe('missing');
    expect(get(run(trust()), 'trust.terms')?.status).toBe('missing');
  });
  it('text mention is minor, sparse page is unverifiable, no page too', () => {
    expect(only('trust.privacy', [], 'Read our Privacy Policy')).toMatchObject({ status: 'detected', severity: 'minor' });
    expect(get(run(trust({ links: [] })), 'trust.terms')?.status).toBe('unverifiable');
    expect(get(run(undefined), 'trust.privacy')?.status).toBe('unverifiable');
  });
  it('missing is major', () => {
    expect(get(run(trust()), 'trust.privacy')).toMatchObject({ status: 'missing', severity: 'major' });
  });
});

describe('company details', () => {
  const co = (text: string) => get(run(trust({ text })), 'trust.company');
  it('recognises legal name, license and address', () => {
    expect(co('Acme Trading LLC, Dubai')?.evidence).toContain('legal entity name');
    expect(co('Trade License No. 12345')?.evidence).toContain('license/registration/tax id');
    expect(co('Office 5, 12 Main Street, Karachi')?.evidence).toContain('address');
    expect(co('P.O. Box 4455')?.evidence).toContain('address');
  });
  it('a brand in the copyright line is enough; look-alike words and a bare "All rights reserved" are not', () => {
    expect(co('© 2026 My Store')).toMatchObject({ status: 'detected', evidence: ['brand name in the copyright line'] });
    expect(co('Copyright 2026 Sunny Beauty. All rights reserved.')?.status).toBe('detected');
    expect(co('Limited time offer, floor mats')?.status).toBe('unverifiable');
    expect(co('© 2026 All rights reserved')?.status).toBe('unverifiable');
  });
});

describe('contact info', () => {
  it('detects mailto, tel and plain email text', () => {
    expect(get(run(trust({ links: [...FILLER, link('Mail', 'mailto:a@b.co')] })), 'trust.contact')).toMatchObject({ status: 'detected', severity: 'info' });
    expect(get(run(trust({ links: [...FILLER, link('Call', 'tel:+923001234567')] })), 'trust.contact')?.severity).toBe('info');
    expect(get(run(trust({ text: 'write to help@shop.com' })), 'trust.contact')?.severity).toBe('info');
    expect(get(run(trust({ text: 'Phone: +92 300 1234567' })), 'trust.contact')?.severity).toBe('info');
  });
  it('WhatsApp or contact page alone is minor', () => {
    expect(get(run(trust({ links: [...FILLER, link('Chat', 'https://wa.me/923001234567')] })), 'trust.contact')).toMatchObject({ status: 'detected', severity: 'minor' });
    expect(get(run(trust({ links: [...FILLER, link('Contact us', 'https://s.test/pages/contact')] })), 'trust.contact')?.severity).toBe('minor');
  });
  it('does not read a price as a phone number', () => {
    expect(get(run(trust({ text: 'Total 1,299.00 or 12345678' })), 'trust.contact')?.status).toBe('missing');
  });
  it('missing only when parsed', () => {
    expect(get(run(trust()), 'trust.contact')?.status).toBe('missing');
    expect(get(run(trust({ links: [] })), 'trust.contact')?.status).toBe('unverifiable');
  });
});

describe('footer details', () => {
  it('reads a company name from the copyright line', () => {
    expect(get(run(trust({ text: 'x '.repeat(300) + '© 2026 | Gymshark Limited | All Rights Reserved.' })), 'trust.company')?.status).toBe('detected');
    expect(get(run(trust({ text: 'x '.repeat(300) + 'All rights reserved. Limited time offer' })), 'trust.company')?.status).toBe('unverifiable');
  });
  it('knows more local currencies and finds payment brands named only in icon attributes', () => {
    expect(get(run(trust({ text: 'x '.repeat(300) + 'Only 250 EGP today' })), 'trust.price')?.status).toBe('detected');
    expect(get(run(trust({ text: 'x '.repeat(300) + 'list-payment__item payment-icon--visa pi-mastercard' })), 'trust.payment')?.evidence).toEqual(['visa', 'mastercard']);
  });
});

describe('price and payment', () => {
  it('detects price next to a currency, never says missing', () => {
    expect(get(run(trust({ text: 'Rs. 2,499' })), 'trust.price')?.status).toBe('detected');
    expect(get(run(trust({ text: 'AED 99' })), 'trust.price')?.status).toBe('detected');
    expect(get(run(trust({ text: 'only 49.99 USD' })), 'trust.price')?.status).toBe('detected');
    expect(get(run(trust({ text: 'cars 5 left' })), 'trust.price')?.status).toBe('unverifiable');
    expect(get(run(trust({ text: 'no price' })), 'trust.price')?.status).toBe('unverifiable');
  });
  it('lists payment names, unverifiable when none', () => {
    expect(get(run(trust({ text: 'Cash on Delivery  Visa Mastercard' })), 'trust.payment')?.evidence).toEqual(['visa', 'mastercard', 'cod']);
    expect(get(run(trust()), 'trust.payment')?.status).toBe('unverifiable');
  });
});

describe('after the site crawl', () => {
  const page = (kind: TrustPage['kind'], text: string, status = 200, url = `https://s.test/${kind}`): TrustPage => ({ kind, url, status, text });
  const WORDS = 'We take returns seriously and explain every step here. '.repeat(10);
  const crawled = (pages: TrustPage[], over: Partial<TrustCapture> = {}) => run({ ...trust(over), pages });
  const withPhases = (t: TrustCapture, reached: string[]) => {
    const o: Observation = { trust: t, platform: 'unknown', pixels: [], events: [], undecodedBeacons: 0, consentClicked: false, consentBannerSeen: false, phases: reached.map((phase) => ({ phase: phase as 'landing', reached: true, url: '' })) };
    return TRUST_RULES.flatMap((r) => r(o, {}));
  };

  it('a policy page that opens with real text is found, an empty one is minor, a 404 is missing', () => {
    const link = (t: string, h: string) => ({ text: t, href: h });
    const withLink = { links: [...FILLER, link('Refund policy', 'https://s.test/refund')] };
    expect(get(crawled([page('refund', WORDS)], withLink), 'trust.refund_policy')).toMatchObject({ status: 'detected', severity: 'info' });
    expect(get(crawled([page('refund', 'Coming soon.')], withLink), 'trust.refund_policy')).toMatchObject({ status: 'detected', severity: 'minor' });
    expect(get(crawled([page('refund', 'Not found', 404)], withLink), 'trust.refund_policy')).toMatchObject({ status: 'missing', severity: 'major' });
  });
  it('a page that blocked the scanner stays unverifiable', () => {
    const withLink = { links: [...FILLER, { text: 'Terms', href: 'https://s.test/terms' }] };
    expect(get(crawled([page('terms', 'Just a moment...', 200)], withLink), 'trust.terms')?.status).toBe('unverifiable');
    expect(get(crawled([page('terms', '', 403)], withLink), 'trust.terms')?.status).toBe('unverifiable');
    expect(get(crawled([page('terms', '', 0)], withLink), 'trust.terms')?.status).toBe('unverifiable');
  });
  it('a policy written inside the FAQ counts as minor, nothing anywhere is missing', () => {
    expect(get(crawled([page('faq', 'Our shipping policy: orders ship in 3-5 business days. '.repeat(3))]), 'trust.shipping')).toMatchObject({ status: 'detected', severity: 'minor' });
    expect(get(crawled([page('about', 'We love our customers. '.repeat(30))]), 'trust.shipping')).toMatchObject({ status: 'missing', severity: 'major' });
  });
  it('company details on an About page are found; missing once About/Contact/Terms were read', () => {
    expect(get(crawled([page('about', 'Acme Trading LLC, 12 Main Street, Dubai')]), 'trust.company')?.status).toBe('detected');
    expect(get(crawled([page('about', 'We love our customers. '.repeat(30))]), 'trust.company')).toMatchObject({ status: 'detected', evidence: ['About page'] });
    expect(get(crawled([page('about', 'Hi.')]), 'trust.company')).toMatchObject({ status: 'missing', severity: 'info' });
    expect(get(crawled([page('about', '', 403)]), 'trust.company')?.status).toBe('unverifiable');
  });
  it('contact details on the contact page count; none anywhere is missing', () => {
    expect(get(crawled([page('contact', 'Email us: help@shop.com')]), 'trust.contact')).toMatchObject({ status: 'detected', severity: 'info' });
    expect(get(crawled([page('contact', 'Fill the form below.')]), 'trust.contact')?.status).toBe('missing');
  });
  it('no price is missing only when a product page was reached; payment is a note, not a penalty', () => {
    const t = { ...trust({ text: 'Nice shoes' }), pages: [] as TrustPage[] };
    expect(get(withPhases(t, ['landing']), 'trust.price')?.status).toBe('unverifiable');
    expect(get(withPhases(t, ['landing', 'product']), 'trust.price')).toMatchObject({ status: 'missing', severity: 'minor' });
    expect(get(withPhases(t, ['landing', 'product']), 'trust.payment')).toMatchObject({ status: 'missing', severity: 'info' });
  });
  it('a price in any currency code counts', () => {
    expect(get(withPhases({ ...trust({ text: 'MYR 59.00' }), pages: [] }, ['landing', 'product']), 'trust.price')?.status).toBe('detected');
  });
});

describe('trust score', () => {
  const f = (id: string, status: Finding['status'], severity: Finding['severity'] = 'info'): Finding => ({ id, title: id, status, severity, evidence: [] });
  it('counts found as 1, indirect as 0.5, missing as 0 and ignores unverifiable', () => {
    const s = trustScore([f('trust.refund_policy', 'detected'), f('trust.terms', 'detected', 'minor'), f('trust.privacy', 'missing', 'major'), f('trust.shipping', 'unverifiable'), f('trust.payment', 'detected')]);
    expect(s).toEqual({ percent: 50, checked: 3, total: 4 });
  });
  it('is null when nothing could be checked', () => {
    expect(trustScore([f('trust.terms', 'unverifiable')])).toBeNull();
    expect(trustScore([])).toBeNull();
  });
});
