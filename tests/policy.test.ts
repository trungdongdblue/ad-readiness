import { describe, expect, it } from 'vitest';
import type { Finding, Observation } from '../src/domain/types';
import { POLICY_RULES } from '../src/rules/policy';

const PAD = 'Shop our new collection today. '.repeat(30);
const run = (text?: string): Finding[] => {
  const o: Observation = { trust: text === undefined ? undefined : { links: [], text: `${PAD} ${text}` }, platform: 'unknown', pixels: [], events: [], undecodedBeacons: 0, consentClicked: false, consentBannerSeen: false, phases: [] };
  return POLICY_RULES.flatMap((r) => r(o, {}));
};
const ids = (fs: Finding[]): string[] => fs.map((f) => f.id);

describe('claim keywords', () => {
  it('finds each documented claim type and quotes the page', () => {
    const f = run('Cures acne in days. Remove wrinkles fast. Guaranteed results! Lose 10 kg without exercise. See our before and after photos. Up to 90% off!');
    expect(ids(f)).toEqual(expect.arrayContaining(['policy.medical_claim', 'policy.exaggerated_result', 'policy.weight_claim', 'policy.before_after', 'policy.extreme_discount']));
    expect(f.find((x) => x.id === 'policy.medical_claim')?.evidence.join(' ')).toMatch(/cures acne/i);
  });

  it('is never missing and never a blocker: signals only', () => {
    const f = run('Cures cancer. Miracle cure. Lose 20 kg overnight.');
    expect(f.every((x) => x.status === 'detected' && x.severity !== 'blocker')).toBe(true);
  });

  it('ignores ordinary shop wording', () => {
    const f = run('Treat yourself to a hair treatment. 30-day money back guarantee. 20% off. Free delivery in 3 days. Order #12345. Made in Italy.');
    expect(ids(f)).toEqual(['policy.claims']);
    expect(f[0]?.title).toMatch(/^No risky/);
  });
});

describe('pages the list cannot judge', () => {
  it('unreadable page gives one unverifiable finding', () => {
    const f = run(undefined);
    expect(f.map((x) => [x.id, x.status])).toEqual([['policy.claims', 'unverifiable']]);
  });

  it('non-English page is unverifiable, not "no risky wording"', () => {
    const f = run('هذا المنتج يعالج حب الشباب ويزيل التجاعيد بشكل نهائي '.repeat(40));
    expect(f.map((x) => [x.id, x.status])).toEqual([['policy.claims', 'unverifiable']]);
  });
});
