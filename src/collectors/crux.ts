import type { FieldMetrics } from '../domain/types';
import { parseCruxRecord } from '../parsers/crux';

const ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

export interface CruxResult {
  field?: FieldMetrics;
  /** Why there is no `field`. Never contains the API key. */
  note?: string;
}

async function query(target: { url: string } | { origin: string }, key: string, doFetch: typeof fetch): Promise<{ status: number; body?: unknown }> {
  const res = await doFetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...target, formFactor: 'PHONE' }),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: res.status, body: res.ok ? await res.json().catch(() => undefined) : undefined };
}

/**
 * Real-user numbers for the page, else for the whole domain, else a reason. Never throws.
 * 404 = Google has no data (small or new site). ponytail: a 429 is reported, not retried; add backoff if a batch hits it.
 */
export async function fetchCrux(pageUrl: string, key: string, doFetch: typeof fetch = fetch): Promise<CruxResult> {
  try {
    const targets = [['url', { url: pageUrl }], ['origin', { origin: new URL(pageUrl).origin }]] as const;
    for (const [level, target] of targets) {
      const { status, body } = await query(target, key, doFetch);
      if (status === 404) continue;
      if (status !== 200) return { note: `CrUX API error ${status}` };
      const metrics = parseCruxRecord(body);
      if (metrics) return { field: { level, ...metrics } };
    }
    return { note: 'no real-user data on Google for this page or its domain' };
  } catch {
    return { note: 'CrUX request failed (network or timeout)' };
  }
}
