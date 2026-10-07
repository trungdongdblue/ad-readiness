import { ArrowRight, CircleAlert, Globe, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { MARKETS } from '@domain/api';
import { MARKET_LABEL } from '../copy';

interface Props {
  onSubmit: (url: string, market: string) => Promise<void>;
  error?: { field?: 'url' | 'market'; message: string };
}

export function ScanForm({ onSubmit, error }: Props) {
  const [url, setUrl] = useState('');
  const [market, setMarket] = useState('PK');
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<string>();
  // A server error about a field stays until the customer edits it; anything else is shown above the button.
  const urlError = local ?? (error?.field === 'url' ? error.message : undefined);
  const formError = error && error.field !== 'url' ? error.message : undefined;

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!url.trim()) return setLocal('Enter your store address, for example mystore.com');
    setBusy(true);
    await onSubmit(url.trim(), market);
    setBusy(false);
  }

  return (
    <form className="scan-form" onSubmit={submit} noValidate>
      <div className={`field${urlError ? ' field--error' : ''}`}>
        <label className="field__label" htmlFor="store-url">Store address</label>
        <div className="field__control">
          <span className="field__icon"><Globe size={18} aria-hidden /></span>
          <input
            id="store-url" className="field__input field__input--icon" type="text" inputMode="url" autoComplete="url"
            autoCapitalize="none" spellCheck={false} placeholder="mystore.com" value={url}
            aria-invalid={Boolean(urlError)} aria-describedby="store-url-msg"
            onChange={(e) => { setUrl(e.target.value); setLocal(undefined); }}
          />
        </div>
        <span id="store-url-msg" role={urlError ? 'alert' : undefined} className={urlError ? 'field__error' : 'field__hint'}>
          {urlError ? <><CircleAlert size={14} aria-hidden />{urlError}</> : 'Your landing page or any product page'}
        </span>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="market">Target market</label>
        <select id="market" className="field__input" value={market} onChange={(e) => setMarket(e.target.value)}>
          {MARKETS.map((m) => <option key={m} value={m}>{MARKET_LABEL[m]}</option>)}
          <option value="">Other</option>
        </select>
        <span className="field__hint">Browses with that country's language and time zone</span>
      </div>
      {formError && <p className="field__error scan-form__submit" role="alert"><CircleAlert size={14} aria-hidden />{formError}</p>}
      <button className="btn btn--primary btn--lg btn--block scan-form__submit" type="submit" disabled={busy}>
        {busy ? <><LoaderCircle className="spin" size={18} aria-hidden />Starting scan</> : <>Scan my store<ArrowRight size={18} aria-hidden /></>}
      </button>
      <p className="scan-form__safe">
        <ShieldCheck size={16} aria-hidden />
        Read-only scan. We never place orders, enter personal data or send events to TikTok. Takes about 2 minutes.
      </p>
    </form>
  );
}
