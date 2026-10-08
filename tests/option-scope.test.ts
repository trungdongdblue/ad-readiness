import { afterAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { snapshotControls } from '../src/collectors/options';
import { findProductUrls } from '../src/scenarios/find-product';
import { startFixtureServer } from './fixtures/site';

describe('options of the main product only', () => {
  const servers: Awaited<ReturnType<typeof startFixtureServer>>[] = [];
  afterAll(async () => { await Promise.all(servers.map((s) => s.close())); });

  it('never offers the sizes of a recommended product\'s card', async () => {
    const server = await startFixtureServer({ pixel: false, sizes: 'radio', cardPicker: true });
    servers.push(server);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`${server.url}products/widget`);
      const labels = (await snapshotControls(page)).map((c) => c.label);
      expect(labels).toEqual(expect.arrayContaining(['S', 'M', 'L']));
      expect(labels).not.toContain('XL');
    } finally { await browser.close(); }
  });
});

describe('Shopify product choice', () => {
  it('puts the products with most stock first and opens each with an in-stock variant chosen', async () => {
    const products = [
      { handle: 'sold-out', variants: [{ id: 1, available: false }] },
      { handle: 'mixed', variants: [{ id: 2, available: false }, { id: 3, available: true }] },
      { handle: 'fine', variants: [{ id: 4, available: true }] },
    ];
    const page = {
      url: () => 'https://shop.test/',
      request: { get: async () => ({ ok: () => true, json: async () => ({ products }) }) },
    };
    const urls = await findProductUrls(page as never, 'shopify');
    expect(urls).toEqual(['https://shop.test/products/fine?variant=4', 'https://shop.test/products/mixed?variant=3', 'https://shop.test/products/sold-out']);
  });
});
