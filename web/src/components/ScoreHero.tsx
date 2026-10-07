import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ScoreSummary } from '@domain/api';
import type { PhaseResult } from '@domain/types';
import { PHASE_LABEL, VERDICT_COPY } from '../copy';

const R = 54;
const C = 2 * Math.PI * R;

/** Arc animates from empty on mount. Under reduced motion the global rule makes it instant. */
function Dial({ score }: { score: number | null }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(score ?? 0));
    return () => cancelAnimationFrame(t);
  }, [score]);
  return (
    <div className="dial" role="img" aria-label={score === null ? 'No score' : `Score ${score} out of 100`}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle className="dial__track" cx="60" cy="60" r={R} />
        <circle className="dial__arc" cx="60" cy="60" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} />
      </svg>
      <div className="dial__value">
        <span className="dial__num">{score ?? '--'}</span>
        <span className="dial__of">/ 100</span>
      </div>
    </div>
  );
}

function Funnel({ phases }: { phases: PhaseResult[] }) {
  return (
    <ul className="funnel" aria-label="Funnel steps reached">
      {phases.map((p) => (
        <li key={p.phase} className="funnel__step" data-reached={p.reached}>
          {p.reached ? <Check size={12} aria-hidden /> : <X size={12} aria-hidden />}
          {PHASE_LABEL[p.phase]}
          <span className="sr-only">{p.reached ? ' reached' : ' not reached'}</span>
        </li>
      ))}
    </ul>
  );
}

export function ScoreHero({ score, phases, issues }: { score: ScoreSummary; phases: PhaseResult[]; issues: number }) {
  const { checked, total } = score.coverage;
  const v = VERDICT_COPY[score.verdict ?? 'none'];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="card card--ink score-hero on-dark" data-verdict={score.verdict ?? 'none'} aria-labelledby="verdict">
      <Dial score={score.total} />
      <div className="score-hero__text">
        <span className="eyebrow muted">Ad-readiness score</span>
        <h1 id="verdict" ref={heading} tabIndex={-1} className="display score-hero__title"><span className="score-hero__verdict">{v.title}</span></h1>
        <p className="score-hero__lead">{v.lead}</p>
        {score.total !== null && <p className="muted">{issues === 0 ? 'No issues found in what we could check.' : `${issues} ${issues === 1 ? 'issue' : 'issues'} to review.`}</p>}
        {total > 0 && (
          <p className="coverage" data-partial={score.partial}>
            {score.partial && <span className="badge badge--warning badge--upper">Partial scan</span>}
            <span>Based on {checked} of {total} checks.{score.partial ? ' We could only reach part of the store, so this is not a full readiness verdict.' : ''}</span>
          </p>
        )}
        <Funnel phases={phases} />
      </div>
    </section>
  );
}
