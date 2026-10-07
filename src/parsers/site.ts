import type { PageKind, TrustCapture, TrustPage } from '../domain/types';
import { POLICY, botWall, policySignals, type Policy } from './trust';

/** What the whole crawled site says, as plain facts the trust rules can judge. Pure. */

const MIN_WORDS = 60;
/** Facts a shipping section states even without the word "policy": "ships in 3-5 business days". */
const SHIPPING_FACT = /(ships?|shipped|delivered|delivery|shipping)[^.\n]{0,40}\d+\s?(-|to|–)?\s?\d*\s?(business |working )?(days?|hours?|أيام|يوم)/i;

export const words = (s: string): number => (s.match(/\S+/g) ?? []).length;

/** Opened but unreadable: a bot wall, a challenge page, or a server that refused us. We cannot judge what is behind it. */
export const blocked = (p: TrustPage): boolean => p.status === 0 || p.status === 403 || p.status === 429 || p.status >= 500 || botWall(p.text);
const gone = (p: TrustPage): boolean => p.status === 404 || p.status === 410;

/** Everything readable on the site: landing and product text, then every crawled page. */
export const siteText = (t: TrustCapture): string => [t.text, ...(t.pages ?? []).filter((p) => !blocked(p) && !gone(p)).map((p) => `${p.text} ${p.hints ?? ''}`)].join('\n');

export type PolicyState =
  | { state: 'page'; url: string; words: number }
  | { state: 'thin'; url: string; words: number }
  | { state: 'unclear'; url: string; reads: string }
  | { state: 'dead'; url: string; status: number }
  | { state: 'blocked'; url: string }
  | { state: 'section'; where: string }
  | { state: 'link'; links: string[] }
  | { state: 'none' };

const WHERE: Partial<Record<PageKind, string>> = { faq: 'the FAQ page', about: 'the About page', contact: 'the Contact page', hub: 'the Policies page', terms: 'the Terms page', shipping: 'the Shipping page', refund: 'the Returns page', privacy: 'the Privacy page' };

const SHARED: readonly PageKind[] = ['faq', 'about', 'contact'];
/** Where a policy most plausibly lives when several pages have a section on it: the FAQ, then other policy pages, then Terms and Privacy. */
const HOME: Record<PageKind, number> = { faq: 0, hub: 1, refund: 1, shipping: 1, terms: 2, privacy: 2, contact: 3, about: 3 };

/**
 * Where a policy lives on the site: its own page, a link we did not open, a section of another page, or nowhere.
 * When the AI reviewed the pages, its reading of a page decides what the page covers; otherwise the word count and keyword lists do.
 * A section is only looked for when no link names the policy: otherwise every page's footer repeats the link text and "finds" it.
 */
export function policyState(t: TrustCapture, policy: Policy): PolicyState {
  const pages = t.pages ?? [];
  const ok = (p: TrustPage): boolean => !blocked(p) && !gone(p);

  // The AI read a page that really covers this policy: wherever the link was filed (a "Shipping & Returns" page covers both).
  const covering = pages.filter((p) => ok(p) && p.ai?.covers.includes(policy)).sort((a, b) => Number(SHARED.includes(a.kind) || !!a.sectionOf) - Number(SHARED.includes(b.kind) || !!b.sectionOf) || words(b.text) - words(a.text))[0];
  if (covering?.ai) {
    // A footer link named for the policy ('Exchange & Returns') that lands on a full section of a guide page is a policy page to the shopper.
    if (covering.sectionOf && !covering.ai.substantial) return { state: 'thin', url: covering.url, words: words(covering.text) };
    if (covering.sectionOf) return { state: 'page', url: covering.url, words: words(covering.text) };
    if (SHARED.includes(covering.kind) && covering.kind !== policy) return { state: 'section', where: WHERE[covering.kind] ?? 'another page' };
    return covering.ai.substantial ? { state: 'page', url: covering.url, words: words(covering.text) } : { state: 'thin', url: covering.url, words: words(covering.text) };
  }

  const own = pages.filter((p) => p.kind === policy);
  const unreviewed = own.filter((p) => ok(p) && !p.ai).sort((a, b) => words(b.text) - words(a.text))[0];
  if (unreviewed) return words(unreviewed.text) >= MIN_WORDS ? { state: 'page', url: unreviewed.url, words: words(unreviewed.text) } : { state: 'thin', url: unreviewed.url, words: words(unreviewed.text) };
  const dead = own.find(gone);
  if (dead) return { state: 'dead', url: dead.url, status: dead.status };
  const wall = own.find(blocked);
  if (wall) return { state: 'blocked', url: wall.url };

  // A page the AI read as having a real section on this policy (a Terms page with a Delivery section, a FAQ answer with charges).
  const sectionIn = pages.filter((p) => ok(p) && p.ai?.sections?.includes(policy)).sort((a, b) => HOME[a.kind] - HOME[b.kind])[0];
  const inSection = (): PolicyState | undefined => (sectionIn ? { state: 'section', where: WHERE[sectionIn.kind] ?? 'another page' } : undefined);
  // The link led to a page the AI does not read as this policy (a returns portal, a form, a stub, a page filed under the wrong policy).
  const rejected = own.find((p) => ok(p) && p.ai);
  if (rejected) return inSection() ?? { state: 'unclear', url: rejected.url, reads: rejected.ai?.covers.join(', ') || 'no policy content' };

  const links = policySignals(t, policy).links;
  if (links.length) return { state: 'link', links };
  const found = inSection();
  if (found) return found;

  // Keyword fallback for pages the AI did not review, and for the landing page text. A page the AI did review is judged by its sections.
  const re = POLICY[policy].body;
  const says = (text: string): boolean => re.test(text) || (policy === 'shipping' && SHIPPING_FACT.test(text));
  const host = pages.find((p) => ok(p) && !p.ai && says(p.text));
  if (host) return { state: 'section', where: WHERE[host.kind] ?? 'another page' };
  return says(t.text) ? { state: 'section', where: 'the landing or product page' } : { state: 'none' };
}
