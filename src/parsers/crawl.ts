import type { PageKind, TrustCapture } from '../domain/types';
import { CONTACT_TEXT, HUB_PATH, HUB_TEXT, POLICY, parts, type Policy } from './trust';

/** Pure part of the site crawl: which links are worth opening. The browser part is scenarios/crawl.ts. */

const ABOUT = { text: /^(about( us)?|our story|who we are|company|من نحن|ہمارے بارے)/i, path: /\/(about|our-story|who-we-are)/i };
const FAQ = { text: /^(faqs?|help( center| centre)?|frequently asked|الأسئلة|سوالات)/i, path: /\/(faqs?|help)(\/|$)/i };
const FILE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4)$/i;
/** Order matters: "Shipping & Returns" is read as a refund page first. */
const POLICIES: readonly Policy[] = ['refund', 'privacy', 'terms', 'shipping'];

export const bareHost = (host: string): string => host.toLowerCase().replace(/^www\./, '');

export function sameSite(href: string, siteUrl: string): boolean {
  const { host } = parts(href);
  const site = bareHost(parts(siteUrl).host);
  const h = bareHost(host);
  return /^https?:/i.test(href) && !!host && !FILE.test(parts(href).path) && (h === site || h.endsWith(`.${site}`));
}

/** Products, collections and blog posts are never policy pages, whatever words their names hold ("Contact Lens Case", "Return of the Mac"). */
export const isShopContent = (href: string): boolean => /^\/(collections?|products?|blogs?|cart|account|search|category|categories)(\/|$)/i.test(parts(href).path);

export function classify(l: { text: string; href: string }): PageKind | undefined {
  const text = l.text.trim();
  const { path } = parts(l.href);
  if (isShopContent(l.href)) return undefined;
  for (const p of POLICIES) if (POLICY[p].link.test(text) || POLICY[p].path.test(path)) return p;
  if (HUB_TEXT.test(text) || HUB_PATH.test(path)) return 'hub';
  if (CONTACT_TEXT.test(text) || /\/contact/i.test(path)) return 'contact';
  if (ABOUT.text.test(text) || ABOUT.path.test(path)) return 'about';
  if (FAQ.text.test(text) || FAQ.path.test(path)) return 'faq';
  return undefined;
}

export interface Target {
  kind: PageKind;
  url: string;
}

/**
 * One page per kind from the site's own links (same host or a subdomain), without the #hash so a link into a section opens the whole page.
 * `skip` holds URLs already opened. Capped, because a scan has a time budget.
 */
export function pickTargets(links: TrustCapture['links'], siteUrl: string, max: number, skip: ReadonlySet<string> = new Set()): Target[] {
  const out = new Map<PageKind, Target>();
  for (const l of links) {
    if (!sameSite(l.href, siteUrl)) continue;
    const kind = classify(l);
    const url = l.href.split('#')[0] as string;
    if (!kind || out.has(kind) || skip.has(url)) continue;
    out.set(kind, { kind, url });
    if (out.size >= max) break;
  }
  return [...out.values()];
}
