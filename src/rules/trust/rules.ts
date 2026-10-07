import type { Finding, Rule } from '../../domain/types';
import type { Observation, TrustCapture } from '../../domain/types';
import { blocked, policyState, siteText } from '../../parsers/site';
import { contactSignals, pageParsed, policySignals, unreadable, type Policy } from '../../parsers/trust';

export const NO_PAGE = 'page content missing, too short or blocked (bot wall, country picker?)';
export const SPARSE = 'too few links, or no footer-type links (About/Contact/FAQ), to trust a "missing" verdict (one-page store or footer not loaded?)';
export const SOURCE = 'TikTok requires it for e-commerce ads (Ad Format and Functionality, Apr 2026)';

/** The captured page only if it can be trusted at all. */
export const usable = (obs: Observation): TrustCapture | undefined => (obs.trust && !unreadable(obs.trust) ? obs.trust : undefined);

export const unverifiable = (id: string, what: string, why: string): Finding[] => [
  { id, title: `${what} could not be checked`, status: 'unverifiable', severity: 'info', evidence: [why] },
];

const path = (url: string): string => {
  try {
    const u = new URL(url);
    return (u.pathname || '/') + u.hash;
  } catch {
    return url;
  }
};

/**
 * One rule per policy. The crawl opens the page, so the answer is one of: a real page, a nearly empty page, a dead link, a mention
 * inside another page, or nothing. `unverifiable` is kept for what cannot be seen: a bot wall, an unreadable page, a crawl that did not run.
 */
const policyRule = (policy: Policy, id: string, what: string, fix: string): Rule => (obs) => {
  const t = usable(obs);
  if (!t) return unverifiable(id, what, NO_PAGE);
  const st = policyState(t, policy);
  const missing = (title: string, evidence: string[]): Finding[] => [{ id, title, status: 'missing', severity: 'major', evidence, fix: `${fix} ${SOURCE}.` }];
  switch (st.state) {
    case 'page': return [{ id, title: `${what} page found`, status: 'detected', severity: 'info', evidence: [`opened ${path(st.url)} (${st.words} words)`] }];
    case 'link': return [{ id, title: `${what} link found`, status: 'detected', severity: 'info', evidence: st.links }];
    case 'thin': return [{ id, title: `${what} page is almost empty`, status: 'detected', severity: 'minor', evidence: [`${path(st.url)} has only ${st.words} words`], fix: `Write the full ${what.toLowerCase()} on that page.` }];
    case 'dead': return missing(`${what} link leads to an error page`, [`${path(st.url)} answered ${st.status}`]);
    case 'unclear': return [{ id, title: `${what} link opens a different page`, status: 'detected', severity: 'minor', evidence: [`${path(st.url)} reads as: ${st.reads}`], fix: `Put the full ${what.toLowerCase()} on that page.` }];
    case 'blocked': return unverifiable(id, what, `${path(st.url)} blocked the scanner or loaded as a bot wall`);
    default: break;
  }
  // Only asked about when the keyword rules found nothing (any language the keyword list lacks). It can only turn a doubt into a find.
  const ai = obs.llm?.policyLinks.find((x) => x.policy === policy);
  if (ai) return [{ id, title: `${what} link found (identified by AI)`, status: 'detected', severity: 'info', evidence: [`AI: ${ai.text || '(no text)'} -> ${ai.href}`] }];
  if (st.state === 'section') return [{ id, title: `${what} only inside ${st.where}, no page of its own`, status: 'detected', severity: 'minor', evidence: [`found in ${st.where}`], fix }];
  if (!t.pages && policySignals(t, policy).hub) return unverifiable(id, what, 'only a general Policies/Legal page is linked; the site crawl did not run');
  if (t.pages?.some((p) => p.kind === 'hub' && blocked(p))) return unverifiable(id, what, 'the general Policies page blocked the scanner');
  if (!pageParsed(t)) return unverifiable(id, what, SPARSE);
  return missing(`${what} not found`, [t.pages ? `${t.pages.length} extra pages read and ${t.links.length} links on landing/product pages, none about it` : `${t.links.length} links on landing/product pages, none about it`]);
};

export const refundPolicy = policyRule('refund', 'trust.refund_policy', 'Return/refund policy', 'Add a return and refund policy page and link it in the footer.');
export const termsPolicy = policyRule('terms', 'trust.terms', 'Terms and conditions', 'Add a terms and conditions page and link it in the footer.');
export const privacyPolicy = policyRule('privacy', 'trust.privacy', 'Privacy policy', 'Add a privacy policy page and link it in the footer.');
export const shippingInfo = policyRule('shipping', 'trust.shipping', 'Shipping information', 'Add a shipping information page (cost, delivery time) and link it in the footer.');

/** Email or phone anywhere on the site (landing, product, contact page, footer of every crawled page), or only a way to write to the store. */
export const contactInfo: Rule = (obs) => {
  const id = 'trust.contact';
  const t = usable(obs);
  if (!t) return unverifiable(id, 'Contact information', NO_PAGE);
  const s = contactSignals({ links: t.links, text: siteText(t) });
  const direct = (['email', 'phone'] as const).filter((k) => s[k] || t.identity?.[k]);
  if (direct.length) return [{ id, title: 'Contact information found', status: 'detected', severity: 'info', evidence: direct }];
  const indirect = (['whatsapp', 'contactPage'] as const).filter((k) => s[k]);
  if (indirect.length) {
    return [{ id, title: 'Only indirect contact found (no phone or email on the page)', status: 'detected', severity: 'minor', evidence: indirect, fix: 'Show a telephone number or email address on the page.' }];
  }
  if (t.pages?.some((p) => p.kind === 'contact' && blocked(p))) return unverifiable(id, 'Contact information', 'the contact page blocked the scanner');
  if (!pageParsed(t)) return unverifiable(id, 'Contact information', SPARSE);
  return [{ id, title: 'Contact information not found', status: 'missing', severity: 'major', evidence: [`${t.pages?.length ?? 0} extra pages read and ${t.links.length} links on landing/product pages, no phone, email, WhatsApp or contact page`], fix: `Show a telephone number or email address. ${SOURCE}.` }];
};
