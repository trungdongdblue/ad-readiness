import type { Page } from 'playwright';
import type { Platform } from '../domain/types';

const PRODUCT_PATH = /\/(products?|product|item|p)\/[^/?#]+/i;

export async function findProductUrl(page: Page, platform: Platform): Promise<string | undefined> {
  const origin = new URL(page.url()).origin;
  if (platform === 'shopify') {
    const res = await page.request.get(`${origin}/products.json?limit=1`).catch(() => undefined);
    if (res?.ok()) {
      const body = (await res.json().catch(() => undefined)) as { products?: { handle?: string }[] } | undefined;
      const handle = body?.products?.[0]?.handle;
      if (handle) return `${origin}/products/${handle}`;
    }
  }
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href));
  return hrefs.find((h) => h.startsWith(origin) && PRODUCT_PATH.test(new URL(h).pathname));
}
