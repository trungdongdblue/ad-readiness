import type { Report } from '../domain/types';

export type Truth = 'yes' | 'no' | 'unknown';
export interface TruthRow {
  url: string;
  platform: string;
  pixel_id: string;
  view_content: Truth;
  add_to_cart: Truth;
  initiate_checkout: Truth;
}

export interface FieldStats { tp: number; fp: number; fn: number; tn: number; undecided: number; skipped: number }
export type Field = 'pixel' | 'viewContent' | 'addToCart' | 'initiateCheckout';
export interface CompareResult {
  stores: number;
  platformAccuracy: number | null;
  fields: Record<Field, FieldStats>;
}
export interface Criteria { [k: string]: { precision?: number; recall?: number; coverage?: number; accuracy?: number } }

export const empty = (): FieldStats => ({ tp: 0, fp: 0, fn: 0, tn: 0, undecided: 0, skipped: 0 });
const norm = (u: string): string => u.trim().toLowerCase().replace(/\/+$/, '');
export const normalizeUrl = norm;

function toTruth(v: string): Truth {
  const x = v.trim().toLowerCase();
  return x === 'yes' || x === 'no' ? x : 'unknown';
}
export function toTruthRow(r: Record<string, string>): TruthRow {
  return {
    url: r.url ?? '', platform: (r.platform ?? '').toLowerCase(), pixel_id: r.pixel_id ?? '',
    view_content: toTruth(r.view_content ?? ''), add_to_cart: toTruth(r.add_to_cart ?? ''), initiate_checkout: toTruth(r.initiate_checkout ?? ''),
  };
}

export function answer(report: Report, eventId: string): 'yes' | 'no' | 'undecided' {
  const f = report.findings.find((x) => x.id === eventId);
  if (!f || f.status === 'unverifiable') return 'undecided';
  return f.status === 'missing' ? 'no' : 'yes';
}

export function tally(s: FieldStats, truth: Truth, got: 'yes' | 'no' | 'undecided'): void {
  if (truth === 'unknown') { s.skipped += 1; return; }
  if (got === 'undecided') { s.undecided += 1; return; }
  if (truth === 'yes') got === 'yes' ? (s.tp += 1) : (s.fn += 1);
  else got === 'yes' ? (s.fp += 1) : (s.tn += 1);
}

export function compare(truth: TruthRow[], reports: Map<string, Report>): CompareResult {
  const fields: Record<Field, FieldStats> = { pixel: empty(), viewContent: empty(), addToCart: empty(), initiateCheckout: empty() };
  let platformOk = 0;
  let platformN = 0;
  let stores = 0;

  for (const t of truth) {
    const r = reports.get(norm(t.url));
    if (!r) continue;
    stores += 1;
    if (t.platform) { platformN += 1; if (r.platform === t.platform) platformOk += 1; }

    const wantsPixel = t.pixel_id !== '' && t.pixel_id.toLowerCase() !== 'none';
    const found = r.pixels.map((p) => p.toLowerCase());
    if (wantsPixel) {
      if (found.includes(t.pixel_id.toLowerCase())) fields.pixel.tp += 1;
      else { fields.pixel.fn += 1; if (found.length) fields.pixel.fp += 1; }
    } else if (t.pixel_id.toLowerCase() === 'none') {
      found.length ? (fields.pixel.fp += 1) : (fields.pixel.tn += 1);
    } else fields.pixel.skipped += 1;

    tally(fields.viewContent, t.view_content, answer(r, 'event.ViewContent'));
    tally(fields.addToCart, t.add_to_cart, answer(r, 'event.AddToCart'));
    tally(fields.initiateCheckout, t.initiate_checkout, answer(r, 'event.InitiateCheckout'));
  }
  return { stores, platformAccuracy: platformN ? platformOk / platformN : null, fields };
}

export function metrics(s: FieldStats): { precision: number | null; recall: number | null; coverage: number | null } {
  const decided = s.tp + s.fp + s.fn + s.tn;
  const known = decided + s.undecided;
  return {
    precision: s.tp + s.fp ? s.tp / (s.tp + s.fp) : null,
    recall: s.tp + s.fn ? s.tp / (s.tp + s.fn) : null,
    coverage: known ? decided / known : null,
  };
}

export function verdict(res: Pick<CompareResult, 'platformAccuracy'> & { fields: Record<string, FieldStats> }, criteria: Criteria): { field: string; pass: boolean; detail: string }[] {
  const out: { field: string; pass: boolean; detail: string }[] = [];
  for (const [field, want] of Object.entries(criteria)) {
    if (field === 'platform') {
      const acc = res.platformAccuracy;
      out.push({ field, pass: acc !== null && acc >= (want.accuracy ?? 0), detail: `accuracy ${fmt(acc)} (need ${fmt(want.accuracy ?? null)})` });
      continue;
    }
    const stats = res.fields[field];
    if (!stats) continue;
    const m = metrics(stats);
    const checks = (['precision', 'recall', 'coverage'] as const).filter((k) => want[k] !== undefined);
    const pass = checks.every((k) => m[k] !== null && (m[k] as number) >= (want[k] as number));
    out.push({ field, pass, detail: checks.map((k) => `${k} ${fmt(m[k])} (need ${fmt(want[k] ?? null)})`).join(', ') });
  }
  return out;
}

const fmt = (n: number | null): string => (n === null ? 'n/a' : `${Math.round(n * 100)}%`);
