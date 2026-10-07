import { afterAll, describe, expect, it } from 'vitest';
import { ScanSession } from '../src/collectors/browser-session';
import { countryNames, isCountryGate } from '../src/parsers/country-gate';
import { runScan } from '../src/app/scan-service';
import { startFixtureServer } from './fixtures/site';

describe('country page detection', () => {
  it('recognises a page that only asks for a country (khaadi.com)', () => {
    expect(isCountryGate('Select Your Country Pakistan United Kingdom United States United Arab Emirates Global')).toBe(true);
  });
  it('leaves a real store page and a page with a single country alone', () => {
    expect(isCountryGate('Welcome to our shop. Free delivery in Pakistan. ' + 'Great prices on every order. '.repeat(40))).toBe(false);
    expect(isCountryGate('Choose your country: Pakistan')).toBe(false);
    expect(isCountryGate('')).toBe(false);
  });
  it('names the market on the page, and nothing for "Other"', () => {
    expect(countryNames('PK')).toEqual(['Pakistan']);
    expect(countryNames('AE')).toContain('United Arab Emirates');
    expect(countryNames(undefined)).toEqual([]);
  });
});

describe('a store that opens on a country page', () => {
  const servers: Awaited<ReturnType<typeof startFixtureServer>>[] = [];
  afterAll(async () => { await Promise.all(servers.map((s) => s.close())); });

  const scan = async (market?: string) => {
    const server = await startFixtureServer({ pixel: false, countryGate: true });
    servers.push(server);
    const session = await ScanSession.open({ headless: true, allowLiveEvents: false, market });
    try {
      return await runScan(session, server.url, { url: server.url, allowPrivate: true, llm: false, market });
    } finally { await session.close(); }
  };

  it('chooses the market\'s country and reaches the store', async () => {
    const capture = await scan('PK');
    expect(capture.phases[0]).toMatchObject({ reached: true, note: 'chose "Pakistan" on the store\'s country page' });
    expect(capture.phases.find((p) => p.phase === 'product')?.reached).toBe(true);
  });
  it('says so, and does not guess a country, when no market is selected', async () => {
    const capture = await scan(undefined);
    expect(capture.phases[0]?.note).toContain('none selected');
    expect(capture.phases.find((p) => p.phase === 'product')?.reached).toBeFalsy();
  });
});
