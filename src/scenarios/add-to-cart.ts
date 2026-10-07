import type { Locator, Response } from 'playwright';
import { mainAddToCart } from '../collectors/main-button';
import { ADD_TO_CART_RE } from '../config/constants';
import { inspectButton } from './buy-button';
import { recover } from './options';
import type { Step } from './types';

/** A 2xx on a cart-add endpoint is our proof the click really added an item. */
const CART_ADD_RE = /\/cart\/add|add[-_]to[-_]cart|wc-ajax=add_to_cart|\/cart\/(change|update)/i;

export const addToCartStep: Step = {
  phase: 'add-to-cart',
  async run(ctx) {
    const { page } = ctx.session;
    if (!ctx.state.productUrl) return { phase: 'add-to-cart', reached: false, url: page.url(), note: 'product page not reached' };
    const main = await mainAddToCart(page);
    const candidates = [
      ...(main ? [main] : []),
      page.locator('form[action*="/cart/add"] [type=submit], button[name="add"]').first(),
      page.getByRole('button', { name: ADD_TO_CART_RE }).first(),
      page.getByRole('link', { name: ADD_TO_CART_RE }).first(),
    ];
    // Listen for the whole step: a store may add to cart when a size is tapped, not only when the button is clicked.
    let added = false;
    const onResponse = (r: Response): void => { if (CART_ADD_RE.test(r.url()) && r.status() < 400) added = true; };
    page.on('response', onResponse);
    const click = async (c: Locator): Promise<boolean> => {
      added = false;
      await c.click({ timeout: 5_000 });
      for (let i = 0; i < 24 && !added; i++) await page.waitForTimeout(250);
      await page.waitForTimeout(2_500);
      return added;
    };
    try {
      for (const c of candidates) {
        if (!(await c.isVisible().catch(() => false))) continue;
        ctx.state.buyButton ??= await inspectButton(page, c);
        try {
          let ok = await click(c);
          let note: string | undefined;
          if (!ok) {
            // Most stores refuse Add to cart until a size or variant is chosen. Choose one, in a way that works on any theme, and click again.
            const r = await recover(page, () => click(c).catch(() => false), () => added, ctx.ai);
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
    } finally {
      page.off('response', onResponse);
    }
  },
};
