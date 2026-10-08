import type { Locator, Page, Response } from 'playwright';
import type { PhaseResult } from '../domain/types';
import { mainAddToCart } from '../collectors/main-button';
import { ADD_TO_CART_RE } from '../config/constants';
import { inspectButton } from './buy-button';
import { settle } from './helpers';
import { recover } from './options';
import type { Step, StepContext } from './types';

/** A 2xx on a cart-add endpoint is our proof the click really added an item. */
const CART_ADD_RE = /\/cart\/add|add[-_]to[-_]cart|wc-ajax=add_to_cart|\/cart\/(change|update)/i;
/** Time for trying further products after the first one failed. */
const STEP_BUDGET_MS = 60_000;
/** The button itself says there is nothing to buy: do not look for options, go to the next product. */
const SOLD_OUT_RE = /sold out|out of stock|currently unavailable|notify me|نفد|غير متوفر/i;

/** One product page: click Add to cart, choose an option when the store insists, and say whether a cart-add response was seen. */
async function tryProduct(ctx: StepContext, page: Page, seen: { added: boolean }): Promise<PhaseResult> {
  const main = await mainAddToCart(page);
  const candidates = [
    ...(main ? [main] : []),
    page.locator('form[action*="/cart/add"] [type=submit], button[name="add"]').first(),
    page.getByRole('button', { name: ADD_TO_CART_RE }).first(),
    page.getByRole('link', { name: ADD_TO_CART_RE }).first(),
  ];
  const click = async (c: Locator): Promise<boolean> => {
    seen.added = false;
    await c.click({ timeout: 5_000 });
    for (let i = 0; i < 24 && !seen.added; i++) await page.waitForTimeout(250);
    await page.waitForTimeout(2_500);
    return seen.added;
  };
  for (const c of candidates) {
    if (!(await c.isVisible().catch(() => false))) continue;
    ctx.state.buyButton ??= await inspectButton(page, c);
    const label = (await c.innerText({ timeout: 1_000 }).catch(() => '')).replace(/\s+/g, ' ').trim();
    if (SOLD_OUT_RE.test(label)) return { phase: 'add-to-cart', reached: false, url: page.url(), note: `the button says "${label.slice(0, 40)}"` };
    try {
      let ok = await click(c);
      let note: string | undefined;
      if (!ok) {
        // Most stores refuse Add to cart until a size or variant is chosen. Choose one, in a way that works on any theme, and click again.
        const r = await recover(page, () => click(c).catch(() => false), () => seen.added, ctx.ai);
        ok = r.ok;
        note = ok ? `chose ${r.tried.join(', ')} first, because the store would not add to cart without an option` : r.why;
      }
      ctx.state.cartReady = ok;
      return { phase: 'add-to-cart', reached: ok, url: page.url(), ...(note ? { note } : {}) };
    } catch {
      /* try next */
    }
  }
  return { phase: 'add-to-cart', reached: false, url: page.url(), note: 'no clickable add-to-cart control found' };
}

export const addToCartStep: Step = {
  phase: 'add-to-cart',
  async run(ctx) {
    const { page } = ctx.session;
    if (!ctx.state.productUrl) return { phase: 'add-to-cart', reached: false, url: page.url(), note: 'product page not reached' };
    // Listen for the whole step: a store may add to cart when a size is tapped, not only when the button is clicked.
    const seen = { added: false };
    const onResponse = (r: Response): void => { if (CART_ADD_RE.test(r.url()) && r.status() < 400) seen.added = true; };
    page.on('response', onResponse);
    try {
      const urls = [ctx.state.productUrl, ...(ctx.state.otherProducts ?? [])];
      let last: PhaseResult = { phase: 'add-to-cart', reached: false, url: page.url() };
      const why: string[] = [];
      const deadline = Date.now() + STEP_BUDGET_MS;
      for (const [i, url] of urls.entries()) {
        if (i > 0 && Date.now() > deadline) break; // a store that fights every attempt must not hold the whole scan
        // A product can be sold out or cannot be bought as it is: the next one is tried, so one bad product does not decide the result.
        if (i > 0) {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await settle(page);
          ctx.state.productUrl = url;
        }
        last = await tryProduct(ctx, page, seen);
        if (last.reached) {
          return i > 0 ? { ...last, note: `${last.note ? `${last.note}; ` : ''}the first ${i} product${i > 1 ? 's' : ''} could not be added (${why.join('; ')}), so product ${i + 1} was used` } : last;
        }
        if (last.note) why.push(last.note);
      }
      return urls.length > 1 ? { ...last, note: `tried ${urls.length} products: ${why.join('; ')}` } : last;
    } finally {
      page.off('response', onResponse);
    }
  },
};
