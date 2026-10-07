import type { Report } from '../domain/types';
import { trustScore } from '../engine/trust-score';

const ICON = { verified: 'OK  ', detected: '~   ', unverifiable: '?   ', missing: 'MISS' } as const;

/** Compact console summary (kept short on purpose: token and screen friendly). */
export function formatReport(r: Report): string {
  const lines = [
    `${r.target}  [${r.platform}${r.market ? `, ${r.market}` : ''}]  ${Math.round(r.durationMs / 1000)}s`,
    `pixels: ${r.pixels.join(', ') || 'none'} | events: ${r.events.map((e) => `${e.name}x${e.count}`).join(' ') || 'none'} | undecoded: ${r.undecodedBeacons}`,
    `phases: ${r.phases.map((p) => `${p.phase}${p.reached ? '' : '(x)'}`).join(' > ')}`,
  ];
  for (const f of r.findings) lines.push(`${ICON[f.status]} ${f.severity.padEnd(7)} ${f.id} - ${f.title}`);
  const ts = trustScore(r.findings);
  if (ts) lines.push(`trust score: ${ts.percent}% (${ts.checked} of ${ts.total} items could be checked)`);
  if (r.errors.length) lines.push(`errors: ${r.errors.join('; ')}`);
  return lines.join('\n');
}
