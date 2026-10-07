import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runScan } from '../src/app/scan-service';
import { ScanSession } from '../src/collectors/browser-session';
import { analyze } from '../src/engine/analyze';
import { PIXEL_ID, STUB_EVENTS_JS, startFixtureServer, type Sizes } from './fixtures/site';

const canLaunch = await chromium.launch().then((b) => b.close().then(() => true), () => false);

/**
 * Harness test: proves capture-and-block, the ttq hook and the funnel steps work.
 * The beacon wire format is a stub (ASSUMED) - real-world accuracy is measured by the PoC, not here.
 */
describe.skipIf(!canLaunch)('scan pipeline (local fixture + stubbed events.js)', () => {
  let withPixel: Awaited<ReturnType<typeof startFixtureServer>>;
  let withoutPixel: Awaited<ReturnType<typeof startFixtureServer>>;
  beforeAll(async () => { withPixel = await startFixtureServer({ pixel: true }); withoutPixel = await startFixtureServer({ pixel: false }); });
  afterAll(async () => { await withPixel.close(); await withoutPixel.close(); });

  const scan = async (url: string, market?: string) => {
    const session = await ScanSession.open({
      headless: true, allowLiveEvents: false,
      setup: async (ctx) => {
        await ctx.route('**/i18n/pixel/events.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: STUB_EVENTS_JS }));
      },
    });
    try {
      const capture = await runScan(session, url, { url, allowPrivate: true });
      return { capture, report: analyze(capture, { market }) };
    } finally { await session.close(); }
  };

  it('detects pixel id, ViewContent and AddToCart on the wire and flags IQD', async () => {
    const { report, capture } = await scan(withPixel.url, 'IQ');
    const status = (id: string) => report.findings.find((x) => x.id === id)?.status;
    expect(report.pixels).toEqual([PIXEL_ID]);
    expect(status('pixel.present')).toBe('verified');
    expect(status('event.ViewContent')).toBe('verified');
    expect(status('event.AddToCart')).toBe('verified');
    expect(status('event.InitiateCheckout')).toBe('verified');
    expect(status('event.Purchase')).toBe('unverifiable');
    expect(report.findings.find((x) => x.id === 'mobile.checkout')?.title).toContain('2 visible fields');
    expect(status('mobile.buy_button')).toBe('detected');
    expect(status('mobile.speed')).toBe('unverifiable'); // perf is measured by scanTarget, not runScan
    expect(report.findings.find((x) => x.id === 'params.currency_supported')?.evidence).toEqual(['IQD']);
    expect(capture.requests.filter((r) => !/events\.js/.test(r.url)).every((r) => r.blocked)).toBe(true);
    expect(report.phases.map((p) => p.reached)).toEqual([true, true, true, true]);
    // Hook sees page-level ttq.track calls (but not load()/page() made inside the base-code IIFE).
    expect(capture.ttqCalls.some((c) => c.method === 'track' && c.args[0] === 'ViewContent')).toBe(true);
  });

  it('reports a store without pixel as blocker', async () => {
    const { report } = await scan(withoutPixel.url);
    expect(report.findings.find((x) => x.id === 'pixel.present')).toMatchObject({ status: 'missing', severity: 'blocker' });
    // One root cause, one blocker: events are not also reported missing when there is no Pixel at all.
    expect(report.findings.find((x) => x.id === 'event.AddToCart')?.status).toBe('unverifiable');
    expect(report.findings.filter((x) => x.severity === 'blocker')).toHaveLength(1);
  });
});

describe.skipIf(!canLaunch)('add to cart when the store insists on a size', () => {
  const servers: Awaited<ReturnType<typeof startFixtureServer>>[] = [];
  afterAll(async () => { await Promise.all(servers.map((s) => s.close())); });

  const scan = async (sizes: Sizes) => {
    const server = await startFixtureServer({ pixel: true, sizes });
    servers.push(server);
    const session = await ScanSession.open({
      headless: true, allowLiveEvents: false,
      setup: async (ctx) => { await ctx.route('**/i18n/pixel/events.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: STUB_EVENTS_JS })); },
    });
    try {
      const capture = await runScan(session, server.url, { url: server.url, allowPrivate: true, llm: false });
      return { report: analyze(capture, {}), capture };
    } finally { await session.close(); }
  };

  it.each([['radio', '"S"'], ['select', '"M"'], ['buttons', '"S"'], ['struck', '"M"']] as const)('chooses an available %s option itself and then checks the event', async (sizes, picked) => {
    const { report, capture } = await scan(sizes);
    const atc = report.findings.find((x) => x.id === 'event.AddToCart');
    expect(atc?.status).toBe('verified');
    expect(atc?.evidence.join(' ')).toContain(picked); // the report says which option was chosen for the check
    expect(capture.phases.find((p) => p.phase === 'checkout')?.reached).toBe(true);
  });

  it('never calls it missing when every size is sold out: not checked, with the reason', async () => {
    const { report } = await scan('soldout');
    const atc = report.findings.find((x) => x.id === 'event.AddToCart');
    expect(atc).toMatchObject({ status: 'unverifiable', severity: 'info' });
    expect(atc?.evidence.join(' ')).toContain('sold out or disabled');
  });
});
