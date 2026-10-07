import { MARKETS, type Market } from '../domain/api';

/** The local currency of each market (ISO 4217). TikTok asks for prices in the target market's local currency (docs/MARKET-RULES.md). */
export const LOCAL_CURRENCY: Record<Market, string> = { PK: 'PKR', IQ: 'IQD', AE: 'AED', SA: 'SAR', EG: 'EGP' };
export const localCurrency = (market?: string): string | undefined => (MARKETS.includes(market as Market) ? LOCAL_CURRENCY[market as Market] : undefined);

/** How stores write a currency next to a number, mapped to its ISO code. A bare "$" is read as USD, "Rs" as PKR. */
const WRITTEN: [string, string][] = [
  ['PKR', 'PKR'], ['Rs\\.?', 'PKR'], ['AED', 'AED'], ['Dhs?', 'AED'], ['د\\.إ', 'AED'], ['SAR', 'SAR'], ['SR', 'SAR'], ['ر\\.س', 'SAR'],
  ['IQD', 'IQD'], ['د\\.ع', 'IQD'], ['EGP', 'EGP'], ['E£', 'EGP'], ['LE', 'EGP'], ['ج\\.م', 'EGP'],
  ['USD', 'USD'], ['\\$', 'USD'], ['EUR', 'EUR'], ['€', 'EUR'], ['GBP', 'GBP'], ['£', 'GBP'], ['INR', 'INR'], ['₹', 'INR'],
];

/** ISO codes of the currencies that appear right next to a number in the text. */
export function currenciesShown(text: string): Set<string> {
  const found = new Set<string>();
  for (const [written, iso] of WRITTEN) {
    const re = new RegExp(`(?<![A-Za-z])${written}\\s?\\d[\\d.,]*|\\d[\\d.,]*\\s?${written}(?![A-Za-z])`);
    if (re.test(text)) found.add(iso);
  }
  return found;
}
