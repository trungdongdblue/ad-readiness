import type { GroupScore } from '@domain/api';
import { verdictOf } from '@engine/score';
import { GROUP_COPY } from '../copy';
import { GROUP_ICON } from '../lib/icons';

interface Props {
  group: GroupScore;
  selected: boolean;
  onSelect: () => void;
}

export function GroupCard({ group, selected, onSelect }: Props) {
  const { key, score, checked, issues } = group;
  const Icon = GROUP_ICON[key];
  const copy = GROUP_COPY[key];
  // A high score built on a sliver of the checks is flagged on the card itself, not only in the footer.
  const thin = score !== null && checked * 2 < group.findings.length;
  const foot = score === null ? 'Could not be checked from outside. Not counted in your score.' : `${issues} ${issues === 1 ? 'issue' : 'issues'} · ${checked} of ${group.findings.length} checked`;
  return (
    <button type="button" className="card group-card" aria-pressed={selected} onClick={onSelect} data-verdict={score === null ? 'none' : verdictOf(score)}>
      <span className="group-card__head"><Icon size={18} aria-hidden />{copy.title}{thin && <span className="badge badge--warning badge--upper">Partial</span>}</span>
      {score === null
        ? <span className="group-card__score group-card__score--none">Not checked</span>
        : <span className="group-card__score">{score}<small> / 100</small></span>}
      <span className="bar" aria-hidden><span style={{ width: `${score ?? 0}%` }} /></span>
      <span className="group-card__foot">{foot}</span>
    </button>
  );
}
