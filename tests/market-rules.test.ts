import { describe, expect, it } from 'vitest';
import type { Finding, Observation, TrustCapture } from '../src/domain/types';
import { currenciesShown, localCurrency } from '../src/parsers/currency';
import { POLICY_RULES } from '../src/rules/policy';
import { marketNote } from '../src/rules/policy/markets';
import { TRUST_RULES } from '../src/rules/trust';

const PAD = 'Shop our new collection today. '.repeat(30);
const link = (text: string, href: string) => ({ text, href });
const LINKS = [link('About us', 'https://s.test/about'), ...Array.from({ length: 29 }, (_, i) => link(`Page ${i}`, `https://s.test/pages/p${i}`))];
const obs = (text: string): Observation => ({ trust: { links: LINKS, text: `${PAD} ${text}` } as TrustCapture, platform: 'unknown', pixels: [], events: [], undecodedBeacons: 0, consentClicked: false, consentBannerSeen: false, phases: [] });
const policy = (text: string, market?: string): Finding[] => POLICY_RULES.flatMap((r) => r(obs(text), { market }));
const trust = (text: string, market?: string): Finding[] => TRUST_RULES.flatMap((r) => r(obs(text), { market }));

describe('market notes on claim findings', () => {
  it('says what the owner may do in their market, and keeps the severity the same', () => {
    const pk = policy('Lose 10 kg without exercise.', 'PK').find((f) => f.id === 'policy.weight_claim');
    const none = policy('Lose 10 kg without exercise.').find((f) => f.id === 'policy.weight_claim');
    expect(pk?.fix).toContain('For Pakistan: weight loss supplements');
    expect(pk?.severity).toBe(none?.severity);
    expect(none?.fix).not.toContain('For ');
  });
  it('Saudi Arabia is not on TikTok\'s list for weight loss products, the other four are', () => {
    expect(marketNote('weight', 'SA')).toContain('does not include Saudi Arabia');
    for (const m of ['PK', 'IQ', 'AE', 'EG']) expect(marketNote('weight', m)).toContain('local licence');
  });
  it('medical note asks IQ, SA and EG to disclose safety and usage for OTC medicines, PK and AE not', () => {
    for (const m of ['IQ', 'SA', 'EG']) expect(marketNote('medical', m)).toContain('safety and usage');
    for (const m of ['PK', 'AE']) expect(marketNote('medical', m)).not.toContain('safety and usage');
  });
  it('adds nothing for "Other", an unknown code, or a claim that does not differ by market', () => {
    expect(marketNote('medical', undefined)).toBeUndefined();
    expect(marketNote('medical', 'ZZ')).toBeUndefined();
    expect(marketNote('exaggerated', 'PK')).toBeUndefined();
  });
});

describe('price currency against the market', () => {
  it('reads the currency written beside a number', () => {
    expect([...currenciesShown('Now $25.00 or Rs. 6,990 (was Rs 8,990)')].sort()).toEqual(['PKR', 'USD']);
    expect([...currenciesShown('AED 99 and 120 SAR')].sort()).toEqual(['AED', 'SAR']);
    expect(currenciesShown('No prices here, only Rs words').size).toBe(0);
    expect(localCurrency('EG')).toBe('EGP');
    expect(localCurrency(undefined)).toBeUndefined();
  });
  it('prompts a check (info only) when the prices are in another currency than the market\'s', () => {
    const f = trust('Special price $25.00 today.', 'PK').find((x) => x.id === 'trust.price_currency');
    expect(f).toMatchObject({ status: 'detected', severity: 'info' });
    expect(f?.title).toContain('USD, not PKR');
  });
  it('stays silent when the local currency is shown, when no market is chosen, and when there is no price', () => {
    expect(trust('Price Rs. 2,500 only', 'PK').some((x) => x.id === 'trust.price_currency')).toBe(false);
    expect(trust('Price $25.00', undefined).some((x) => x.id === 'trust.price_currency')).toBe(false);
    expect(trust('No numbers here', 'PK').some((x) => x.id === 'trust.price_currency')).toBe(false);
  });
});
