import { describe, expect, it } from 'vitest';
import type { Report } from '../src/domain/types';
import { compare, metrics, toTruthRow, verdict } from '../src/poc/compare';
import { parseCsv } from '../src/poc/csv';

const report = (target: string, over: Partial<Report> = {}): Report => ({
  version: 1, target, finalUrl: target, platform: 'shopify', pixels: ['CPIX'], events: [], undecodedBeacons: 0, consentBannerSeen: false, consentClicked: false, findings: [], phases: [], errors: [], durationMs: 1, ...over,
});
const f = (id: string, status: 'verified' | 'missing' | 'unverifiable' | 'detected') => ({ id, title: id, status, severity: 'info' as const, evidence: [] });

describe('parseCsv', () => {
  it('handles quotes, commas and CRLF', () => {
    expect(parseCsv('url,notes\r\nhttps://a.com,"x, y"\r\nhttps://b.com,"say ""hi"""\r\n')).toEqual([
      { url: 'https://a.com', notes: 'x, y' }, { url: 'https://b.com', notes: 'say "hi"' },
    ]);
  });
});

describe('compare', () => {
  const truth = parseCsv('url,platform,pixel_id,view_content,add_to_cart,initiate_checkout\nhttps://a.com/,shopify,CPIX,yes,yes,unknown\nhttps://b.com,woocommerce,none,no,no,no\nhttps://c.com,shopify,CMISS,yes,no,unknown').map(toTruthRow);
  const reports = new Map<string, Report>([
    ['https://a.com', report('https://a.com', { findings: [f('event.ViewContent', 'verified'), f('event.AddToCart', 'unverifiable')] })],
    ['https://b.com', report('https://b.com', { platform: 'unknown', pixels: [], findings: [f('event.ViewContent', 'missing'), f('event.AddToCart', 'missing')] })],
    ['https://c.com', report('https://c.com', { pixels: [], findings: [f('event.ViewContent', 'missing'), f('event.AddToCart', 'missing')] })],
  ]);
  const res = compare(truth, reports);

  it('tallies pixel and event fields', () => {
    expect(res.stores).toBe(3);
    expect(res.fields.pixel).toMatchObject({ tp: 1, fn: 1, tn: 1, fp: 0 });
    expect(res.fields.viewContent).toMatchObject({ tp: 1, tn: 1, fn: 1 });
    expect(res.fields.addToCart).toMatchObject({ tn: 2, undecided: 1 });
  });
  it('computes metrics and platform accuracy', () => {
    expect(metrics(res.fields.pixel)).toMatchObject({ precision: 1, recall: 0.5 });
    expect(res.platformAccuracy).toBeCloseTo(2 / 3);
  });
  it('produces pass/fail verdicts', () => {
    const v = verdict(res, { pixel: { recall: 0.9 }, platform: { accuracy: 0.5 } });
    expect(v.find((x) => x.field === 'pixel')?.pass).toBe(false);
    expect(v.find((x) => x.field === 'platform')?.pass).toBe(true);
  });
});
