import { describe, expect, it } from 'vitest';
import { normalizeEventName } from '../src/parsers/tiktok/events';
import { isPixelBeacon, isPixelScript, pixelIdFromScriptUrl } from '../src/parsers/tiktok/hosts';
import { decodeBeacon } from '../src/parsers/tiktok/payload';
import { pixelIdsFromHtml } from '../src/parsers/tiktok/static';
import { detectPlatform } from '../src/parsers/platform';
import { contrastRatio } from '../src/parsers/contrast';

describe('contrastRatio', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBeCloseTo(21, 0);
    expect(contrastRatio('rgb(255, 255, 255)', 'rgb(255, 255, 255)')).toBeCloseTo(1, 5);
    expect(contrastRatio('rgb(119, 119, 119)', 'rgba(255, 255, 255, 1)')).toBeCloseTo(4.48, 1);
  });
  it('returns undefined for colours it cannot parse', () => {
    expect(contrastRatio('transparent', 'rgb(0, 0, 0)')).toBeUndefined();
  });
});

describe('normalizeEventName', () => {
  it('maps reserved aliases to standard events', () => {
    expect(normalizeEventName('CompletePayment')).toMatchObject({ name: 'Purchase', known: true, aliasOf: 'CompletePayment' });
    expect(normalizeEventName('StartCheckout').name).toBe('InitiateCheckout');
    expect(normalizeEventName('Browse').name).toBe('PageView');
  });
  it('is case-insensitive and flags unknown names', () => {
    expect(normalizeEventName('addtocart')).toMatchObject({ name: 'AddToCart', known: true });
    expect(normalizeEventName('Pageview').name).toBe('PageView');
    expect(normalizeEventName('LeaveReview')).toMatchObject({ name: 'LeaveReview', known: false });
  });
});

describe('hosts', () => {
  const script = 'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CABC123456789012345&lib=ttq';
  it('classifies script vs beacon', () => {
    expect(isPixelScript(script)).toBe(true);
    expect(isPixelBeacon(script)).toBe(false);
    expect(isPixelBeacon('https://analytics.tiktok.com/api/v2/pixel')).toBe(true);
    expect(isPixelBeacon('https://example.com/api/v2/pixel')).toBe(false);
  });
  it('reads the pixel id from the script url', () => {
    expect(pixelIdFromScriptUrl(script)).toBe('CABC123456789012345');
  });
});

describe('decodeBeacon', () => {
  it('decodes the legacy single-event shape', () => {
    const body = JSON.stringify({ event: 'ViewContent', context: { pixel: { code: 'BT24M8TQUU2IQ2BVG9NG' }, page: { url: 'https://x.com' } }, properties: { value: 5, currency: 'USD' } });
    expect(decodeBeacon('https://analytics.tiktok.com/api/v1/track', body)).toEqual([{ name: 'ViewContent', pixelId: 'BT24M8TQUU2IQ2BVG9NG', eventId: undefined, params: { value: 5, currency: 'USD' } }]);
  });
  it('decodes batches and carries the pixel code down', () => {
    const body = JSON.stringify({ pixel_code: 'PIX1234567890', batch: [{ type: 'track', event: 'AddToCart', event_id: 'a1' }, { type: 'track', event: 'Pageview' }] });
    const out = decodeBeacon('https://analytics.tiktok.com/api/v2/pixel/batch', body);
    expect(out.map((e) => e.name)).toEqual(['AddToCart', 'Pageview']);
    expect(out[0]).toMatchObject({ pixelId: 'PIX1234567890', eventId: 'a1' });
  });
  it('falls back to the query string and never throws on garbage', () => {
    expect(decodeBeacon('https://mon.tiktok.com/x?event=AddToCart&sdkid=ABC', null)[0]).toMatchObject({ name: 'AddToCart', pixelId: 'ABC' });
    expect(decodeBeacon('https://analytics.tiktok.com/x', '\u0000\u0001not-json')).toEqual([]);
    expect(decodeBeacon('not a url', '{}')).toEqual([]);
  });
});

describe('static + platform', () => {
  it('finds pixel ids in base code and script urls', () => {
    const html = `<script>ttq.load('CABC123456789012345');</script><script src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CXYZ123456789012345&lib=ttq"></script>`;
    expect(pixelIdsFromHtml(html).sort()).toEqual(['CABC123456789012345', 'CXYZ123456789012345']);
  });
  it('detects platforms', () => {
    expect(detectPlatform('<script src="https://cdn.shopify.com/s/x.js">')).toBe('shopify');
    expect(detectPlatform('<link href="/wp-content/plugins/woocommerce/a.css">')).toBe('woocommerce');
    expect(detectPlatform('<html></html>')).toBe('unknown');
  });
});

describe('real-world shapes (recon 2026-10-01)', () => {
  it('decodes GET beacons carrying base64 analytics_message', () => {
    const msg = Buffer.from(JSON.stringify({ event: 'Pageview', event_id: 'UGFnZVZpZXc=-x', context: { pixel: { code: 'CABC123456789012345' } }, properties: {} })).toString('base64');
    const out = decodeBeacon(`https://analytics.tiktok.com/api/v2/pixel?analytics_message=${encodeURIComponent(msg)}`, null);
    expect(out).toMatchObject([{ name: 'Pageview', pixelId: 'CABC123456789012345', eventId: 'UGFnZVZpZXc=-x' }]);
  });
  it('reads params from properties and the pixel code from context.pixel', () => {
    const body = JSON.stringify({ event: 'ViewContent', event_id: 'e', context: { pixel: { code: 'CABC123456789012345', runtime: '1' } }, properties: { value: 10, currency: 'USD', content_type: 'product', content_id: '65' } });
    expect(decodeBeacon('https://analytics.tiktok.com/api/v2/pixel', body)[0]).toMatchObject({ pixelId: 'CABC123456789012345', params: { value: 10, currency: 'USD', content_id: '65' } });
  });
  it('treats pixel-internal events as known', () => {
    expect(normalizeEventName('LandingPageView')).toMatchObject({ known: true, internal: true });
    expect(normalizeEventName('EngagedSession')).toMatchObject({ known: true, internal: true });
  });
});
