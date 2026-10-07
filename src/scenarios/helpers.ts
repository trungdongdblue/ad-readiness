import type { Page } from 'playwright';
import { CONSENT_ACCEPT_RE, SETTLE } from '../config/constants';

export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: SETTLE.idleMs }).catch(() => undefined);
  await page.mouse.wheel(0, 600).catch(() => undefined);
  await page.waitForTimeout(SETTLE.extraMs);
}

const BANNER_SELECTORS = '#onetrust-banner-sdk, #CybotCookiebotDialog, [id*="cookie-banner" i], [class*="cookie-banner" i], [id*="consent" i][role="dialog"], [aria-label*="cookie" i]';

export interface ConsentResult {
  bannerSeen: boolean;
  clicked: boolean;
}

/** Detects a cookie banner and (optionally) clicks "accept". Best effort; never throws. */
export async function handleConsent(page: Page, accept: boolean): Promise<ConsentResult> {
  const accepts = page.getByRole('button', { name: CONSENT_ACCEPT_RE }).first();
  const bannerSeen =
    (await page.locator(BANNER_SELECTORS).first().isVisible({ timeout: 1_500 }).catch(() => false)) ||
    (await accepts.isVisible({ timeout: 500 }).catch(() => false));
  if (!bannerSeen || !accept) return { bannerSeen, clicked: false };
  try {
    await accepts.click({ timeout: 3_000 });
    return { bannerSeen, clicked: true };
  } catch {
    return { bannerSeen, clicked: false };
  }
}
