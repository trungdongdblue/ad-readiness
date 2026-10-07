import type { Metric } from '@domain/types';
import { GRADE_COPY, METRIC_COPY } from '../explain';
import { Term } from './Term';

/** Where `value` sits on a good / needs improvement / poor track. The track runs to 1.5x the "poor" limit. */
const position = (m: Metric): number => Math.min(100, (m.value / (m.poor * 1.5)) * 100);

export function MetricBars({ metrics }: { metrics: Metric[] }) {
  return (
    <ul className="metrics">
      {metrics.map((m) => {
        const c = METRIC_COPY[m.key];
        const good = (m.good / (m.poor * 1.5)) * 100;
        const poor = (m.poor / (m.poor * 1.5)) * 100;
        return (
          <li key={m.key} className="metric" data-grade={m.grade}>
            <span className="metric__title">{c.title} <Term k={c.term}>({c.term})</Term></span>
            <span className="metric__value mono">{c.format(m.value)}</span>
            <span className="metric__grade">{GRADE_COPY[m.grade]}</span>
            <span className="metric__track" aria-hidden style={{ ['--good' as string]: `${good}%`, ['--poor' as string]: `${poor}%` }}>
              <span className="metric__marker" style={{ left: `${position(m)}%` }} />
            </span>
            <span className="metric__hint">Good is {c.format(m.good)} or less</span>
          </li>
        );
      })}
    </ul>
  );
}
