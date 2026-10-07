import type { Finding, Severity } from '@domain/types';

const RANK: Record<Severity, number> = { blocker: 0, major: 1, minor: 2, info: 3 };

export interface Partitioned {
  /** Decided and costing points, worst first. */
  toFix: Finding[];
  passed: Finding[];
  /** Could not be checked from outside: shown, never scored. */
  unverified: Finding[];
}

export function partition(findings: readonly Finding[]): Partitioned {
  const by = (pick: (f: Finding) => boolean): Finding[] => findings.filter(pick).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return {
    toFix: by((f) => f.status !== 'unverifiable' && f.severity !== 'info'),
    passed: by((f) => f.status !== 'unverifiable' && f.severity === 'info'),
    unverified: by((f) => f.status === 'unverifiable'),
  };
}
