import { ChevronDown } from 'lucide-react';
import type { Finding } from '@domain/types';
import { SEVERITY_COPY } from '../copy';
import { FINDING_HELP } from '../explain';
import { MetricBars } from './MetricBars';
import { Glossed } from './Term';

export function FindingRow({ f }: { f: Finding }) {
  const sev = f.status === 'unverifiable' ? { label: 'Not verified', badge: '' } : SEVERITY_COPY[f.severity];
  const help = FINDING_HELP[f.id];
  return (
    <li>
      <details className="finding">
        <summary>
          <span className={`badge badge--upper ${sev.badge}`}>{sev.label}</span>
          <span className="finding__title"><Glossed text={f.title} /></span>
          <ChevronDown className="finding__chev" size={18} aria-hidden />
        </summary>
        <div className="finding__body">
          {help && (
            <div className="finding__help">
              <p><b>In plain words</b>{help.plain}</p>
              <p><b>Why it matters</b>{help.why}</p>
            </div>
          )}
          {f.metrics && f.metrics.length > 0 && <MetricBars metrics={f.metrics} />}
          {f.evidence.length > 0 && (
            <div>
              <p className="eyebrow finding__label">What we saw</p>
              <ul className="finding__evidence">{f.evidence.map((e) => <li key={e}><Glossed text={e} /></li>)}</ul>
            </div>
          )}
          {f.fix && (
            <div>
              <p className="eyebrow finding__label">How to fix</p>
              <p className="finding__fix">{f.fix}</p>
            </div>
          )}
          {f.source && f.source.length > 0 && (
            <div>
              <p className="eyebrow finding__label">Source</p>
              <ul className="finding__evidence">
                {f.source.map((s) => (
                  <li key={s.title}>
                    {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}
                    {s.date ? ` (${s.date})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}
