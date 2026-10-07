import type { Finding, Phase, Rule, Severity } from '../../domain/types';
import { phaseNote, reached } from './helpers';

interface Required {
  event: string;
  phase: Phase;
  severity: Severity;
}
const REQUIRED: Required[] = [
  { event: 'ViewContent', phase: 'product', severity: 'major' },
  { event: 'AddToCart', phase: 'add-to-cart', severity: 'major' },
  { event: 'InitiateCheckout', phase: 'checkout', severity: 'major' },
];

export const eventCoverage: Rule = (obs) =>
  REQUIRED.map((r): Finding => {
    const id = `event.${r.event}`;
    // Without a Pixel there are no events to find: pixel.present already says so (or why it cannot). Do not pile the same cause on again.
    if (obs.pixels.length === 0) return { id, title: `${r.event} could not be judged without a Pixel`, status: 'unverifiable', severity: 'info', evidence: ['no Pixel was seen on the site'] };
    const hits = obs.events.filter((e) => e.name === r.event);
    const onWire = hits.filter((e) => e.source === 'network');
    if (onWire.length > 0) {
      return { id, title: `${r.event} observed`, status: 'verified', severity: 'info', evidence: [`network x${onWire.length}`, ...(obs.phases.find((p) => p.phase === r.phase && p.note)?.note ? [`${r.phase}: ${obs.phases.find((p) => p.phase === r.phase)?.note}`] : [])] };
    }
    if (hits.length > 0) {
      return {
        id, title: `${r.event} called in page code but not seen on the wire`, status: 'detected', severity: 'minor',
        evidence: ['ttq-hook'], fix: 'Verify with TikTok Test Events that the event reaches TikTok.',
      };
    }
    if (reached(obs, r.phase)) {
      return {
        id, title: `${r.event} not observed`, status: 'missing', severity: r.severity, evidence: [`phase ${r.phase} reached`],
        fix: `Add the ${r.event} event (Event Builder or code) and re-scan.`,
      };
    }
    return { id, title: `${r.event} could not be checked`, status: 'unverifiable', severity: 'info', evidence: [phaseNote(obs, r.phase)] };
  });

/** Purchase cannot be verified externally: it fires only after a real order. */
export const purchaseRule: Rule = (obs) => {
  const seen = obs.events.filter((e) => e.name === 'Purchase');
  if (seen.length > 0) {
    return [{ id: 'event.Purchase', title: 'Purchase seen during scan (unexpected)', status: 'detected', severity: 'info', evidence: seen.map((e) => e.source) }];
  }
  return [{
    id: 'event.Purchase', title: 'Purchase cannot be verified from outside', status: 'unverifiable', severity: 'info', evidence: [],
    fix: 'Place a test order and confirm Purchase (or CompletePayment) in TikTok Events Manager > Test Events.',
  }];
};
