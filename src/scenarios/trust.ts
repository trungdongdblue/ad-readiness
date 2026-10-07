import type { Page } from 'playwright';
import type { TrustCapture } from '../domain/types';

export interface PageRead {
  links: TrustCapture['links'];
  /** What a shopper sees (page and iframes). */
  text: string;
  /** Icon names and mailto/tel links. */
  hints: string;
  title: string;
  footer: string;
}

/**
 * Visible text, link list and the names hidden in icons. `scroll` goes to the bottom first: footers are often built only once they
 * scroll into view. Anchors without href count too: many stores open Privacy/Terms in a JS modal (seen on allbirds.com), href is then ''.
 */
export async function readPage(page: Page, scroll: boolean): Promise<PageRead> {
  if (scroll) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
  }
  // No named inner functions here: tsx/esbuild injects a `__name` helper that does not exist in the page.
  const now = await page.evaluate(() => ({
    // Footer links first, then the rest, without repeats: a mega menu can hold 1,000+ anchors (telemart.pk, outfitters.com.pk) and the
    // policy links sit after them, so a plain "first 400" cut them off.
    links: (() => {
      const seen = new Set<string>();
      return [...document.querySelectorAll('footer a, [role=contentinfo] a'), ...document.querySelectorAll('a')]
        .map((a) => ({ text: (a.textContent ?? '').trim().slice(0, 80), href: (a as HTMLAnchorElement).href }))
        .filter((l) => (seen.has(`${l.href}|${l.text}`) ? false : (seen.add(`${l.href}|${l.text}`), true)))
        .slice(0, 800);
    })(),
    text: `${document.body.innerText} ${[...document.querySelectorAll('img[alt],img[title]')].map((i) => `${i.getAttribute('alt') ?? ''} ${i.getAttribute('title') ?? ''}`).join(' ')}`.slice(0, 60_000),
    // Payment logos in footers are mostly inline SVG or CSS icons: innerText skips them, but their title, label, file name or class names a brand.
    icons: [...document.querySelectorAll('footer svg title, footer use, footer img, footer [aria-label], [class*="payment" i] *')]
      .slice(0, 200)
      .map((e) => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('href') ?? e.getAttribute('xlink:href'), e.getAttribute('src'), typeof e.className === 'string' ? e.className : '', e.localName === 'title' ? e.textContent : ''].filter(Boolean).join(' ').slice(0, 120))
      .join(' '),
    footer: ((document.querySelector('footer, [role=contentinfo]') as HTMLElement | null)?.innerText ?? document.body.innerText.slice(-1_200)).slice(-1_500),
    title: `${document.title} | ${(document.querySelector('h1') as HTMLElement | null)?.innerText ?? ''}`.slice(0, 160),
    // mailto: and tel: links carry the contact details even when the page shows only an icon.
    contacts: [...document.querySelectorAll('a[href^="mailto:"],a[href^="tel:"]')].slice(0, 10).map((a) => (a as HTMLAnchorElement).href).join(' '),
  }));
  if (scroll) await page.evaluate(() => window.scrollTo(0, 0));
  // Help centers and policy widgets (Gorgias, Zendesk, Shopify apps) render inside an iframe that innerText of the page does not include.
  const framed: string[] = [];
  for (const f of page.frames().filter((x) => x !== page.mainFrame()).slice(0, 4)) {
    framed.push(await f.evaluate(() => (document.body?.innerText ?? '').slice(0, 20_000)).catch(() => ''));
  }
  return { links: now.links, footer: now.footer, text: `${now.text}\n${framed.join('\n')}`, hints: `${now.icons} ${now.contacts}`, title: now.title };
}

/** Reads the current page and merges it into `prev`. Never throws: trust data must not break the funnel scan. */
export async function collectTrust(page: Page, prev?: TrustCapture): Promise<TrustCapture | undefined> {
  try {
    const now = await readPage(page, true);
    const links = new Map([...(prev?.links ?? []), ...now.links].map((l) => [`${l.href}|${l.text}`, l]));
    return { links: [...links.values()], text: `${prev?.text ?? ''} ${now.text} ${now.hints}`, footer: prev?.footer ?? now.footer, pages: prev?.pages };
  } catch {
    return prev;
  }
}
