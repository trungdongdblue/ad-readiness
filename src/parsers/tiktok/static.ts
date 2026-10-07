/** Pixel IDs visible in rendered HTML (base code `ttq.load('ID')` or script `sdkid=ID`). */
const PATTERNS = [/ttq\.load\(\s*['"]([A-Z0-9]{10,32})['"]/g, /sdkid=([A-Z0-9]{10,32})/g];

export function pixelIdsFromHtml(html: string): string[] {
  const ids = new Set<string>();
  for (const re of PATTERNS) for (const m of html.matchAll(re)) if (m[1]) ids.add(m[1]);
  return [...ids];
}
