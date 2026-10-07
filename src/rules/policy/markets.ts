import type { Market } from '../../domain/api';
import type { Claim } from '../../parsers/policy';

/** Facts: docs/MARKET-RULES.md (TikTok Healthcare and Weight Management pages, read 2026-10-07, both updated Sep 2026). */
const NAME: Record<Market, string> = { PK: 'Pakistan', IQ: 'Iraq', AE: 'the UAE', SA: 'Saudi Arabia', EG: 'Egypt' };
/** Markets on TikTok's Weight Management list of countries where supplements, meal replacements and surgery may be advertised with conditions. */
const WEIGHT_ALLOWED: readonly Market[] = ['PK', 'IQ', 'AE', 'EG'];
/** Markets whose OTC medicine rule also asks to disclose safety and usage requirements. */
const OTC_DISCLOSE: readonly Market[] = ['IQ', 'SA', 'EG'];

const isMarket = (m?: string): m is Market => m !== undefined && m in NAME;

/** One sentence about the owner's market for a claim finding, or nothing for "Other" and for claims that do not differ by market. */
export function marketNote(claim: Claim, market?: string): string | undefined {
  if (!isMarket(market)) return undefined;
  const where = NAME[market];
  if (claim === 'medical') {
    const otc = OTC_DISCLOSE.includes(market) ? ' (OTC medicines must also disclose safety and usage requirements)' : '';
    return `For ${where}: medical claims are not allowed on the ad or the landing page. Medicines, devices and supplements may be advertised only with approval from the local authority and 18+ targeting${otc}. TikTok's page also lists supplements as not allowed in one place, so confirm with your TikTok sales representative before advertising one.`;
  }
  if (claim === 'weight') {
    return WEIGHT_ALLOWED.includes(market)
      ? `For ${where}: weight loss supplements, meal replacements and surgery may be advertised only with age restrictions and the local licence (surgery also through a TikTok sales representative). The claims above stay banned.`
      : `For ${where}: TikTok's list of countries where weight loss supplements, meal replacements or surgery may be advertised does not include ${where}. Ask your TikTok sales representative before advertising weight loss products.`;
  }
  if (claim === 'before_after') return `For ${where}: before and after comparisons for medicines, devices and food supplements are also not allowed.`;
  return undefined;
}
