import type { GroupKey, GroupScore, ScoreSummary, Verdict } from '../domain/api';
import type { Finding, Severity } from '../domain/types';

const GROUPS: readonly { key: GroupKey; owns: RegExp }[] = [
  { key: 'tracking', owns: /^(pixel|event|params|serverside)\./ },
  { key: 'mobile', owns: /^mobile\./ },
  { key: 'trust', owns: /^trust\./ },
  { key: 'policy', owns: /^policy\./ },
];

/**
 * Points lost per decided finding. Severity already says how bad a finding is (`info` = fine), for every module.
 * ponytail: fixed penalties, equal group weights; tune against the Pixel Helper PoC (ROADMAP Phase 2).
 */
export const PENALTY: Record<Severity, number> = { blocker: 60, major: 25, minor: 10, info: 0 };
/** No Pixel (blocker) means no TikTok conversion campaign, whatever else is fine. */
export const BLOCKER_GROUP_CAP = 30;
export const BLOCKER_TOTAL_CAP = 40;

/** Below this share of decided findings, a "ready" verdict would rest on too little evidence. */
export const MIN_COVERAGE = 0.6;

export const verdictOf = (total: number): Verdict => (total >= 80 ? 'ready' : total >= 50 ? 'fixes' : 'not_ready');

function scoreGroup(key: GroupKey, findings: Finding[]): GroupScore {
  // `unverifiable` stays out of the maths: we never count what we could not check against the store.
  const decided = findings.filter((f) => f.status !== 'unverifiable');
  if (!decided.length) return { key, score: null, checked: 0, issues: 0, findings };
  const lost = decided.reduce((sum, f) => sum + PENALTY[f.severity], 0);
  const cap = decided.some((f) => f.severity === 'blocker') ? BLOCKER_GROUP_CAP : 100;
  return { key, score: Math.max(0, Math.min(100 - lost, cap)), checked: decided.length, issues: decided.filter((f) => f.severity !== 'info').length, findings };
}

/** Findings from rules that were not run (`--only`) simply leave their group empty. */
export function scoreFindings(findings: readonly Finding[]): ScoreSummary {
  const groups = GROUPS.map((g) => scoreGroup(g.key, findings.filter((f) => g.owns.test(f.id))));
  const scored = groups.flatMap((g) => (g.score === null ? [] : [g.score]));
  const coverage = { checked: groups.reduce((n, g) => n + g.checked, 0), total: groups.reduce((n, g) => n + g.findings.length, 0) };
  const partial = coverage.total > 0 && coverage.checked / coverage.total < MIN_COVERAGE;
  // "Ready for TikTok ads" needs tracking checked plus something else: a lone mobile score must not read as readiness.
  const tracking = groups.find((g) => g.key === 'tracking');
  if (!tracking || tracking.score === null || scored.length < 2) return { total: null, verdict: null, groups, coverage, partial };
  const avg = scored.reduce((a, b) => a + b, 0) / scored.length;
  const blocked = groups.some((g) => g.findings.some((f) => f.status !== 'unverifiable' && f.severity === 'blocker'));
  const total = Math.round(Math.min(avg, blocked ? BLOCKER_TOTAL_CAP : 100));
  const verdict = verdictOf(total);
  return { total, verdict: partial && verdict === 'ready' ? 'fixes' : verdict, groups, coverage, partial };
}
