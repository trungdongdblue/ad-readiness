import type { Locator, Page } from 'playwright';
import { ADD_TO_CART_RE } from '../config/constants';

/** Anything that is not the product itself: other products' cards, sliders, menus, dialogs. Their buttons and options must not be used. */
export const NOT_MAIN = '[data-card-url],[class*="card" i],[class*="recommend" i],[class*="related" i],[class*="carousel" i],[class*="swiper" i],[class*="slider" i],header,nav,footer,dialog,[role=dialog],[role=navigation],[aria-modal=true]';

/**
 * The Add to cart button of the product on this page. Pages often hold many (a quick-add on every recommended product), and the
 * first one in the document can belong to another product: found by ignoring cards, menus and sliders, then taking the one
 * closest to the page title, with a real "add" button before a "buy now" one. Anything that looks clickable counts, not only a <button>:
 * on mobile, outfitters.com.pk shows a styled <div> and keeps the real button hidden. A string for the same reason as in options.ts.
 */
const FIND_JS = (re: string, notMain: string): string => `(() => {
  const RE = new RegExp(${JSON.stringify(re)}, 'i');
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const label = (e) => (e.getAttribute('aria-label') || e.textContent || e.value || '').replace(/\\s+/g, ' ').trim();
  const up = (e) => { const a = []; for (let n = e; n; n = n.parentElement) a.push(n); return a; };
  const h1 = [...document.querySelectorAll('h1')].find(vis);
  const dist = (e) => { if (!h1) return 0; const a = up(e); const b = up(h1); const k = a.findIndex((n) => b.includes(n)); return k < 0 ? 999 : k + b.indexOf(a[k]); };
  document.querySelectorAll('[data-adr-atc]').forEach((e) => e.removeAttribute('data-adr-atc'));
  const clickable = (e) => /^(button|a|input)$/i.test(e.tagName) || e.getAttribute('role') === 'button' || getComputedStyle(e).cursor === 'pointer';
  const scored = [...document.querySelectorAll('*')]
    .filter((e) => label(e).length <= 40 && RE.test(label(e)) && vis(e) && clickable(e) && !e.closest(${JSON.stringify(notMain)}))
    .map((e) => ({ e, s: dist(e) + (/buy|order now|اشتر|اطلب/i.test(label(e)) && !/add/i.test(label(e)) ? 100 : 0) - (e.closest('form[action*="/cart/add"]') ? 50 : 0) }))
    .sort((x, y) => x.s - y.s);
  if (!scored.length) return false;
  scored[0].e.setAttribute('data-adr-atc', '1');
  return true;
})()`;

export async function mainAddToCart(page: Page): Promise<Locator | undefined> {
  const found = await page.evaluate(FIND_JS(ADD_TO_CART_RE.source, NOT_MAIN)).catch(() => false);
  return found ? page.locator('[data-adr-atc]').first() : undefined;
}
