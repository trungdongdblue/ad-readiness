import { MARKETS, type Market } from '../domain/api';

/**
 * How the scanner browses for a target market: the language, time zone and country proxy a shopper there would have.
 * English comes first on purpose: our rules and the store's own English pages are what the scan can judge, while the local
 * language stays in Accept-Language so stores that pick a language from it still serve a page real shoppers there would see.
 */
interface MarketBrowser {
  locale: string;
  timezoneId: string;
  acceptLanguage: string;
}

export const MARKET_BROWSER: Record<Market, MarketBrowser> = {
  PK: { locale: 'en-PK', timezoneId: 'Asia/Karachi', acceptLanguage: 'en-PK,en;q=0.9,ur;q=0.7' },
  IQ: { locale: 'en-IQ', timezoneId: 'Asia/Baghdad', acceptLanguage: 'en-IQ,en;q=0.9,ar;q=0.8' },
  AE: { locale: 'en-AE', timezoneId: 'Asia/Dubai', acceptLanguage: 'en-AE,en;q=0.9,ar;q=0.8' },
  SA: { locale: 'en-SA', timezoneId: 'Asia/Riyadh', acceptLanguage: 'en-SA,en;q=0.9,ar;q=0.8' },
  EG: { locale: 'en-EG', timezoneId: 'Africa/Cairo', acceptLanguage: 'en-EG,en;q=0.9,ar;q=0.8' },
};

const isMarket = (m: string | undefined): m is Market => MARKETS.includes(m as Market);

/** Playwright context options for a market. Unknown or missing market ("Other"): nothing is changed. */
export function browserFor(market?: string): { locale?: string; timezoneId?: string; extraHTTPHeaders?: Record<string, string> } {
  if (!isMarket(market)) return {};
  const b = MARKET_BROWSER[market];
  return { locale: b.locale, timezoneId: b.timezoneId, extraHTTPHeaders: { 'accept-language': b.acceptLanguage } };
}

/**
 * A proxy that exits in the market's country, from SCAN_PROXY_<MARKET> (for example SCAN_PROXY_PK), so stores that block or
 * change content by country are seen the way their shoppers see them. It replaces SCAN_PROXY for that market, so it must be
 * an egress proxy you control or trust: the network-level SSRF guard (deploy/squid.conf) only applies to traffic that goes through it.
 */
export function proxyForMarket(market?: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return isMarket(market) ? env[`SCAN_PROXY_${market}`] || undefined : undefined;
}
