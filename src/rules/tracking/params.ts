import type { Finding, Rule } from '../../domain/types';
import { SUPPORTED_CURRENCIES } from './currencies';

const CHECKED = new Set(['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'PlaceAnOrder', 'AddPaymentInfo']);
const hasContent = (p: Record<string, unknown>): boolean => ['content_id', 'content_ids', 'contents'].some((k) => k in p);

/**
 * Only judge parameters we can trust: ttq-hook args (exact) or network params that decoded non-empty.
 * Empty network params are treated as "unknown", never as "missing".
 */
export const paramRules: Rule = (obs, ctx) => {
  const subjects = obs.events.filter((e) => CHECKED.has(e.name) && e.source !== 'static' && (e.source === 'ttq-hook' || Object.keys(e.params).length > 0));
  const out: Finding[] = [];
  const bad = {
    value: new Set<string>(), pair: new Set<string>(), currency: new Set<string>(), type: new Set<string>(), content: new Set<string>(),
  };

  for (const e of subjects) {
    const p = e.params;
    const hasValue = p.value !== undefined && p.value !== '';
    const hasCurrency = typeof p.currency === 'string' && p.currency !== '';
    if (hasValue && !(typeof p.value === 'number' ? p.value > 0 : /^\d+(\.\d+)?$/.test(String(p.value)) && Number(p.value) > 0)) bad.value.add(e.name);
    if (hasValue !== hasCurrency) bad.pair.add(e.name);
    if (hasCurrency && !SUPPORTED_CURRENCIES.has(String(p.currency).toUpperCase())) bad.currency.add(String(p.currency).toUpperCase());
    if (p.content_type !== undefined && p.content_type !== 'product' && p.content_type !== 'product_group') bad.type.add(e.name);
    if (!hasContent(p) && (e.name === 'ViewContent' || e.name === 'AddToCart')) bad.content.add(e.name);
  }

  if (bad.value.size) out.push({ id: 'params.value', title: 'value must be a number greater than 0', status: 'detected', severity: 'major', evidence: [...bad.value], fix: 'Send value as a plain number (e.g. 12.34): no currency symbol, comma or text.' });
  if (bad.pair.size) out.push({ id: 'params.value_currency_pair', title: 'value and currency must be sent together', status: 'detected', severity: 'major', evidence: [...bad.pair], fix: 'Add the missing parameter; both are required to compute ROAS.' });
  if (bad.currency.size) {
    const iqd = bad.currency.has('IQD') || ctx.market === 'IQ';
    out.push({
      id: 'params.currency_supported', title: 'currency code not in TikTok supported list', status: 'detected', severity: 'major', evidence: [...bad.currency],
      fix: iqd ? 'IQD is not in the supported list (checked 2026-03). Send a supported currency such as USD and convert the value.' : 'Use a supported ISO currency code.',
    });
  }
  if (bad.type.size) out.push({ id: 'params.content_type', title: 'content_type must be product or product_group', status: 'detected', severity: 'minor', evidence: [...bad.type], fix: 'Set content_type to "product" (SKU ids) or "product_group".' });
  if (bad.content.size) out.push({ id: 'params.content_ids', title: 'content_ids missing', status: 'detected', severity: 'minor', evidence: [...bad.content], fix: 'Send content_ids (note the trailing "s") or contents for catalog matching.' });
  return out;
};
