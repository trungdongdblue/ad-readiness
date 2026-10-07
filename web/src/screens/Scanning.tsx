import { Check, CircleAlert, LoaderCircle, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Footer, Header } from '../components/Chrome';
import { MARKET_LABEL, STAGE_STEPS } from '../copy';
import type { ScanState } from '../useScan';

type Scanning = Extract<ScanState, { kind: 'scanning' }>;

const clock = (ms: number): string => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

function useElapsed(since: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now - since;
}

export function Scanning({ state, onCancel }: { state: Scanning; onCancel: () => void }) {
  const elapsed = useElapsed(state.startedAt);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, []);
  // Before the first poll answers we are still queued behind the browser launch: treat as the first step.
  const current = Math.max(0, STAGE_STEPS.findIndex((s) => s.stage === state.stage));

  return (
    <>
      <Header tone="light" />
      <main className="container scan-page">
        <section className="card scan-card" aria-labelledby="scan-title">
          <div className="scan-card__top">
            <span className="eyebrow">Scanning</span>
            <h1 id="scan-title" ref={title} tabIndex={-1} className="display scan-card__title">Reading your store like a shopper</h1>
            <div className="scan-card__meta">
              <span className="scan-card__url">{state.url}</span>
              {state.market && <span className="badge badge--brand">{MARKET_LABEL[state.market]}</span>}
              <span className="timer" aria-hidden>{clock(elapsed)}</span>
            </div>
          </div>
          <ol className="steps" aria-live="polite">
            {STAGE_STEPS.map((s, i) => {
              const st = i < current ? 'done' : i === current ? 'active' : 'pending';
              return (
                <li key={s.stage} className="step" data-state={st} aria-current={st === 'active' ? 'step' : undefined}>
                  <span className="step__dot">{st === 'done' ? <Check size={14} aria-hidden /> : st === 'active' ? <LoaderCircle className="spin" size={14} aria-hidden /> : i + 1}</span>
                  <div>
                    <p className="step__label">{s.label}<span className="sr-only">{st === 'done' ? ', done' : st === 'active' ? ', in progress' : ', waiting'}</span></p>
                    {st === 'active' && <p className="step__hint">{s.hint}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="scan-card__foot">
            <span>Usually 1 to 3 minutes. Keep this tab open.</span>
            <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export function ScanFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      <Header tone="light" />
      <main className="container scan-page">
        <section className="card scan-card error-card" role="alert">
          <span className="error-card__icon"><CircleAlert size={24} aria-hidden /></span>
          <h1 className="display scan-card__title">The scan did not finish</h1>
          <p className="muted">{message}</p>
          <button className="btn btn--primary" onClick={onRetry}><RotateCcw size={16} aria-hidden />Try again</button>
        </section>
      </main>
      <Footer />
    </>
  );
}
