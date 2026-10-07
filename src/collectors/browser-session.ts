import { chromium, devices, type Browser, type BrowserContext, type Page } from 'playwright';
import { DEVICE, NAV_TIMEOUT_MS } from '../config/constants';
import { browserFor } from '../config/markets';
import type { CapturedRequest, Phase, TtqCall } from '../domain/types';
import { isPixelHost, isPixelScript } from '../parsers/tiktok/hosts';
import { TTQ_HOOK_SCRIPT } from './ttq-hook';

export interface SessionOptions {
  headless: boolean;
  /** DANGER: lets pixel events reach TikTok and pollute the store's real data. Off by default. */
  allowLiveEvents: boolean;
  proxy?: string;
  /** Target market (PK, IQ, ...): the browser gets that country's language and time zone. */
  market?: string;
  /** Test seam: runs before the capture route is registered, so capture sees traffic first. */
  setup?: (context: BrowserContext) => Promise<void>;
}

/**
 * One scan = one isolated browser context (mobile emulation).
 * TikTok pixel traffic is recorded, then answered locally (204) so no event reaches TikTok.
 */
export class ScanSession {
  readonly requests: CapturedRequest[] = [];
  readonly ttqCalls: TtqCall[] = [];
  phase: Phase = 'landing';
  /** false while the site crawl opens policy pages: their traffic is still blocked, but is not evidence about the funnel. */
  record = true;

  private constructor(
    readonly browser: Browser,
    readonly context: BrowserContext,
    readonly page: Page,
    private readonly opts: SessionOptions,
  ) {}

  static async open(opts: SessionOptions): Promise<ScanSession> {
    const browser = await chromium.launch({ headless: opts.headless, proxy: opts.proxy ? { server: opts.proxy } : undefined });
    const { defaultBrowserType: _ignored, ...device } = devices[DEVICE] ?? {};
    const context = await browser.newContext({ ...device, ...browserFor(opts.market), serviceWorkers: 'block' });
    context.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    const page = await context.newPage();
    const session = new ScanSession(browser, context, page, opts);

    await context.exposeFunction('__adrReport', (p: { method: string; args: unknown[] }) => {
      if (session.record) session.ttqCalls.push({ phase: session.phase, method: p.method, args: p.args });
    });
    await context.addInitScript(TTQ_HOOK_SCRIPT);
    await opts.setup?.(context);
    await context.route((u) => isPixelHost(u.hostname), async (route) => {
      const req = route.request();
      const isScript = isPixelScript(req.url());
      const block = !isScript && !opts.allowLiveEvents;
      if (session.record) session.requests.push({ phase: session.phase, url: req.url(), method: req.method(), postData: req.postData(), blocked: block });
      if (!block) return route.fallback();
      const origin = req.headers()['origin'];
      return route.fulfill({
        status: 204,
        headers: origin ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } : {},
        body: '',
      });
    });
    return session;
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}
