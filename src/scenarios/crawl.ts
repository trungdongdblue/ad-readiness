import type { Page } from 'playwright';
import type { ScanSession } from '../collectors/browser-session';
import { assertSafeUrl } from '../collectors/url-guard';
import type { TrustCapture, TrustPage } from '../domain/types';
import { classify, pickTargets, type Target } from '../parsers/crawl';
import { readPage } from './trust';

/** Pages opened per scan. Each costs 2 to 5 s; the scan has a time budget. */
const MAX_PAGES = 16;
const MAX_FIRST_LEVEL = 8;
const PAGE_TIMEOUT_MS = 15_000;
const BUDGET_MS = 90_000;
const MAX_TEXT = 20_000;

/** Text of the sections a page's own links point into (/guide#returns), found by id. Empty when the id is not there. */
async function sections(page: Page, hashes: string[]): Promise<string[]> {
  return page.evaluate(
    // No named inner functions here: tsx/esbuild injects a `__name` helper that does not exist in the page.
    (ids) => ids.map((id) => {
      const el = document.getElementById(id) ?? document.getElementsByName(id)[0];
      if (!el) return '';
      let text = (el as HTMLElement).innerText ?? '';
      let next = el.nextElementSibling as HTMLElement | null;
      // A bare heading holds no text: the section is what follows it.
      while (text.length < 600 && next && !(next.id && ids.includes(next.id))) {
        text += `\n${next.innerText ?? ''}`;
        next = next.nextElementSibling as HTMLElement | null;
      }
      return text.slice(0, 4_000);
    }),
    hashes,
  ).catch(() => []);
}

async function open(page: Page, t: Target, allowPrivate: boolean | undefined, anchors: TrustCapture['links']): Promise<{ pages: TrustPage[]; links: TrustCapture['links'] }> {
  const failed = { pages: [{ kind: t.kind, url: t.url, status: 0, text: '' }], links: [] };
  try {
    const url = await assertSafeUrl(t.url, { allowPrivate });
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
    // A redirect can leave the site for a private address; the first check only saw the link.
    await assertSafeUrl(page.url(), { allowPrivate });
    const read = await readPage(page, false);
    const status = res?.status() ?? 0;
    const main: TrustPage = { kind: t.kind, url: page.url(), status, text: read.text.slice(0, MAX_TEXT), hints: read.hints.slice(0, 2_000), title: read.title };
    // Several footer links often open one guide page at different #sections: read each section as if it were a page of its own.
    const hashes = [...new Set(anchors.map((l) => decodeURIComponent(l.href.split('#')[1] ?? '')).filter(Boolean))].slice(0, 6);
    const texts = status > 0 && status < 400 && hashes.length ? await sections(page, hashes) : [];
    const parts = anchors.flatMap((l) => {
      const hash = decodeURIComponent(l.href.split('#')[1] ?? '');
      const text = texts[hashes.indexOf(hash)] ?? '';
      const kind = classify({ text: l.text, href: l.href.split('#')[0] as string });
      return kind && text.length >= 40 ? [{ kind, url: `${page.url().split('#')[0]}#${hash}`, status, text, title: l.text, sectionOf: t.kind } satisfies TrustPage] : [];
    });
    return { pages: [main, ...parts], links: read.links };
  } catch {
    return failed;
  }
}

/**
 * Opens the policy, contact, about and FAQ pages the store links to, and reads them. A general Policies page is opened too, and the
 * policy pages it links to after it. Runs on its own tab with recording off, so nothing it loads counts as funnel evidence.
 * Read only: no forms, no clicks (hard rule 2). Every address passes assertSafeUrl (hard rule 3).
 */
/** `preferred`: the pages the AI picked. They are opened first and decide a page's kind; the keyword picks follow and fill what the AI left out. */
export async function crawlSite(session: ScanSession, trust: TrustCapture, siteUrl: string, allowPrivate?: boolean, preferred: readonly Target[] = []): Promise<TrustPage[]> {
  const started = Date.now();
  const pages: TrustPage[] = [];
  const seen = new Set<string>();
  session.record = false;
  const tab = await session.context.newPage();
  try {
    const queue: Target[] = [...preferred];
    for (const t of pickTargets(trust.links, siteUrl, MAX_FIRST_LEVEL)) if (!queue.some((q) => q.url === t.url)) queue.push(t);
    while (queue.length && pages.length < MAX_PAGES && Date.now() - started < BUDGET_MS) {
      const target = queue.shift() as Target;
      if (seen.has(target.url)) continue;
      seen.add(target.url);
      const anchors = trust.links.filter((l) => l.href.includes('#') && l.href.split('#')[0] === target.url);
      const { pages: opened, links } = await open(tab, target, allowPrivate, anchors);
      pages.push(...opened);
      const page = opened[0] as TrustPage;
      // One level deeper, only from a Policies hub: its links are the real refund, terms, privacy and shipping pages.
      if (target.kind === 'hub' && page.status > 0 && page.status < 400) {
        const have = new Set(pages.map((p) => p.kind));
        for (const next of pickTargets(links, siteUrl, 4, seen)) if (next.kind !== 'hub' && !have.has(next.kind) && !queue.some((q) => q.kind === next.kind)) queue.push(next);
      }
    }
  } finally {
    await tab.close().catch(() => undefined);
    session.record = true;
  }
  return pages;
}
