import { describe, expect, it } from 'vitest';
import type { Rule } from '../src/domain/types';
import { analyze } from '../src/engine/analyze';
import { sourcesFor } from '../src/rules/sources';

const IDS = [
  'pixel.present', 'pixel.multiple', 'pixel.silent', 'event.ViewContent', 'event.AddToCart', 'event.InitiateCheckout', 'event.Purchase',
  'event.alias', 'event.unknown_name', 'event.duplicate', 'serverside.events_api',
  'params.value', 'params.value_currency_pair', 'params.currency_supported', 'params.content_type', 'params.content_ids',
  'mobile.speed', 'mobile.buy_button',
  'trust.refund_policy', 'trust.terms', 'trust.privacy', 'trust.shipping', 'trust.contact', 'trust.company', 'trust.price', 'trust.payment',
  'policy.claims', 'policy.medical_claim', 'policy.weight_claim', 'policy.exaggerated_result', 'policy.before_after', 'policy.extreme_discount',
];

describe('finding sources', () => {
  it('every rule id that judges something has a source, and a TikTok source always has a link and a date', () => {
    for (const id of IDS) {
      const src = sourcesFor(id);
      expect(src?.length, id).toBeGreaterThan(0);
      for (const s of src ?? []) if (s.kind === 'tiktok') expect(s.url && s.date, `${id}: ${s.title}`).toBeTruthy();
    }
  });

  it('mobile.checkout counts only, so it carries no source', () => {
    expect(sourcesFor('mobile.checkout')).toBeUndefined();
  });

  it('analyze attaches the source and keeps one a rule set itself', () => {
    const own = [{ kind: 'observed' as const, title: 'own' }];
    const rules: Rule[] = [() => [{ id: 'policy.medical_claim', title: 't', status: 'detected', severity: 'major', evidence: [] }], () => [{ id: 'x.y', title: 't', status: 'detected', severity: 'info', evidence: [], source: own }]];
    const cap = { target: 't', finalUrl: 't', platform: 'unknown', consentClicked: false, consentBannerSeen: false, staticPixelIds: [], requests: [], ttqCalls: [], phases: [], errors: [], durationMs: 0 } as never;
    const [a, b] = analyze(cap, {}, rules).findings;
    expect(a?.source?.[0]?.url).toContain('healthcare-pharmaceuticals');
    expect(b?.source).toBe(own);
  });
});
