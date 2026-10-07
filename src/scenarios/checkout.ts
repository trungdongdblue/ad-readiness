import { settle } from './helpers';
import { collectTrust } from './trust';
import type { Step } from './types';

const FIELDS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), select, textarea';
const STEPS_NAV = 'nav[aria-label*="readcrumb" i] li, .breadcrumb li, ol[class*="step" i] li';

/** Opens the checkout page and only looks at it. Never types, never submits (hard rule 2). */
export const checkoutStep: Step = {
  phase: 'checkout',
  async run(ctx) {
    const { page } = ctx.session;
    if (!ctx.state.cartReady) return { phase: 'checkout', reached: false, url: page.url(), note: 'cart is empty (add-to-cart not confirmed)' };
    await page.goto(new URL('/checkout', page.url()).href, { waitUntil: 'domcontentloaded' });
    await settle(page);
    if (!/checkout/i.test(page.url())) return { phase: 'checkout', reached: false, url: page.url(), note: 'redirected away from /checkout' };
    ctx.state.checkout = await page.evaluate(
      // No named inner functions here: tsx/esbuild injects a `__name` helper that does not exist in the page.
      ([fields, steps]) => ({
        fields: [...document.querySelectorAll(fields as string)].filter((e) => {
          const r = e.getBoundingClientRect();
          // Shopify adds aria-hidden, tabindex=-1 autofill-capture copies of every address field: not user-facing.
          const hidden = e.closest('[aria-hidden=true]') !== null || e.getAttribute('tabindex') === '-1';
          return !hidden && r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
        }).length,
        breadcrumbSteps: document.querySelectorAll(steps as string).length,
      }),
      [FIELDS, STEPS_NAV],
    );
    // Payment methods are often named on the first checkout screen.
    ctx.state.trust = await collectTrust(page, ctx.state.trust);
    return { phase: 'checkout', reached: true, url: page.url() };
  },
};
