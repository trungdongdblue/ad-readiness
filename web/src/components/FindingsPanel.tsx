import type { GroupKey, GroupScore } from '@domain/api';
import type { Finding, Report, Severity } from '@domain/types';
import { GROUP_COPY, SEVERITY_COPY } from '../copy';
import { partition } from '../lib/findings';
import { GROUP_ORDER } from '../lib/icons';
import { FindingRow } from './FindingRow';
import { TrackingSummary } from './TrackingSummary';

export type Filter = 'all' | GroupKey;

const MEANING: Partial<Record<Severity, string>> = {
  blocker: 'stops tracking or ads from working',
  major: 'likely to cost results or approvals',
  minor: 'worth fixing, smaller impact',
};

const List = ({ items }: { items: Finding[] }) => <ul className="findings__group">{items.map((f) => <FindingRow key={f.id + f.title} f={f} />)}</ul>;

interface Props {
  report: Report;
  groups: GroupScore[];
  filter: Filter;
  onFilter: (f: Filter) => void;
}

export function FindingsPanel({ report, groups, filter, onFilter }: Props) {
  const visible = groups.filter((g) => filter === 'all' || g.key === filter).flatMap((g) => g.findings);
  const { toFix, passed, unverified } = partition(visible);
  const present = (['blocker', 'major', 'minor'] as const).filter((s) => toFix.some((f) => f.severity === s));
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: groups.reduce((n, g) => n + g.issues, 0) },
    ...GROUP_ORDER.map((key) => ({ key, label: GROUP_COPY[key].title, count: groups.find((g) => g.key === key)?.issues ?? 0 })),
  ];

  return (
    <section aria-labelledby="findings-title" id="findings">
      <h2 id="findings-title" className="display section__title">Issues and fixes</h2>
      <p className="findings__hint">Pick a group to filter. The number is how many issues need fixing in it. Open any item for a plain explanation.</p>
      <div className="tabs" role="group" aria-label="Filter by group">
        {tabs.map((t) => (
          <button key={t.key} type="button" className="tab" aria-pressed={filter === t.key} onClick={() => onFilter(t.key)}>
            {t.label}<span className={`badge ${t.count ? 'badge--red' : ''}`} aria-label={`${t.count} to fix`}>{t.count}</span>
          </button>
        ))}
      </div>
      <div className="findings">
        {(filter === 'all' || filter === 'tracking') && <TrackingSummary report={report} findings={groups.find((g) => g.key === 'tracking')?.findings ?? []} />}
        {toFix.length > 0
          ? (
            <div className="findings__group">
              <h3 className="findings__title">To fix ({toFix.length})</h3>
              <p className="legend">
                {present.map((s) => <span key={s}><span className={`badge badge--upper ${SEVERITY_COPY[s].badge}`}>{SEVERITY_COPY[s].label}</span> {MEANING[s]}</span>)}
              </p>
              <List items={toFix} />
            </div>
          )
          : <p className="empty card">Nothing to fix in what we could check here.</p>}
        {unverified.length > 0 && (
          <details className="findings__group">
            <summary className="findings__title">Could not verify ({unverified.length})<span className="findings__hint">Not counted against your score</span></summary>
            <p className="findings__note">These cannot be seen from outside your store, or the page blocked us. Check them yourself where it says how.</p>
            <List items={unverified} />
          </details>
        )}
        {passed.length > 0 && (
          <details className="findings__group">
            <summary className="findings__title">Passed and notes ({passed.length})<span className="findings__hint">Nothing to fix</span></summary>
            <List items={passed} />
          </details>
        )}
      </div>
    </section>
  );
}
