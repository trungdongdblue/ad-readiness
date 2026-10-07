import { describe, expect, it } from 'vitest';
import type { EventHit, Finding, Observation, PhaseResult } from '../src/domain/types';
import { MOBILE_RULES } from '../src/rules/mobile';
import { TRACKING_RULES } from '../src/rules/tracking';

const ph = (phase: PhaseResult['phase'], reached = true): PhaseResult => ({ phase, reached, url: 'x' });
const ev = (name: string, over: Partial<EventHit> = {}): EventHit => ({ name, rawName: name, params: {}, source: 'network', phase: 'product', ...over });
const obs = (over: Partial<Observation> = {}): Observation => ({
  platform: 'unknown', pixels: [{ id: 'PIX1234567890', source: 'network', phase: 'landing' }], events: [], undecodedBeacons: 0,
  consentClicked: false, consentBannerSeen: false, phases: [ph('landing'), ph('product'), ph('add-to-cart')], ...over,
});
const run = (o: Observation, market?: string): Finding[] => TRACKING_RULES.flatMap((r) => r(o, { market }));
const get = (fs: Finding[], id: string): Finding | undefined => fs.find((f) => f.id === id);

describe('speed metrics', () => {
  it('real-user speed carries each number with its own good/poor limits for the UI', () => {
    const f = MOBILE_RULES.flatMap((r) => r(obs({ mobile: { field: { level: 'url', lcpMs: 3400, inpMs: 150, cls: 0.3 } } }), {})).find((x) => x.id === 'mobile.speed');
    expect(f?.metrics).toEqual([
      { key: 'lcp', value: 3400, unit: 'ms', good: 2500, poor: 4000, grade: 'needs' },
      { key: 'inp', value: 150, unit: 'ms', good: 200, poor: 500, grade: 'good' },
      { key: 'cls', value: 0.3, unit: '', good: 0.1, poor: 0.25, grade: 'poor' },
    ]);
  });
});

describe('more than one Pixel', () => {
  const two = [{ id: 'PIXAAAAAAAAAA', source: 'network' as const, phase: 'landing' as const }, { id: 'PIXBBBBBBBBBB', source: 'network' as const, phase: 'landing' as const }];
  it('is a note without a penalty: both IDs listed, severity info', () => {
    expect(get(run(obs({ pixels: two })), 'pixel.multiple')).toMatchObject({ status: 'detected', severity: 'info', evidence: ['PIXAAAAAAAAAA', 'PIXBBBBBBBBBB'] });
    expect(get(run(obs()), 'pixel.multiple')).toBeUndefined();
  });
  it('two Pixels each firing the event once is not a duplicate; one Pixel firing it twice still is', () => {
    const each = [ev('ViewContent', { pixelId: 'PIXAAAAAAAAAA', eventId: 'a' }), ev('ViewContent', { pixelId: 'PIXBBBBBBBBBB', eventId: 'b' })];
    expect(get(run(obs({ pixels: two, events: each })), 'event.duplicate')).toBeUndefined();
    const twice = [ev('ViewContent', { pixelId: 'PIXAAAAAAAAAA', eventId: 'a' }), ev('ViewContent', { pixelId: 'PIXAAAAAAAAAA', eventId: 'b' })];
    expect(get(run(obs({ pixels: two, events: twice })), 'event.duplicate')).toBeDefined();
  });
});

describe('events without a Pixel', () => {
  it('are not judged: the missing Pixel is the single finding, whatever the funnel reached', () => {
    const f = run(obs({ pixels: [], phases: [ph('landing'), ph('product'), ph('add-to-cart'), ph('checkout')] }));
    for (const id of ['event.ViewContent', 'event.AddToCart', 'event.InitiateCheckout']) expect(get(f, id)?.status).toBe('unverifiable');
  });
  it('are still judged when a Pixel exists', () => {
    expect(get(run(obs()), 'event.ViewContent')?.status).toBe('missing');
  });
});

describe('pixel rules', () => {
  it('never says "no Pixel" about a page that did not load as a store (bot wall, country picker, empty shell)', () => {
    const wall = { links: [], text: 'Select your country' };
    expect(get(run(obs({ pixels: [], trust: wall })), 'pixel.present')).toMatchObject({ status: 'unverifiable', severity: 'info' });
    const store = { links: [], text: 'Welcome to our store. '.repeat(40) };
    expect(get(run(obs({ pixels: [], trust: store })), 'pixel.present')).toMatchObject({ status: 'missing', severity: 'blocker' });
  });
  it('flags a missing pixel as blocker', () => {
    const f = get(run(obs({ pixels: [] })), 'pixel.present');
    expect(f).toMatchObject({ status: 'missing', severity: 'blocker' });
  });
  it('is verified only with network evidence', () => {
    expect(get(run(obs()), 'pixel.present')?.status).toBe('verified');
    expect(get(run(obs({ pixels: [{ id: 'P', source: 'static', phase: 'landing' }] })), 'pixel.present')?.status).toBe('detected');
  });
  it('reports a loaded but silent pixel', () => {
    expect(get(run(obs()), 'pixel.silent')?.status).toBe('detected');
    expect(get(run(obs({ events: [ev('PageView')] })), 'pixel.silent')).toBeUndefined();
  });
});

describe('event coverage', () => {
  it('verified on the wire, detected for hook only, missing when phase reached', () => {
    const f = run(obs({ events: [ev('ViewContent'), ev('AddToCart', { source: 'ttq-hook' })] }));
    expect(get(f, 'event.ViewContent')?.status).toBe('verified');
    expect(get(f, 'event.AddToCart')?.status).toBe('detected');
    expect(get(f, 'event.InitiateCheckout')?.status).toBe('unverifiable');
  });
  it('says missing only if the phase was reached, otherwise unverifiable', () => {
    expect(get(run(obs()), 'event.ViewContent')?.status).toBe('missing');
    expect(get(run(obs({ phases: [ph('landing'), ph('product', false)] })), 'event.ViewContent')?.status).toBe('unverifiable');
  });
  it('treats CompletePayment as Purchase and never verifies purchase from outside', () => {
    expect(get(run(obs()), 'event.Purchase')?.status).toBe('unverifiable');
  });
});

describe('parameter rules', () => {
  it('flags IQD with a market-specific fix', () => {
    const f = get(run(obs({ events: [ev('AddToCart', { source: 'ttq-hook', params: { value: 10, currency: 'IQD', content_ids: ['1'] } })] }), 'IQ'), 'params.currency_supported');
    expect(f?.evidence).toEqual(['IQD']);
    expect(f?.fix).toContain('IQD');
  });
  it('accepts PKR and AED', () => {
    const f = run(obs({ events: [ev('AddToCart', { source: 'ttq-hook', params: { value: 10, currency: 'PKR', content_ids: ['1'] } })] }));
    expect(get(f, 'params.currency_supported')).toBeUndefined();
  });
  it('flags bad value formats and unpaired value/currency', () => {
    const f = run(obs({ events: [ev('ViewContent', { source: 'ttq-hook', params: { value: '$12,5', content_ids: ['1'] } })] }));
    expect(get(f, 'params.value')).toBeDefined();
    expect(get(f, 'params.value_currency_pair')).toBeDefined();
  });
  it('does not accuse when network params decoded empty (unknown, not missing)', () => {
    const f = run(obs({ events: [ev('AddToCart', { params: {} })] }));
    expect(f.filter((x) => x.id.startsWith('params.'))).toEqual([]);
  });
});

describe('quality rules', () => {
  it('reports aliases and unknown names', () => {
    const f = run(obs({ events: [ev('Purchase', { rawName: 'CompletePayment' }), ev('LeaveReview', { rawName: 'LeaveReview' })] }));
    expect(get(f, 'event.alias')?.evidence).toEqual(['CompletePayment -> Purchase']);
    expect(get(f, 'event.unknown_name')?.evidence).toEqual(['LeaveReview']);
  });
  it('detects repeated events without distinct event_id', () => {
    const f = run(obs({ events: [ev('AddToCart'), ev('AddToCart')] }));
    expect(get(f, 'event.duplicate')).toBeDefined();
    expect(get(run(obs({ events: [ev('AddToCart', { eventId: 'a' }), ev('AddToCart', { eventId: 'a' })] })), 'event.duplicate')).toBeUndefined();
  });
  it('cannot verify Events API', () => {
    expect(get(run(obs()), 'serverside.events_api')?.status).toBe('unverifiable');
  });
});

describe('consent handling and internal events', () => {
  it('does not declare a pixel missing behind an unaccepted cookie banner', () => {
    const f = get(run(obs({ pixels: [], consentBannerSeen: true, consentClicked: false })), 'pixel.present');
    expect(f).toMatchObject({ status: 'unverifiable' });
    expect(get(run(obs({ pixels: [], consentBannerSeen: true, consentClicked: true })), 'pixel.present')?.status).toBe('missing');
  });
  it('does not flag pixel-internal events as unknown', () => {
    const f = run(obs({ events: [ev('LandingPageView', { rawName: 'LandingPageView' })] }));
    expect(get(f, 'event.unknown_name')).toBeUndefined();
  });
});

describe('mobile rules', () => {
  const runM = (o: Observation): Finding[] => MOBILE_RULES.flatMap((r) => r(o, {}));
  const btn = { label: 'Add to cart', widthPx: 300, heightPx: 48, inFirstScreen: true, contrast: 7 };

  it('is unverifiable when nothing was measured', () => {
    const f = runM(obs({ phases: [ph('landing'), ph('product', false)] }));
    expect(['mobile.speed', 'mobile.buy_button', 'mobile.checkout'].map((id) => get(f, id)?.status)).toEqual(['unverifiable', 'unverifiable', 'unverifiable']);
  });
  it('shows lab load numbers but never grades them', () => {
    const f = get(runM(obs({ mobile: { perf: { lcpMs: 12700, tbtMs: 900, cls: 0, runs: 3 } } })), 'mobile.speed');
    expect(f).toMatchObject({ status: 'detected', severity: 'info' });
    expect(f?.title).toContain('LCP 12.7s');
    expect(f?.title).toContain('TBT 900ms');
  });
  it('grades real-user data by the worst of LCP, INP and CLS, and says when it is domain-level', () => {
    const f = (field: object, note?: string) => get(runM(obs({ mobile: { field: { level: 'url', ...field }, fieldNote: note } })), 'mobile.speed');
    expect(f({ lcpMs: 2000, inpMs: 150, cls: 0.05 })?.severity).toBe('info');
    expect(f({ lcpMs: 3000, inpMs: 150, cls: 0 })?.severity).toBe('minor');
    expect(f({ lcpMs: 3000, inpMs: 600, cls: 0 })?.severity).toBe('major');
    expect(f({ lcpMs: 3000, cls: 0 })?.severity).toBe('minor'); // INP missing: grade what exists
    expect(f({ level: 'origin', lcpMs: 2000 })?.evidence.join()).toContain('domain-level');
  });
  it('without real-user data keeps lab numbers ungraded and explains why', () => {
    const f = get(runM(obs({ mobile: { perf: { lcpMs: 12000, runs: 3 }, fieldNote: 'no real-user data on Google for this page or its domain' } })), 'mobile.speed');
    expect(f?.severity).toBe('info');
    expect(f?.evidence.join()).toContain('no real-user data');
  });
  it('flags a small, low-contrast or below-the-fold buy button', () => {
    const f = (b: object) => get(runM(obs({ mobile: { buyButton: { ...btn, ...b } } })), 'mobile.buy_button');
    expect(f({})?.severity).toBe('info');
    expect(f({ inFirstScreen: false })?.severity).toBe('minor');
    expect(f({ heightPx: 30 })?.title).toContain('tap target');
    expect(f({ contrast: 1.5 })?.title).toContain('contrast');
    expect(f({ contrast: undefined })?.severity).toBe('info');
  });
  it('reports checkout counts without judging them', () => {
    const f = get(runM(obs({ phases: [ph('checkout')], mobile: { checkout: { fields: 9, breadcrumbSteps: 3 } } })), 'mobile.checkout');
    expect(f).toMatchObject({ status: 'detected', severity: 'info' });
    expect(f?.title).toContain('9 visible fields');
  });
});
