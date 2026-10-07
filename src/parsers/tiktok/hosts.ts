/** Hosts the TikTok Pixel talks to. Source: nuxt/scripts PR #776 (third party) - verify in recon mode. */
const PIXEL_HOSTS = new Set([
  'analytics.tiktok.com',
  'analytics.us.tiktok.com',
  'mon.tiktok.com',
  'mcs.tiktok.com',
]);

export function isPixelHost(hostname: string): boolean {
  return PIXEL_HOSTS.has(hostname.toLowerCase());
}

/** The library download, e.g. https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=ID&lib=ttq */
export function isPixelScript(url: string): boolean {
  try {
    const u = new URL(url);
    return isPixelHost(u.hostname) && /\/pixel\/.*\.js$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function isPixelBeacon(url: string): boolean {
  try {
    const u = new URL(url);
    return isPixelHost(u.hostname) && !isPixelScript(url);
  } catch {
    return false;
  }
}

export function pixelIdFromScriptUrl(url: string): string | undefined {
  try {
    return new URL(url).searchParams.get('sdkid') ?? undefined;
  } catch {
    return undefined;
  }
}
