import { PAGE_TYPES, SITE_IDENTITY_CHARS, SITE_PAGE_CHARS } from '../config/site';
import type { PageKind, SiteIdentity, TrustCapture, TrustPage } from '../domain/types';
import { isShopContent, sameSite, type Target } from './crawl';
import { condenseText } from './llm';

/** Pure helpers around the two site calls: shrink what we send, and accept only what can be checked against the site. */

const KINDS = PAGE_TYPES as readonly string[];
const MAX_PICKS_PER_TYPE = 2;
const MAX_QUOTE = 160;
const norm = (s: string): string => s.normalize('NFKC').toLowerCase().replace(/[\s​-‏]+/g, ' ').trim();
const clean = (s: string): string => s.replace(/[\r\n|<>]+/g, ' ').replace(/\s+/g, ' ').trim();

interface RawPick {
  type?: unknown;
  index?: unknown;
}

/** The model answers by link index; only real, same-site links survive, at most 2 per type, a link may serve two types. */
export function verifyPicks(raw: unknown, links: TrustCapture['links'], siteUrl: string): Target[] {
  if (!Array.isArray(raw)) return [];
  const out: Target[] = [];
  const perType = new Map<string, number>();
  const used = new Set<string>();
  for (const r of raw as RawPick[]) {
    const link = typeof r?.index === 'number' ? links[r.index] : undefined;
    const type = String(r?.type);
    if (!link || !KINDS.includes(type) || !sameSite(link.href, siteUrl) || isShopContent(link.href)) continue;
    const url = link.href.split('#')[0] as string;
    if (used.has(`${type}|${url}`) || (perType.get(type) ?? 0) >= MAX_PICKS_PER_TYPE) continue;
    used.add(`${type}|${url}`);
    perType.set(type, (perType.get(type) ?? 0) + 1);
    out.push({ kind: type as PageKind, url });
  }
  return out;
}

const path = (url: string): string => {
  try {
    const u = new URL(url);
    return u.pathname + u.hash;
  } catch {
    return url;
  }
};

/**
 * Menu and footer link names cut out of a page's text, wherever they sit: a footer like "Refund Policy Return Policy Shipping Policy" is
 * one long line that the whole-line menu filter cannot drop, and the model would read it as a page about those policies.
 */
export function withoutLinkNames(text: string, links: TrustCapture['links']): string {
  const names = [...new Set(links.map((l) => l.text.trim()).filter((t) => t.length >= 4))].sort((a, b) => b.length - a.length).slice(0, 400);
  return names.reduce((acc, name) => (acc.includes(name) ? acc.split(name).join(' ') : acc), text);
}

/** Pages that can be judged (they loaded), one condensed line each, then the identity text: footer plus the start of About and Contact. */
export function reviewInput(t: TrustCapture): { text: string; ids: TrustPage[] } {
  const ids = (t.pages ?? []).filter((p) => p.status > 0 && p.status < 400);
  const lines = ids.map((p, i) => `${i}|${p.kind}|${path(p.url)}|${p.status}|${clean(p.title ?? '').slice(0, 120)}|${clean(condenseText({ links: t.links, text: withoutLinkNames(p.text, t.links) }, SITE_PAGE_CHARS)) || '(no text)'}`);
  const about = (t.pages ?? []).filter((p) => (p.kind === 'about' || p.kind === 'contact') && p.status > 0 && p.status < 400).map((p) => condenseText({ links: t.links, text: withoutLinkNames(p.text, t.links) }, 700));
  const identity = [clean(t.footer ?? ''), ...about.map(clean)].join('\n').slice(0, SITE_IDENTITY_CHARS);
  return { text: `<pages>\n${lines.join('\n')}\n</pages>\n<identity>\n${identity}\n</identity>`, ids };
}

interface RawReview {
  pages?: { id?: unknown; covers?: unknown; sections?: unknown; substantial?: unknown }[];
  identity?: Record<string, unknown>;
}

/** Page verdicts keyed by page, and identity values that really occur in the site text. */
export function verifyReview(raw: unknown, ids: readonly TrustPage[], siteText: string): { verdicts: Map<TrustPage, NonNullable<TrustPage['ai']>>; identity: SiteIdentity } {
  const r = (raw ?? {}) as RawReview;
  const verdicts = new Map<TrustPage, NonNullable<TrustPage['ai']>>();
  for (const v of Array.isArray(r.pages) ? r.pages : []) {
    const page = typeof v?.id === 'number' ? ids[v.id] : undefined;
    if (!page || verdicts.has(page) || !Array.isArray(v.covers)) continue;
    const kinds = (x: unknown): PageKind[] => [...new Set((Array.isArray(x) ? x : []).filter((c): c is PageKind => typeof c === 'string' && KINDS.includes(c)))];
    const covers = kinds(v.covers);
    verdicts.set(page, { covers, sections: kinds(v.sections).filter((k) => !covers.includes(k)), substantial: v.substantial === true });
  }
  const hay = norm(siteText);
  const identity: SiteIdentity = {};
  for (const key of ['brand', 'company', 'address', 'phone', 'email'] as const) {
    const v = r.identity?.[key];
    const q = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
    if (q.length >= 3 && q.length <= MAX_QUOTE && hay.includes(norm(q))) identity[key] = q;
  }
  return { verdicts, identity };
}
