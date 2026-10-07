import type { Page } from 'playwright';
import { countryNames, isCountryGate } from '../parsers/country-gate';

export interface GateResult {
  /** The page only asked for a country. */
  gate: boolean;
  /** The name we clicked, when one matched the market. */
  chose?: string;
}

/**
 * Some stores open on a "Select your country" page and show nothing else. A shopper would pick their country, so we pick the
 * market's. Only a country name is clicked, nothing is typed. Best effort: never throws, and a page that is not a country page is left alone.
 */
export async function leaveCountryGate(page: Page, market?: string): Promise<GateResult> {
  const text = await page.evaluate('document.body ? document.body.innerText : ""').catch(() => '');
  if (!isCountryGate(String(text))) return { gate: false };
  for (const name of countryNames(market)) {
    const target = page.getByRole('link', { name, exact: true }).or(page.getByRole('button', { name, exact: true })).or(page.getByText(name, { exact: true })).first();
    if (!(await target.isVisible({ timeout: 1_000 }).catch(() => false))) continue;
    try {
      await Promise.all([page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined), target.click({ timeout: 3_000 })]);
      await page.waitForTimeout(1_500);
      return { gate: true, chose: name };
    } catch {
      /* try the next name */
    }
  }
  return { gate: true };
}
