import type { GroupKey } from '@domain/api';
import type { Finding, Report, Source } from '@domain/types';
import { GROUP_COPY } from '../copy';
import { FINDING_HELP } from '../explain';

const GROUP_ORDER: GroupKey[] = ['tracking', 'mobile', 'trust', 'policy'];
const KIND: Record<Source['kind'], string> = { tiktok: 'TikTok official', 'third-party': 'Industry standard', observed: 'Observed by the scan' };

const groupOf = (id: string): GroupKey => (id.startsWith('trust.') ? 'trust' : id.startsWith('policy.') ? 'policy' : id.startsWith('mobile.') ? 'mobile' : 'tracking');

interface Entry { source: Source; groups: Set<GroupKey>; checks: string[] }

/** Every reference this report leans on, once each: where it comes from, its date, and which checks it backs. Built from the findings, so it cannot drift from them. */
function collect(findings: readonly Finding[]): Entry[] {
  const map = new Map<string, Entry>();
  for (const f of findings) {
    for (const s of f.source ?? []) {
      if (s.kind === 'observed') continue;
      const e = map.get(s.title) ?? { source: s, groups: new Set<GroupKey>(), checks: [] };
      e.groups.add(groupOf(f.id));
      // The check in plain words, not this scan's result: the same line for every store.
      const what = FINDING_HELP[f.id]?.plain ?? f.title;
      if (e.checks.length < 3 && !e.checks.includes(what)) e.checks.push(what);
      map.set(s.title, e);
    }
  }
  const rank = (e: Entry): number => Math.min(...[...e.groups].map((g) => GROUP_ORDER.indexOf(g)));
  return [...map.values()].sort((a, b) => (a.source.kind === b.source.kind ? rank(a) - rank(b) : a.source.kind === 'tiktok' ? -1 : 1));
}

export function SourcesPanel({ report }: { report: Report }) {
  const entries = collect(report.findings);
  if (!entries.length) return null;
  return (
    <details className="how" open>
      <summary>Sources behind this report</summary>
      <p className="finding__label">Each check follows the documents below. Open a link to read the rule yourself. The scan reports risk signals from these rules: it is not a TikTok decision.</p>
      <ul>
        {entries.map(({ source: s, groups, checks }) => (
          <li key={s.title}>
            {s.url ? <a href={s.url} target="_blank" rel="noreferrer"><b>{s.title}</b></a> : <b>{s.title}</b>}
            {` · ${KIND[s.kind]}${s.date ? `, ${s.date}` : ''}`}
            <br />
            Used for {[...groups].sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)).map((g) => GROUP_COPY[g].title).join(', ')}: {checks.join(' ')}
          </li>
        ))}
      </ul>
    </details>
  );
}
