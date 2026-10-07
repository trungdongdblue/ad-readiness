import type { Finding } from '../domain/types';

/** Items TikTok lists for e-commerce landing pages (docs/COMPLIANCE-RULES.md). Company/brand identity and payment are information only, not scored. */
const SCORED = new Set(['trust.refund_policy', 'trust.terms', 'trust.privacy', 'trust.shipping', 'trust.contact', 'trust.price']);

export interface TrustScore { percent: number; checked: number; total: number }

/**
 * Share of checkable items that are present: found = 1, found only indirectly (minor) = 0.5, missing = 0.
 * `unverifiable` is left out of the denominator, never counted against the store. null when nothing could be checked.
 * ponytail: equal weights, no cap for a missing item; revisit once the Tracking score exists (ROADMAP Phase 2).
 */
export function trustScore(findings: readonly Finding[]): TrustScore | null {
  const items = findings.filter((f) => SCORED.has(f.id));
  const decided = items.filter((f) => f.status !== 'unverifiable');
  if (!decided.length) return null;
  const points = decided.reduce((sum, f) => sum + (f.status === 'missing' ? 0 : f.severity === 'minor' ? 0.5 : 1), 0);
  return { percent: Math.round((points / decided.length) * 100), checked: decided.length, total: items.length };
}
