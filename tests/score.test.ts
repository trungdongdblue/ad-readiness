import { describe, expect, it } from 'vitest';
import type { Finding, Severity, Status } from '../src/domain/types';
import { scoreFindings } from '../src/engine/score';

const f = (id: string, severity: Severity, status: Status = 'detected'): Finding => ({ id, title: id, status, severity, evidence: [] });
const group = (fs: Finding[], key: string) => scoreFindings(fs).groups.find((g) => g.key === key);

describe('group score', () => {
  it('routes findings by id prefix and subtracts severity penalties', () => {
    const s = scoreFindings([f('pixel.present', 'info', 'verified'), f('event.AddToCart', 'major', 'missing'), f('mobile.speed', 'minor'), f('trust.terms', 'info'), f('policy.medical_claim', 'major')]);
    expect(s.groups.map((g) => g.score)).toEqual([75, 90, 100, 75]);
    expect(s.total).toBe(85);
    expect(s.verdict).toBe('ready');
  });

  it('never counts unverifiable against the store; an all-unverifiable group is null, not 0', () => {
    expect(group([f('trust.refund_policy', 'info', 'unverifiable'), f('trust.terms', 'info', 'unverifiable')], 'trust')?.score).toBeNull();
    const s = scoreFindings([f('pixel.present', 'info', 'verified'), f('mobile.speed', 'info'), f('trust.terms', 'info', 'unverifiable')]);
    expect(s.total).toBe(100); // trust is left out of the average, not counted as 0
  });

  it('a missing Pixel caps the group and the total', () => {
    const s = scoreFindings([f('pixel.present', 'blocker', 'missing'), f('mobile.buy_button', 'info'), f('trust.terms', 'info'), f('policy.claims', 'info')]);
    expect(s.groups[0]?.score).toBe(30);
    expect(s.total).toBe(40);
    expect(s.verdict).toBe('not_ready');
  });

  it('needs tracking checked plus one more group: a lone mobile score is not "ready"', () => {
    const lone = scoreFindings([f('mobile.speed', 'info'), f('pixel.present', 'info', 'unverifiable')]);
    expect(lone).toMatchObject({ total: null, verdict: null });
    expect(scoreFindings([f('pixel.present', 'info', 'verified')]).total).toBeNull();
  });

  it('reports coverage, and holds a "ready" score at "fixes" when too little was checked', () => {
    const full = scoreFindings([f('pixel.present', 'info', 'verified'), f('mobile.speed', 'info'), f('trust.terms', 'info'), f('policy.claims', 'info')]);
    expect(full).toMatchObject({ total: 100, verdict: 'ready', partial: false, coverage: { checked: 4, total: 4 } });
    const thin = scoreFindings([f('pixel.present', 'info', 'verified'), f('mobile.speed', 'info'), ...['event.AddToCart', 'event.InitiateCheckout', 'mobile.buy_button', 'trust.terms', 'trust.privacy', 'policy.claims'].map((id) => f(id, 'info', 'unverifiable'))]);
    expect(thin).toMatchObject({ total: 100, verdict: 'fixes', partial: true, coverage: { checked: 2, total: 8 } });
  });

  it('is null when nothing could be checked', () => {
    expect(scoreFindings([]).total).toBeNull();
    expect(scoreFindings([f('mobile.speed', 'info', 'unverifiable')]).verdict).toBeNull();
  });
});
