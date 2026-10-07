import { Fragment, useId, type ReactNode } from 'react';
import { TERMS } from '../explain';

/** A word with a dotted underline that explains itself on hover, keyboard focus or tap. Unknown keys render as plain text. */
export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const id = useId();
  const t = TERMS[k];
  if (!t) return <>{children ?? k}</>;
  return (
    <span className="term" tabIndex={0} aria-describedby={id}>
      {children ?? k}
      <span role="tooltip" id={id} className="term__tip">
        <b>{t.name}</b>
        {t.plain}
      </span>
    </span>
  );
}

const KNOWN = new RegExp(`\\b(${Object.keys(TERMS).join('|')})\\b`);

/** Wraps every known abbreviation in a piece of rule text (titles, evidence) with its explanation. */
export function Glossed({ text }: { text: string }) {
  return (
    <>
      {text.split(KNOWN).map((part, i) => (
        <Fragment key={i}>{i % 2 ? <Term k={part} /> : part}</Fragment>
      ))}
    </>
  );
}
