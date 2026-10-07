import { describe, expect, it } from 'vitest';
import { classify, pickTargets } from '../src/parsers/crawl';

const l = (text: string, href: string) => ({ text, href });

describe('classify', () => {
  it('names the page a link leads to by its text or its path', () => {
    expect(classify(l('Refund policy', 'https://s.test/x'))).toBe('refund');
    expect(classify(l('Shipping & Returns', 'https://s.test/x'))).toBe('shipping');
    expect(classify(l('Legal', 'https://s.test/policies/terms-of-service'))).toBe('terms');
    expect(classify(l('سياسة الخصوصية', 'https://s.test/x'))).toBe('privacy');
    expect(classify(l('Delivery', 'https://s.test/x'))).toBe('shipping');
    expect(classify(l('Policies', 'https://s.test/pages/policies'))).toBe('hub');
    expect(classify(l('Contact us', 'https://s.test/x'))).toBe('contact');
    expect(classify(l('About us', 'https://s.test/x'))).toBe('about');
    expect(classify(l('FAQ', 'https://s.test/x'))).toBe('faq');
    expect(classify(l('Contact Lenses', 'https://s.test/collections/contact-lenses'))).toBeUndefined();
    expect(classify(l('Terms Mug', 'https://s.test/products/terms-of-endearment'))).toBeUndefined();
    expect(classify(l('New arrivals', 'https://s.test/collections/new'))).toBeUndefined();
  });
});

describe('pickTargets', () => {
  const links = [l('Home', 'https://www.s.test/'), l('Refund policy', 'https://www.s.test/refund#top'), l('Returns', 'https://www.s.test/returns'), l('Help', 'https://help.s.test/faq'), l('Twitter', 'https://twitter.com/privacy'), l('Privacy', 'mailto:a@s.test'), l('Terms', 'https://www.s.test/terms.pdf'), l('About', 'https://www.s.test/about')];
  it('keeps one page per kind on the same site or a subdomain, drops the #hash, other sites, mail links and files', () => {
    expect(pickTargets(links, 'https://s.test/', 10)).toEqual([
      { kind: 'refund', url: 'https://www.s.test/refund' },
      { kind: 'faq', url: 'https://help.s.test/faq' },
      { kind: 'about', url: 'https://www.s.test/about' },
    ]);
  });
  it('respects the cap and the pages already opened', () => {
    expect(pickTargets(links, 'https://s.test/', 1)).toHaveLength(1);
    expect(pickTargets(links, 'https://s.test/', 10, new Set(['https://www.s.test/refund', 'https://www.s.test/returns'])).map((t) => t.kind)).toEqual(['faq', 'about']);
  });
});
