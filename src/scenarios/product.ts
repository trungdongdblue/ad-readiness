import { findProductUrls } from './find-product';
import { settle } from './helpers';
import { collectTrust } from './trust';
import type { Step } from './types';

export const productStep: Step = {
  phase: 'product',
  async run(ctx) {
    const { page } = ctx.session;
    const [url, ...others] = await findProductUrls(page, ctx.state.platform);
    if (!url) return { phase: 'product', reached: false, url: page.url(), note: 'no product link found on landing page' };
    ctx.state.productUrl = url;
    ctx.state.otherProducts = others;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await settle(page);
    ctx.state.trust = await collectTrust(page, ctx.state.trust);
    return { phase: 'product', reached: true, url: page.url() };
  },
};
