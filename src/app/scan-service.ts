import { ScanSession } from '../collectors/browser-session';
import { fetchCrux } from '../collectors/crux';
import { reviewPage } from '../collectors/llm';
import { pickPageLinks, reviewSite } from '../collectors/site-ai';
import { SITE_MODEL } from '../config/site';
import { LLM_MODEL } from '../config/llm';
import { proxyForMarket } from '../config/markets';
import { measureLoad } from '../collectors/perf';
import { assertSafeUrl } from '../collectors/url-guard';
import type { Stage } from '../domain/api';
import type { Capture, PhaseResult, Report } from '../domain/types';
import { analyze } from '../engine/analyze';
import { MOBILE_RULES } from '../rules/mobile';
import { POLICY_RULES } from '../rules/policy';
import { TRACKING_RULES } from '../rules/tracking';
import { TRUST_RULES } from '../rules/trust';
import { crawlSite } from '../scenarios/crawl';
import { STEPS } from '../scenarios';
import type { ScenarioState } from '../scenarios/types';

export type Check = 'tracking' | 'mobile' | 'trust' | 'policy';

export interface ScanInput {
  url: string;
  market?: string;
  headless?: boolean;
  acceptConsent?: boolean;
  allowLiveEvents?: boolean;
  /** Which checks to report. Default: all. `mobile` adds 3 slow emulated loads (about a minute or more). */
  checks?: Check[];
  /** Google API key for the CrUX API. Defaults to env CRUX_API_KEY. Never commit a key. */
  cruxKey?: string;
  /** Local fixtures only. */
  allowPrivate?: boolean;
  proxy?: string;
  /** Google API key for the AI review of claims and policy links. Defaults to env GOOGLE_GENAI_API_KEY. Never commit a key. */
  geminiKey?: string;
  /** false skips the AI review even when a key exists (keyword rules only). Default true. */
  llm?: boolean;
  /** Called as each stage starts, so a UI can show real progress. */
  onStage?: (stage: Stage) => void;
}

export interface ScanOutput {
  report: Report;
  capture: Capture;
}

/** Runs the funnel steps on an already-open session. Split out so tests can inject routes. */
export async function runScan(session: ScanSession, url: string, input: ScanInput): Promise<Capture> {
  const started = Date.now();
  const state: ScenarioState = { platform: 'unknown', staticPixelIds: [], consentClicked: false, consentBannerSeen: false };
  const phases: PhaseResult[] = [];
  const errors: string[] = [];
  const key = input.geminiKey ?? process.env['GOOGLE_GENAI_API_KEY'];
  const ai = key && input.llm !== false ? { apiKey: key, model: SITE_MODEL } : undefined;

  for (const step of STEPS) {
    session.phase = step.phase;
    input.onStage?.(step.phase);
    try {
      const res = await step.run({ session, targetUrl: url, state, acceptConsent: input.acceptConsent ?? true, market: input.market, ai });
      phases.push(res);
      if (step.phase === 'landing' && !res.reached) break;
    } catch (err) {
      const msg = err instanceof Error ? err.message.split('\n')[0] ?? 'error' : String(err);
      errors.push(`${step.phase}: ${msg}`);
      phases.push({ phase: step.phase, reached: false, url: session.page.url(), note: msg });
      if (step.phase === 'landing') break;
    }
  }

  if (state.trust && state.trust.links.length) {
    input.onStage?.('crawl');
    const siteUrl = phases[0]?.url ?? url;
    try {
      // The AI decides first which links are policy, contact and About pages, in any language; the keyword lists fill what it left out
      // (and decide alone without a key). Then the AI reads every page it opened.
      const picked = ai ? await pickPageLinks(state.trust, siteUrl, ai) : [];
      state.trust.pages = await crawlSite(session, state.trust, siteUrl, input.allowPrivate, picked);
      if (ai) await reviewSite(state.trust, ai);
    } catch (err) {
      errors.push(`crawl: ${err instanceof Error ? (err.message.split('\n')[0] ?? 'error') : String(err)}`);
    }
  }

  return {
    target: url,
    finalUrl: session.page.url(),
    platform: state.platform,
    consentClicked: state.consentClicked,
    consentBannerSeen: state.consentBannerSeen,
    staticPixelIds: state.staticPixelIds,
    mobile: { buyButton: state.buyButton, checkout: state.checkout },
    trust: state.trust,
    requests: session.requests,
    ttqCalls: session.ttqCalls,
    phases,
    errors,
    durationMs: Date.now() - started,
  };
}

export async function scanTarget(input: ScanInput): Promise<ScanOutput> {
  const url = await assertSafeUrl(input.url, { allowPrivate: input.allowPrivate });
  // A proxy that exits in the market's country wins over the general one: some stores only show their real page to local shoppers.
  const proxy = proxyForMarket(input.market) ?? input.proxy;
  const session = await ScanSession.open({
    headless: input.headless ?? true,
    allowLiveEvents: input.allowLiveEvents ?? false,
    proxy,
    market: input.market,
  });
  try {
    const capture = await runScan(session, url, input);
    const opts = { headless: input.headless ?? true, allowLiveEvents: false, proxy, market: input.market };
    const checks = input.checks ?? ['tracking', 'mobile', 'trust', 'policy'];
    if (checks.includes('mobile')) {
      input.onStage?.('mobile');
      // Ask Google for real-user data first (cheap). Only without it do we spend ~90s on emulated loads.
      const key = input.cruxKey ?? process.env['CRUX_API_KEY'];
      // The landing page's final URL (after redirects, e.g. www): capture.finalUrl is the last funnel page, i.e. checkout.
      const crux = key ? await fetchCrux(capture.phases[0]?.url ?? url, key) : { note: 'CRUX_API_KEY not set' };
      capture.mobile = { ...capture.mobile, field: crux.field, fieldNote: crux.note };
      if (!crux.field) capture.mobile.perf = await measureLoad(url, opts);
    }
    input.onStage?.('analysis');
    const geminiKey = input.geminiKey ?? process.env['GOOGLE_GENAI_API_KEY'];
    if (geminiKey && input.llm !== false && (checks.includes('trust') || checks.includes('policy'))) {
      capture.llm = await reviewPage(capture.trust, { apiKey: geminiKey, model: LLM_MODEL });
    }
    const rules = [...(checks.includes('tracking') ? TRACKING_RULES : []), ...(checks.includes('mobile') ? MOBILE_RULES : []), ...(checks.includes('trust') ? TRUST_RULES : []), ...(checks.includes('policy') ? POLICY_RULES : [])];
    return { capture, report: analyze(capture, { market: input.market }, rules) };
  } finally {
    await session.close();
  }
}
