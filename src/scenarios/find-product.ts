import type { Page } from 'playwright';
import type { Platform } from '../domain/types';

const PRODUCT_PATH = /\/(products?|product|item|p)\/[^/?#]+/i;
/** How many products the scan may try: a product can be sold out, so one is not enough. */
export const PRODUCTS_TO_TRY = 3;

interface ShopifyProduct { handle?: string; variants?: { id?: number; available?: boolean }[] }

/**
 * Candidate product pages, best first. Shopify says which variants are in stock, so those products come first and the page is opened with
 * an in-stock variant already chosen (`?variant=`, honoured by Shopify themes): no size or colour has to be picked, and a product whose
 * default size or colour is sold out (outfitters.com.pk) still works. If a theme ignores it, the option choosing in options.ts still runs.
 * Other platforms: the first product links on the page.
 */
export async function findProductUrls(page: Page, platform: Platform): Promise<string[]> {
  const origin = new URL(page.url()).origin;
  if (platform === 'shopify') {
    const res = await page.request.get(`${origin}/products.json?limit=30`).catch(() => undefined);
    if (res?.ok()) {
      const body = (await res.json().catch(() => undefined)) as { products?: ShopifyProduct[] } | undefined;
      const all = (body?.products ?? []).filter((p): p is ShopifyProduct & { handle: string } => Boolean(p.handle));
      const urlOf = (p: ShopifyProduct & { handle: string }): string => {
        const v = p.variants?.find((x) => x.available && x.id);
        return `${origin}/products/${p.handle}${v ? `?variant=${v.id}` : ''}`;
      };
      // Most variants in stock first: a product that is almost all sold out is more often in an odd state (one colour or size left that the page cannot select).
      const share = (p: ShopifyProduct): number => (p.variants ?? []).filter((v) => v.available).length / Math.max(1, p.variants?.length ?? 1);
      const inStock = all.filter((p) => share(p) > 0).sort((a, b) => share(b) - share(a));
      const picked = [...inStock, ...all.filter((p) => !inStock.includes(p))].slice(0, PRODUCTS_TO_TRY);
      if (picked.length) return picked.map(urlOf);
    }
  }
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href));
  const found = hrefs.filter((h) => h.startsWith(origin) && PRODUCT_PATH.test(new URL(h).pathname)).map((h) => h.split('#')[0] as string);
  return [...new Set(found)].slice(0, PRODUCTS_TO_TRY);
}
