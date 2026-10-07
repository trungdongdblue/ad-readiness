import { describe, expect, it } from 'vitest';
import { ScanSession } from '../src/collectors/browser-session';
import { browserFor, proxyForMarket } from '../src/config/markets';

describe('market browser profile', () => {
  it('sets language and time zone for a known market, and nothing for "Other" or an unknown code', () => {
    expect(browserFor('PK')).toMatchObject({ locale: 'en-PK', timezoneId: 'Asia/Karachi' });
    expect(browserFor('PK').extraHTTPHeaders?.['accept-language']).toMatch(/^en-PK,en/);
    expect(browserFor(undefined)).toEqual({});
    expect(browserFor('ZZ')).toEqual({});
  });
  it('takes a country proxy only from SCAN_PROXY_<MARKET> of a known market', () => {
    const env = { SCAN_PROXY_PK: 'http://pk.example:3128', SCAN_PROXY_ZZ: 'http://zz.example:3128' };
    expect(proxyForMarket('PK', env)).toBe('http://pk.example:3128');
    expect(proxyForMarket('AE', env)).toBeUndefined();
    expect(proxyForMarket('ZZ', env)).toBeUndefined();
    expect(proxyForMarket(undefined, env)).toBeUndefined();
  });
  it('really browses as that market', async () => {
    const s = await ScanSession.open({ headless: true, allowLiveEvents: false, market: 'AE' });
    try {
      const seen = await s.page.evaluate('({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lang: navigator.language, langs: navigator.languages })');
      expect(seen).toMatchObject({ tz: 'Asia/Dubai', lang: 'en-AE' });
    } finally {
      await s.close();
    }
  });
});
