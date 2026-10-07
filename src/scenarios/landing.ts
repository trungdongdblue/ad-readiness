import { leaveCountryGate } from '../collectors/country-gate';
import { pixelIdsFromHtml } from '../parsers/tiktok/static';
import { detectPlatform } from '../parsers/platform';
import { handleConsent, settle } from './helpers';
import { collectTrust } from './trust';
import type { Step } from './types';

export const landingStep: Step = {
  phase: 'landing',
  async run(ctx) {
    const { page } = ctx.session;
    await page.goto(ctx.targetUrl, { waitUntil: 'domcontentloaded' });
    // A page that only asks for a country hides the store: choose the market's country first, as a local shopper would.
    const gate = await leaveCountryGate(page, ctx.market);
    const consent = await handleConsent(page, ctx.acceptConsent);
    ctx.state.consentBannerSeen = consent.bannerSeen;
    ctx.state.consentClicked = consent.clicked;
    await settle(page);
    ctx.state.trust = await collectTrust(page, ctx.state.trust);
    const html = await page.content();
    ctx.state.platform = detectPlatform(html);
    ctx.state.staticPixelIds = pixelIdsFromHtml(html);
    const note = gate.chose ? `chose "${gate.chose}" on the store's country page` : gate.gate ? `the store asks for a country and none matches the market${ctx.market ? ` ${ctx.market}` : ' (none selected)'}` : undefined;
    return { phase: 'landing', reached: true, url: page.url(), ...(note ? { note } : {}) };
  },
};
