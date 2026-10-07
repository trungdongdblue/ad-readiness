import type { Capture, EvidenceSource, Phase, Report, Rule, RuleContext } from '../domain/types';
import { MOBILE_RULES } from '../rules/mobile';
import { sourcesFor } from '../rules/sources';
import { TRACKING_RULES } from '../rules/tracking';
import { observe } from './observe';

export function analyze(cap: Capture, ctx: RuleContext, rules: readonly Rule[] = [...TRACKING_RULES, ...MOBILE_RULES]): Report {
  const obs = observe(cap);
  const findings = rules.flatMap((rule) => rule(obs, ctx)).map((f) => {
    const source = f.source ?? sourcesFor(f.id);
    return source ? { ...f, source } : f;
  });

  const grouped = new Map<string, { count: number; sources: Set<EvidenceSource>; phases: Set<Phase> }>();
  for (const e of obs.events) {
    const g = grouped.get(e.name) ?? { count: 0, sources: new Set<EvidenceSource>(), phases: new Set<Phase>() };
    g.count += 1;
    g.sources.add(e.source);
    g.phases.add(e.phase);
    grouped.set(e.name, g);
  }

  return {
    version: 1,
    target: cap.target,
    finalUrl: cap.finalUrl,
    market: ctx.market,
    platform: cap.platform,
    pixels: [...new Set(obs.pixels.map((p) => p.id))],
    events: [...grouped.entries()].map(([name, g]) => ({ name, count: g.count, sources: [...g.sources], phases: [...g.phases] })),
    undecodedBeacons: obs.undecodedBeacons,
    consentBannerSeen: obs.consentBannerSeen,
    consentClicked: obs.consentClicked,
    findings,
    phases: cap.phases,
    errors: cap.errors,
    durationMs: cap.durationMs,
  };
}
