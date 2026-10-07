import { Footer, Header } from '../components/Chrome';
import { ScanForm } from '../components/ScanForm';
import { GROUP_COPY, WHY } from '../copy';
import { GROUP_ICON, GROUP_ORDER } from '../lib/icons';
import type { ScanState } from '../useScan';

interface Props {
  error?: Extract<ScanState, { kind: 'idle' }>['error'];
  onSubmit: (url: string, market: string) => Promise<void>;
}

export function Landing({ error, onSubmit }: Props) {
  return (
    <>
      <div className="hero on-dark">
        <Header tone="dark" />
        <div className="container hero__body">
          <span className="badge badge--on-dark badge--upper">TikTok Sales readiness</span>
          <h1 className="display hero__title">Can your store run <span className="accent">TikTok ads?</span></h1>
          <p className="hero__lead">Scan your store and get a score out of 100 across tracking, mobile experience, store information and ad-policy risk, with a fix for every issue.</p>
          <ScanForm onSubmit={onSubmit} error={error} />
        </div>
      </div>

      <main>
        <section className="section container" aria-labelledby="what">
          <div className="section__head">
            <span className="eyebrow">What we score</span>
            <h2 id="what" className="display section__title">Four groups. One score.</h2>
          </div>
          <ul className="grid-4">
            {GROUP_ORDER.map((key) => {
              const Icon = GROUP_ICON[key];
              const g = GROUP_COPY[key];
              return (
                <li key={key} className="card pillar">
                  <span className="pillar__icon"><Icon size={20} aria-hidden /></span>
                  <h3 className="pillar__title">{g.title}</h3>
                  <p className="muted">{g.blurb}</p>
                  <ul className="pillar__list">{g.checks.map((c) => <li key={c}>{c}</li>)}</ul>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="section container" aria-labelledby="why">
          <div className="section__head">
            <span className="eyebrow">Why this grader</span>
            <h2 id="why" className="display section__title">Built for the question that matters.</h2>
          </div>
          <div className="grid-3">
            {WHY.map((w) => <div key={w.title} className="why"><h3>{w.title}</h3><p>{w.body}</p></div>)}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
