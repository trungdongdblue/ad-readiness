import { describe, expect, it } from 'vitest';
import { fetchCrux } from '../src/collectors/crux';
import { parseCruxRecord } from '../src/parsers/crux';

// Shape confirmed against live responses (2026-10-05). No data = 404 NOT_FOUND "chrome ux report data not found".
const record = (metrics: object) => ({ record: { metrics } });
const full = record({
  largest_contentful_paint: { percentiles: { p75: 3000 } },
  interaction_to_next_paint: { percentiles: { p75: 409 } },
  cumulative_layout_shift: { percentiles: { p75: '0.05' } },
  first_contentful_paint: { percentiles: { p75: 2100 } },
});

/** Fake fetch: answers each call from the queue and records request bodies. */
function fakeFetch(...answers: (number | { status: number; body: unknown } | Error)[]) {
  const sent: { url?: string; origin?: string }[] = [];
  const impl = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string));
    const a = answers.shift();
    if (a instanceof Error) throw a;
    const { status, body } = typeof a === 'number' || a === undefined ? { status: a ?? 404, body: {} } : a;
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, sent };
}

describe('parseCruxRecord', () => {
  it('reads p75 values, including string CLS', () => {
    expect(parseCruxRecord(full)).toMatchObject({ lcpMs: 3000, inpMs: 409, cls: 0.05, fcpMs: 2100 });
  });
  it('keeps partial metrics (INP missing) and never turns "no metrics" into zeros', () => {
    expect(parseCruxRecord(record({ largest_contentful_paint: { percentiles: { p75: 2000 } } }))?.inpMs).toBeUndefined();
    expect(parseCruxRecord(record({}))).toBeUndefined();
    expect(parseCruxRecord({ error: 'x' })).toBeUndefined();
  });
});

describe('fetchCrux fallbacks', () => {
  it('uses page-level data when Google has it', async () => {
    const f = fakeFetch({ status: 200, body: full });
    expect((await fetchCrux('https://a.com/p', 'k', f.impl)).field).toMatchObject({ level: 'url', lcpMs: 3000 });
    expect(f.sent).toEqual([{ url: 'https://a.com/p', formFactor: 'PHONE' }]);
  });
  it('falls back to the whole domain when the page has no data', async () => {
    const f = fakeFetch(404, { status: 200, body: full });
    expect((await fetchCrux('https://a.com/p', 'k', f.impl)).field?.level).toBe('origin');
    expect(f.sent[1]).toMatchObject({ origin: 'https://a.com' });
  });
  it('reports no data when neither page nor domain is known', async () => {
    const r = await fetchCrux('https://a.com/', 'k', fakeFetch(404, 404).impl);
    expect(r.field).toBeUndefined();
    expect(r.note).toContain('no real-user data');
  });
  it('does not throw on API errors or network failure, and never leaks the key', async () => {
    const denied = await fetchCrux('https://a.com/', 'SECRET', fakeFetch(403).impl);
    expect(denied.note).toBe('CrUX API error 403');
    const down = await fetchCrux('https://a.com/', 'SECRET', fakeFetch(new Error('boom SECRET')).impl);
    expect(down.note).toContain('failed');
    expect(`${denied.note}${down.note}`).not.toContain('SECRET');
  });
});
