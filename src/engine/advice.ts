import type { Finding } from '../domain/types';
import { PENALTY, scoreFindings } from './score';

export interface Fix {
  finding: Finding;
  gain: number;
}

const fixed = (f: Finding): Finding => ({ ...f, severity: 'info', status: 'verified' });

/** Findings that cost points. `unverifiable` is never a fix: we do not know it is broken. */
export const actionable = (findings: readonly Finding[]): Finding[] => findings.filter((f) => f.status !== 'unverifiable' && f.severity !== 'info');

/** Total score if exactly these findings were fixed, re-scored with the real engine so caps and averages stay honest. */
export const scoreIfFixed = (findings: readonly Finding[], fixes: readonly Finding[]): number | null =>
  scoreFindings(findings.map((f) => (fixes.includes(f) ? fixed(f) : f))).total;

/** The `max` fixes worth most to the score. Ties (a cap hides single gains) fall back to severity, then to scan order. */
export function rankFixes(findings: readonly Finding[], max: number): Fix[] {
  const base = scoreFindings(findings).total;
  return actionable(findings)
    .map((finding) => {
      const after = base === null ? null : scoreIfFixed(findings, [finding]);
      return { finding, gain: after === null || base === null ? 0 : after - base };
    })
    .sort((a, b) => b.gain - a.gain || PENALTY[b.finding.severity] - PENALTY[a.finding.severity])
    .slice(0, max);
}
