import type { FieldMetrics } from '../domain/types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** p75 may arrive as a number (ms) or a string (CLS, e.g. "0.05"). */
function p75(metrics: Obj, key: string): number | undefined {
  const m = metrics[key];
  const v = isObj(m) && isObj(m.percentiles) ? m.percentiles.p75 : undefined;
  const n = typeof v === 'number' || (typeof v === 'string' && v !== '') ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/**
 * CrUX API `queryRecord` response -> p75 values. Pure.
 * Field names and p75 shapes confirmed against live responses (asimjofa.com, 2026-10-05).
 * Returns undefined when no metric is present, so "no data" is never mistaken for "fast".
 */
export function parseCruxRecord(body: unknown): Omit<FieldMetrics, 'level'> | undefined {
  const metrics = isObj(body) && isObj(body.record) && isObj(body.record.metrics) ? body.record.metrics : undefined;
  if (!metrics) return undefined;
  const out = {
    lcpMs: p75(metrics, 'largest_contentful_paint'),
    inpMs: p75(metrics, 'interaction_to_next_paint'),
    cls: p75(metrics, 'cumulative_layout_shift'),
    fcpMs: p75(metrics, 'first_contentful_paint'),
    ttfbMs: p75(metrics, 'experimental_time_to_first_byte'),
  };
  return Object.values(out).some((v) => v !== undefined) ? out : undefined;
}
