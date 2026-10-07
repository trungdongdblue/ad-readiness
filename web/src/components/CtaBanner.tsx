import { ArrowUpRight } from 'lucide-react';
import type { GroupScore } from '@domain/api';
import { CTA_URL } from '../copy';

/** Tracking is the one thing Ecomdy fixes for free, so the pitch follows the tracking result. */
export function CtaBanner({ tracking, partial }: { tracking?: GroupScore; partial: boolean }) {
  const broken = tracking?.score !== null && tracking?.score !== undefined && tracking.score < 100;
  const text = broken
    ? { title: 'Pixel not right? We fix it.', body: 'Ecomdy sets up your TikTok Pixel and events for free when you open an agency account.', cta: 'Get free Pixel setup' }
    : partial
    ? { title: 'Want the full picture?', body: 'We could only reach part of your store. Talk to Ecomdy about checking the whole funnel with you.', cta: 'Talk to Ecomdy' }
    : { title: 'Ready to scale on TikTok?', body: 'Open an Ecomdy agency account and run your campaigns on infrastructure built for global commerce.', cta: 'Open an agency account' };
  return (
    <aside className="cta on-dark" aria-label="Ecomdy offer">
      <div className="cta__text">
        <h2 className="display cta__title">{text.title}</h2>
        <p className="muted">{text.body}</p>
      </div>
      <a className="btn btn--primary btn--lg" href={CTA_URL} target="_blank" rel="noopener noreferrer">
        {text.cta}<ArrowUpRight size={18} aria-hidden />
      </a>
    </aside>
  );
}
