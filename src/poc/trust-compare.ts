import type { Report } from '../domain/types';
import { answer, empty, normalizeUrl, tally, type FieldStats, type Truth } from './compare';

/** ground-truth column -> finding id. Columns hold yes / no / unknown, like the tracking ground truth. */
export const TRUST_FIELDS: Record<string, string> = {
  refund_policy: 'trust.refund_policy', terms: 'trust.terms', privacy: 'trust.privacy',
  shipping: 'trust.shipping', contact: 'trust.contact', company: 'trust.company',
};

export interface TrustResult { stores: number; platformAccuracy: null; fields: Record<string, FieldStats> }
export interface Mismatch { url: string; field: string; truth: Truth; got: 'yes' | 'no' }

const toTruth = (v: string | undefined): Truth => {
  const x = (v ?? '').trim().toLowerCase();
  return x === 'yes' || x === 'no' ? x : 'unknown';
};

/**
 * yes = page shows it (finding detected), no = missing. A truth "yes" answered "no" is a false accusation: the
 * number that matters most (recall). Mismatches are listed so wrong regexes can be fixed by eye.
 */
export function compareTrust(rows: Record<string, string>[], reports: Map<string, Report>): { result: TrustResult; mismatches: Mismatch[] } {
  const fields = Object.fromEntries(Object.keys(TRUST_FIELDS).map((k) => [k, empty()]));
  const mismatches: Mismatch[] = [];
  let stores = 0;
  for (const row of rows) {
    const r = reports.get(normalizeUrl(row.url ?? ''));
    if (!r) continue;
    stores += 1;
    for (const [col, id] of Object.entries(TRUST_FIELDS)) {
      const truth = toTruth(row[col]);
      const got = answer(r, id);
      tally(fields[col]!, truth, got);
      if (truth !== 'unknown' && got !== 'undecided' && truth !== got) mismatches.push({ url: r.target, field: col, truth, got });
    }
  }
  return { result: { stores, platformAccuracy: null, fields }, mismatches };
}
