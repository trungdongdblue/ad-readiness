import { Check, Minus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Finding, Report, Status } from '@domain/types';
import { EXPECTED_EVENTS, TIKTOK_AUTO_EVENTS } from '../explain';

const STATE: Record<Status, { label: string; icon: ReactNode }> = {
  verified: { label: 'Seen', icon: <Check size={14} aria-hidden /> },
  detected: { label: 'In page code, not seen on the network', icon: <Minus size={14} aria-hidden /> },
  missing: { label: 'Not seen', icon: <X size={14} aria-hidden /> },
  unverifiable: { label: 'Not checked', icon: <span aria-hidden>?</span> },
};

/** The Pixel and the four shopper actions it should report, with what we saw for each. Replaces a bare list of event names. */
export function TrackingSummary({ report, findings }: { report: Report; findings: Finding[] }) {
  const byId = new Map(findings.map((f) => [f.id, f]));
  const expected = new Set<string>(EXPECTED_EVENTS.map((e) => e.name));
  const other = report.events.map((e) => e.name).filter((n) => !expected.has(n));
  return (
    <section className="tracking" aria-label="Tracking at a glance">
      <p className="tracking__intro">
        The <b>TikTok Pixel</b> is tracking code on your site. It should report these four shopper actions, so TikTok can find buyers and measure sales.
      </p>
      <p className="tracking__pixel">
        {report.pixels.length > 0
          ? <>Pixel found: {report.pixels.map((id) => <code key={id} className="mono">{id}</code>)}</>
          : <>No Pixel found.</>}
      </p>
      <ol className="events">
        {EXPECTED_EVENTS.map((e) => {
          const f = byId.get(`event.${e.name}`);
          const status: Status = f?.status ?? 'unverifiable';
          const state = STATE[status];
          const note = e.name === 'Purchase' && status === 'unverifiable' ? 'Needs a real order, so we cannot see it' : state.label;
          return (
            <li key={e.name} className="event-card" data-state={status}>
              <span className="event-card__name mono">{e.name}</span>
              <span className="event-card__plain">{e.plain}</span>
              <span className="event-card__state">{state.icon}{note}</span>
            </li>
          );
        })}
      </ol>
      {other.length > 0 && (
        <p className="tracking__other">
          Other events seen:{' '}
          {other.map((n) => <span key={n} className="chip mono" title={TIKTOK_AUTO_EVENTS.has(n) ? 'Sent automatically by the Pixel. Normal.' : undefined}>{n}</span>)}
        </p>
      )}
    </section>
  );
}
