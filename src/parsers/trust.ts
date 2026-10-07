import type { TrustCapture } from '../domain/types';

/** Below this many distinct links we cannot trust an "absent" verdict (one-page store, late footer). Real stores had 200-1700. */
const MIN_LINKS = 30;
/** Below this much text the page is a country picker, empty shell or bot wall: nothing about it can be trusted. */
const MIN_TEXT = 500;
const CHALLENGE = /security verification|verify (that )?you are (a )?human|just a moment|attention required|access denied|captcha|checking your browser/i;
/** Left over at the end of a long page when a bot wall is still on top of it (seen on ishopping.pk, 37k chars of text). */
const CHALLENGE_OVERLAY = /performance (and|&) security by cloudflare/i;
/** Link text every footer has. With none of these the footer did not load, so "no policy link" proves nothing. */
const FOOTER_HINT = /about|contact|faq|help|support|track|store locator|careers|blog|sitemap|حول|اتصل|رابطہ/i;

export type Policy = 'refund' | 'terms' | 'privacy' | 'shipping';

/** link = footer link text, path = URL path, body = a phrase in page text that names the policy (not just "free shipping"). */
export const POLICY: Record<Policy, { link: RegExp; path: RegExp; body: RegExp }> = {
  refund: {
    link: /refund|returns? (policy|&|and|\/)|^returns?$|exchange|money[- ]?back|استرجاع|استرداد|إرجاع|ارجاع|ریفنڈ|واپسی/i,
    path: /refund|return|exchange|money-?back/i,
    body: /refund|returns? (policy|&|and|\/)|exchange polic|money[- ]?back|استرجاع|استرداد|إرجاع|ارجاع|ریفنڈ|واپسی/i,
  },
  terms: {
    link: /terms|conditions|^tos$|الشروط|الأحكام|شرائط|ضوابط/i,
    path: /terms|conditions|(^|[/-])tos([/-]|$)/i,
    body: /terms (of (service|use|sale)|&|and) ?(conditions)?|الشروط والأحكام|شرائط و ضوابط/i,
  },
  privacy: {
    link: /privacy|الخصوصية|رازداری|پرائیویسی/i,
    path: /privacy/i,
    body: /privacy (policy|notice)|سياسة الخصوصية|رازداری کی پالیسی/i,
  },
  shipping: {
    link: /shipping|delivery|الشحن|التوصيل|التسليم|شپنگ|ڈیلیوری/i,
    path: /shipping|delivery/i,
    body: /shipping (policy|information|info|&|and|times|rates?|costs?|fees?|charges?|methods?|options?)|delivery (policy|information|info|times|rates?|costs?|fees?|charges?|options?)|الشحن والتوصيل/i,
  },
};

/** A general "Policies" / "Legal" page: probably holds the policies, but we do not open it. */
export const HUB_TEXT = /^(terms (&|and) )?(policies|legal)( (&|and) (policies|legal))?$/i;
export const HUB_PATH = /\/(policies|legal)\/?$/i;

export const CONTACT_TEXT = /contact|support|اتصل|تواصل|رابطہ/i;
const EMAIL_TEXT = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_TEXT = /(?:\+|00)\d[\d\s().-]{8,}\d|(?:tel|phone|call|hotline|mobile|whatsapp|هاتف|واتساب|فون)\D{0,15}\+?\d[\d\s().-]{6,}/i;
const WHATSAPP_HOST = /(^|\.)(wa\.me|wa\.link|whatsapp\.com)$/i;

const CUR = '[$€£₹]|USD|EUR|GBP|PKR|AED|SAR|IQD|INR|EGP|QAR|KWD|OMR|BHD|E£|LE|SR|Dhs?|[Rr]s\\.?|د\\.إ|ر\\.س|د\\.ع|ج\\.م|جنيه|ريال|درهم';
const PRICE = new RegExp(`(?<![A-Za-z])(?:${CUR})\\s?\\d[\\d.,]*|\\d[\\d.,]*\\s?(?:${CUR})(?![A-Za-z])`);

const COD = /cash on delivery|\bCOD\b|الدفع عند الاستلام|کیش آن ڈیلیوری/i;
const BRANDS = /visa|mastercard|paypal|apple pay|google pay|stripe|jazzcash|easypaisa|mada|knet|tabby|tamara|zain ?cash/gi;

// Company identity. Strict on purpose: "Limited" alone matches "limited time", "(c) Store Name" is the brand not the company.
const LEGAL_NAME = /(?<![A-Za-z])(LLC|L\.L\.C|Ltd|Pvt|Pty|Inc|GmbH|FZE|FZCO|FZ-LLC)(?![A-Za-z])/;
const LICENSE = /business licen[sc]e|trade licen[sc]e|commercial regist|company (number|no\b|reg)|registered (in|office|address|number)|\b(VAT|TRN|NTN|STRN)\b|\bCR ?(no|number)|رخصة تجارية|سجل تجاري|الرقم الضريبي/i;
/** "© 2026 | Gymshark Limited": a capitalised name right after the copyright mark and ending in a company word. A bare "© Brand" is still just the brand. */
const COPYRIGHT_ENTITY = /(?:©|\(c\)|copyright)\s*(?:\d{4}\s*[|,.–-]*\s*)?(?:[A-Z][\w&'.-]*\s+){1,4}(?:Limited|Corporation|Corp|Company|Co\.|Holdings|Group|Trading)(?![A-Za-z])/;
/** "© 2026 Brand": a store that is a brand, not a registered company, still says who it is. "All rights reserved" alone names nobody. */
const COPYRIGHT_BRAND = /(?:©|\(c\)|copyright)\s*(?:\d{4}\s*[|,.–-]*\s*)?(?!all rights)\p{L}[\p{L}\d&'.-]*(?:\s+[\p{L}\d&'.-]+){0,3}/iu;
const ADDRESS = /P\.?O\.? ?Box|\b\d{1,5}[ ,]+[A-Za-z0-9 .'-]{2,40}\b(Street|St|Road|Rd|Avenue|Ave|Blvd|Lane)\b|شارع|روڈ/i;

export const parts = (href: string): { host: string; path: string } => {
  try {
    const u = new URL(href);
    return { host: u.hostname, path: u.pathname + u.hash };
  } catch {
    return { host: '', path: '' };
  }
};
const show = (l: { text: string; href: string }): string => `${l.text || '(no text)'} -> ${parts(l.href).path || l.href}`;

export const pageParsed = (t: TrustCapture): boolean => t.links.length >= MIN_LINKS && t.links.some((l) => FOOTER_HINT.test(l.text));

/** Empty shell, country picker or bot wall: every verdict about the page would be a guess. */
export const botWall = (text: string): boolean => CHALLENGE_OVERLAY.test(text) || (text.length < 3_000 && CHALLENGE.test(text));
export const unreadable = (t: TrustCapture): boolean => t.text.length < MIN_TEXT || botWall(t.text);

export function policySignals(t: TrustCapture, p: Policy): { links: string[]; inText: boolean; hub: boolean } {
  const re = POLICY[p];
  const hits = t.links.filter((l) => re.link.test(l.text.trim()) || re.path.test(parts(l.href).path));
  const hub = t.links.some((l) => HUB_TEXT.test(l.text.trim()) || HUB_PATH.test(parts(l.href).path));
  return { links: hits.slice(0, 3).map(show), inText: re.body.test(t.text), hub };
}

/** Policies the keyword rules found nothing for (no link, no mention, no general Policies page): the only ones worth asking the model about. */
export const unresolvedPolicies = (t: TrustCapture): Policy[] =>
  (Object.keys(POLICY) as Policy[]).filter((p) => {
    const s = policySignals(t, p);
    return !s.links.length && !s.inText && !s.hub;
  });

export function contactSignals(t: TrustCapture): { email: boolean; phone: boolean; whatsapp: boolean; contactPage: boolean } {
  const hrefs = t.links.map((l) => l.href);
  return {
    email: EMAIL_TEXT.test(t.text) || hrefs.some((h) => h.startsWith('mailto:') || h.includes('/cdn-cgi/l/email-protection')),
    phone: PHONE_TEXT.test(t.text) || hrefs.some((h) => h.startsWith('tel:')),
    whatsapp: hrefs.some((h) => WHATSAPP_HOST.test(parts(h).host)),
    contactPage: t.links.some((l) => CONTACT_TEXT.test(l.text) || /contact/i.test(parts(l.href).path)),
  };
}

/** Any currency written as a 3-letter code, or a number after the word "price": the fixed list above must not decide that a price is missing. */
const PRICE_ANY = /(?<![A-Za-z])[A-Z]{3}\s?\d[\d.,]*|\d[\d.,]*\s?[A-Z]{3}(?![A-Za-z])|(?:price|سعر|قیمت|prix)\D{0,12}\d/i;
export const hasPrice = (t: Pick<TrustCapture, 'text'>): boolean => PRICE.test(t.text) || PRICE_ANY.test(t.text);

export function paymentSignals(t: TrustCapture): string[] {
  const names = new Set((t.text.match(BRANDS) ?? []).map((m) => m.toLowerCase()));
  if (COD.test(t.text)) names.add('cod');
  return [...names];
}

export function companySignals(t: TrustCapture): string[] {
  const out: string[] = [];
  if (LEGAL_NAME.test(t.text) || COPYRIGHT_ENTITY.test(t.text)) out.push('legal entity name');
  if (LICENSE.test(t.text)) out.push('license/registration/tax id');
  if (ADDRESS.test(t.text)) out.push('address');
  if (!out.length && COPYRIGHT_BRAND.test(t.text)) out.push('brand name in the copyright line');
  return out;
}
