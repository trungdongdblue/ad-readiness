import type { Rule } from '../../domain/types';
import { currenciesShown, localCurrency } from '../../parsers/currency';
import { blocked, siteText, words } from '../../parsers/site';
import { companySignals, hasPrice, pageParsed, paymentSignals } from '../../parsers/trust';
import { NO_PAGE, SOURCE, SPARSE, unverifiable, usable } from './rules';

const reached = (phases: readonly { phase: string; reached: boolean }[], phase: string): boolean => phases.some((p) => p.phase === phase && p.reached);

/**
 * Who runs the store: a legal name, license or address, or just a brand in the copyright line or on a real About page.
 * Many stores are a brand, not a registered company, so this is a note and never costs points (severity stays info).
 */
export const companyInfo: Rule = (obs) => {
  const id = 'trust.company';
  const t = usable(obs);
  if (!t) return unverifiable(id, 'Company or brand identity', NO_PAGE);
  const found = companySignals({ links: t.links, text: siteText(t) });
  const id2 = t.identity;
  for (const [k, label] of [['company', 'company name'], ['brand', 'brand name'], ['address', 'address']] as const) if (id2?.[k]) found.push(`AI: ${label} "${id2[k]}"`);
  if (t.pages?.some((p) => p.kind === 'about' && !blocked(p) && (p.ai ? p.ai.covers.includes('about') : words(p.text) >= 60))) found.push('About page');
  if (found.length) return [{ id, title: 'Company or brand identity shown', status: 'detected', severity: 'info', evidence: found }];
  if (!t.pages) return unverifiable(id, 'Company or brand identity', 'the site crawl did not run, so only two pages were read');
  if (t.pages.some((p) => ['about', 'contact', 'terms'].includes(p.kind) && blocked(p))) return unverifiable(id, 'Company or brand identity', 'a page that usually holds it blocked the scanner');
  if (!pageParsed(t)) return unverifiable(id, 'Company or brand identity', SPARSE);
  return [{ id, title: 'No company or brand identity found', status: 'missing', severity: 'info', evidence: [`no brand or company name in the copyright line, no About page and no address in the footer or the ${t.pages.length} extra pages read`], fix: 'Say who runs the store: your brand or company name in the footer ("© 2026 Brand") and an About page. Add an address or license if you have one.' }];
};

/** A price needs a product page we reached and could read. Any currency code or symbol counts, not just a short list. */
export const priceShown: Rule = (obs) => {
  const id = 'trust.price';
  const t = usable(obs);
  if (!t) return unverifiable(id, 'Price display', NO_PAGE);
  if (hasPrice({ text: siteText(t) })) return [{ id, title: 'Price with currency shown', status: 'detected', severity: 'info', evidence: ['price next to a currency'] }];
  if (!reached(obs.phases, 'product')) return unverifiable(id, 'Price in local currency', 'no product page was reached, so no price could be read');
  return [{ id, title: 'No price with a currency found', status: 'missing', severity: 'minor', evidence: ['no price next to a currency on the landing or product page'], fix: `Show prices next to the currency, for example "AED 99". ${SOURCE}.` }];
};

/**
 * TikTok asks for prices in the target market's local currency (docs/MARKET-RULES.md). The scan runs from outside the country, so a store
 * may show us another currency than its shoppers see: this is a prompt to check, never a penalty (severity stays info), and silent when the local one is shown.
 */
export const priceCurrency: Rule = (obs, ctx) => {
  const local = localCurrency(ctx.market);
  const t = usable(obs);
  if (!local || !t) return [];
  const shown = currenciesShown(siteText(t));
  if (!shown.size || shown.has(local)) return [];
  const list = [...shown].join(', ');
  return [{
    id: 'trust.price_currency', title: `Prices shown in ${list}, not ${local}`, status: 'detected', severity: 'info',
    evidence: [`prices on the pages read are written in ${list}; the local currency for this market is ${local}`],
    fix: `TikTok asks for prices in the local currency of the target market (${local}). This scan runs from outside the country, so shoppers there may see something different: open the store from that country and check. If it shows ${list}, add ${local} prices.`,
  }];
};

/**
 * Not a TikTok requirement (docs/COMPLIANCE-RULES.md): a note, never a penalty (severity stays info).
 * The brands come from text, icon names, the pages we read and the first checkout screen.
 */
export const paymentInfo: Rule = (obs) => {
  const id = 'trust.payment';
  const t = usable(obs);
  if (!t) return unverifiable(id, 'Payment methods', NO_PAGE);
  const names = paymentSignals({ links: t.links, text: siteText(t) });
  if (names.length) return [{ id, title: 'Payment methods named before checkout', status: 'detected', severity: 'info', evidence: names }];
  if (!t.pages) return unverifiable(id, 'Payment methods', 'the site crawl did not run, so only two pages were read');
  return [{ id, title: 'No payment method named before checkout', status: 'missing', severity: 'info', evidence: ['none in the footer, the pages we read or the first checkout screen'], fix: 'Show the payment methods you accept (logos or text) in the footer.' }];
};
