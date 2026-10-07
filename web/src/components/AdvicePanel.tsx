import { Check, ChevronDown, Clock, Copy, Loader2, Sparkles, Wrench } from 'lucide-react';
import { useState } from 'react';
import type { AdviceItem, AdviceState, AdvicePlan, Effort } from '@domain/api';
import { ADVICE_COPY, EFFORT_COPY, SEVERITY_COPY } from '../copy';
import { planMarkdown } from '../lib/advice';

/** Clipboard can be blocked (insecure origin, permissions); the button then simply does nothing visible. */
function useCopy(): [string | undefined, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string>();
  const copy = (key: string, text: string): void => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? undefined : c)), 2_000);
    }, () => undefined);
  };
  return [copied, copy];
}

const EFFORT_ICON: Record<Effort, typeof Clock> = { minutes: Clock, hour: Clock, developer: Wrench };

function CopyButton({ id, text, label, copied, onCopy, secondary }: { id: string; text: string; label: string; copied?: string; onCopy: (k: string, t: string) => void; secondary?: boolean }) {
  const done = copied === id;
  return (
    <button type="button" className={`btn ${secondary ? 'btn--secondary' : 'btn--ghost'}`} onClick={() => onCopy(id, text)}>
      {done ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {done ? 'Copied' : label}
    </button>
  );
}

function Fix({ item, rank, open, done, onDone, copied, onCopy }: { item: AdviceItem; rank: number; open: boolean; done: boolean; onDone: () => void; copied?: string; onCopy: (k: string, t: string) => void }) {
  const sev = SEVERITY_COPY[item.severity];
  const EffortIcon = EFFORT_ICON[item.effort];
  return (
    <li>
      <details className="finding advice__fix" open={open} data-done={done}>
        <summary>
          <span className="advice__rank" aria-hidden>{rank}</span>
          <span className="finding__title advice__title">{item.title}</span>
          <span className="advice__tags">
            {item.gain > 0 && <span className="badge badge--success">+{item.gain} pts</span>}
            <span className="badge"><EffortIcon size={12} aria-hidden />{EFFORT_COPY[item.effort]}</span>
            <span className={`badge badge--upper ${sev.badge}`}>{sev.label}</span>
          </span>
          <ChevronDown className="finding__chev" size={18} aria-hidden />
        </summary>
        <div className="finding__body">
          {item.why && (
            <div className="finding__help"><p><b>Why it matters</b>{item.why}</p></div>
          )}
          <div>
            <p className="eyebrow finding__label">What to do</p>
            <ol className="advice__steps">{item.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          </div>
          {item.check && (
            <div className="advice__check"><Check size={16} aria-hidden /><p><b>How to check it worked</b>{item.check}</p></div>
          )}
          {item.safeCopy && (
            <div className="advice__copy">
              <p className="eyebrow finding__label">Suggested wording</p>
              <p dir="auto" className="advice__quote">{item.safeCopy}</p>
              <CopyButton id={`w${rank}`} text={item.safeCopy} label="Copy wording" copied={copied} onCopy={onCopy} />
            </div>
          )}
          <label className="advice__done"><input type="checkbox" checked={done} onChange={onDone} />Mark as done</label>
        </div>
      </details>
    </li>
  );
}

function Plan({ plan, url }: { plan: AdvicePlan; url: string }) {
  const [done, setDone] = useState<ReadonlySet<number>>(new Set());
  const [copied, copy] = useCopy();
  const toggle = (i: number): void => setDone((d) => { const n = new Set(d); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const lift = plan.now !== null && plan.after !== null && plan.after > plan.now;
  return (
    <>
      <div className="advice__summary">
        {lift && (
          <p className="advice__lift">
            <span className="muted">Your score</span><b>{plan.now}</b><span aria-hidden>→</span><b className="advice__after">{plan.after}</b>
            <span className="muted">after {plan.items.length === 1 ? 'this fix' : `these ${plan.items.length} fixes`}</span>
          </p>
        )}
        <p className="advice__progress" aria-live="polite">{done.size} of {plan.items.length} done</p>
        <CopyButton id="plan" text={planMarkdown(url, plan)} label="Copy plan" copied={copied} onCopy={copy} secondary />
      </div>
      <ol className="advice__list">
        {plan.items.map((it, i) => <Fix key={it.title + i} item={it} rank={i + 1} open={i === 0} done={done.has(i)} onDone={() => toggle(i)} copied={copied} onCopy={copy} />)}
      </ol>
      <p className="findings__hint">{ADVICE_COPY.note}</p>
    </>
  );
}

const Loading = () => (
  <div role="status" className="advice__loading">
    <p><Loader2 className="spin" size={16} aria-hidden />{ADVICE_COPY.loading}</p>
    {[0, 1, 2].map((i) => <span key={i} className="skeleton" aria-hidden />)}
  </div>
);

/** Renders nothing when there is no AI plan (no key, or nothing to fix): the fixed texts below still work. */
export function AdvicePanel({ state, url }: { state?: AdviceState; url: string }) {
  if (!state) return null;
  return (
    <section className="advice" aria-labelledby="advice-title" aria-busy={state.status === 'pending'}>
      <div>
        <p className="eyebrow advice__eyebrow"><Sparkles size={14} aria-hidden />{ADVICE_COPY.eyebrow}</p>
        <h2 id="advice-title" className="display section__title">{ADVICE_COPY.title}</h2>
        <p className="findings__hint">{ADVICE_COPY.hint}</p>
      </div>
      {state.status === 'pending' && <Loading />}
      {state.status === 'failed' && <p className="empty card">{ADVICE_COPY.failed}</p>}
      {state.status === 'done' && <Plan plan={state.plan} url={url} />}
    </section>
  );
}
