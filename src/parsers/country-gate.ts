import { MARKETS, type Market } from '../domain/api';

/** How a store names each market on its country page. Matched whole, ignoring case. */
const NAMES: Record<Market, readonly string[]> = {
  PK: ['Pakistan'],
  IQ: ['Iraq'],
  AE: ['United Arab Emirates', 'UAE'],
  SA: ['Saudi Arabia', 'KSA'],
  EG: ['Egypt'],
};

/** Countries that show up on such pages beside ours; three of them on a short page means the page is a country chooser. */
const COUNTRIES = ['Pakistan', 'Iraq', 'United Arab Emirates', 'UAE', 'Saudi Arabia', 'Egypt', 'United Kingdom', 'United States', 'USA', 'UK', 'India', 'Canada', 'Australia', 'Qatar', 'Kuwait', 'Oman', 'Bahrain', 'Jordan', 'Global', 'International'];
const HEADING = /(select|choose|pick|change)( your)? (country|region|location)|where (are you|do you) (shipping|ship)/i;
const MAX_CHARS = 600;

/** True for a page that only asks the visitor to pick a country (khaadi.com): short, a "choose your country" line and several countries. */
export function isCountryGate(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || t.length > MAX_CHARS || !HEADING.test(t)) return false;
  return COUNTRIES.filter((c) => new RegExp(`\\b${c}\\b`, 'i').test(t)).length >= 3;
}

/** The names to look for on the page for this market. Empty for "Other" or an unknown code. */
export const countryNames = (market?: string): readonly string[] => (MARKETS.includes(market as Market) ? NAMES[market as Market] : []);
