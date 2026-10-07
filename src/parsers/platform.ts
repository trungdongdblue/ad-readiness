import type { Platform } from '../domain/types';

const DETECTORS: [Platform, RegExp][] = [
  ['shopify', /cdn\.shopify\.com|Shopify\.theme|myshopify\.com|\/cdn\/shop\//i],
  ['woocommerce', /woocommerce|wp-content\/plugins\/woocommerce|wc-ajax/i],
  ['wix', /static\.parastorage\.com|wixstatic\.com|X-Wix/i],
  ['shoplazza', /shoplazza|shoplaza/i],
];

export function detectPlatform(html: string): Platform {
  for (const [name, re] of DETECTORS) if (re.test(html)) return name;
  return 'unknown';
}
