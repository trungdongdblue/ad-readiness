import { ADVICE_MAX_STEPS } from '../config/advice';
import type { Effort } from '../domain/api';
import type { Finding } from '../domain/types';

/** Pure helpers around the fix-plan call: send as little as possible, accept only what is safe to show. */

const EFFORTS: readonly Effort[] = ['minutes', 'hour', 'developer'];
const MAX_STEP = 320;
const MAX_NOTE = 320;
const MAX_COPY = 300;
const MAX_EVIDENCE = 3;
const MAX_FIELD = 200;
/** Page text reaches the model through the evidence, so a link or a promise about TikTok's decision never passes through. */
const UNSAFE = /https?:\/\/|www\.|(will|would|going to) (be )?(reject|approve|ban|disapprove|accept)|guarantee[sd]? (approval|results?)/i;

const clean = (s: string, max: number): string => s.replace(/[\r\n|<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** One compact line per fix: the number is the only key the model must echo back. */
export function adviceText(fixes: readonly Finding[], ctx: { platform: string; market?: string }): string {
  const lines = fixes.map((f, i) => [i + 1, f.id, f.severity, clean(f.title, MAX_FIELD), clean(f.evidence.slice(0, MAX_EVIDENCE).join('; '), MAX_FIELD), clean(f.fix ?? '', MAX_FIELD)].join('|'));
  return `platform: ${ctx.platform}; market: ${ctx.market ?? 'unspecified'}\n<findings>\n${lines.join('\n')}\n</findings>`;
}

export interface Advised {
  steps: string[];
  effort: Effort;
  headline?: string;
  why?: string;
  check?: string;
  safeCopy?: string;
}

interface Raw {
  n?: unknown;
  steps?: unknown;
  effort?: unknown;
  headline?: unknown;
  why?: unknown;
  check?: unknown;
  safe_copy?: unknown;
}

/** Fix number (1-based) -> advice. A fix the model skipped, answered twice or answered unsafely is simply absent. */
export function verifyAdvice(raw: unknown, fixes: readonly Finding[]): Map<number, Advised> {
  const out = new Map<number, Advised>();
  if (!Array.isArray(raw)) return out;
  for (const r of raw as Raw[]) {
    const n = typeof r?.n === 'number' ? r.n : 0;
    const fix = fixes[n - 1];
    if (!fix || out.has(n) || !EFFORTS.includes(r.effort as Effort) || !Array.isArray(r.steps)) continue;
    const steps = (r.steps as unknown[]).filter((s): s is string => typeof s === 'string').map((s) => clean(s, MAX_STEP).replace(/^(step\s*)?\d+[.):]\s*/i, '')).filter((s) => s.length > 3 && !UNSAFE.test(s)).slice(0, ADVICE_MAX_STEPS);
    if (!steps.length) continue;
    const note = (v: unknown): string | undefined => (typeof v === 'string' && clean(v, MAX_NOTE).length > 3 && !UNSAFE.test(v) ? clean(v, MAX_NOTE) : undefined);
    const copy = typeof r.safe_copy === 'string' ? clean(r.safe_copy, MAX_COPY) : '';
    out.set(n, { steps, effort: r.effort as Effort, headline: note(r.headline), why: note(r.why), check: note(r.check), safeCopy: fix.id.startsWith('policy.') && copy && !UNSAFE.test(copy) ? copy : undefined });
  }
  return out;
}
