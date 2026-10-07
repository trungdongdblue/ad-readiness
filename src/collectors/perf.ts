import type { PerfMetrics } from '../domain/types';
import { ScanSession, type SessionOptions } from './browser-session';

const RUNS = 3;
/** Lighthouse mobile preset, approximated (docs/MOBILE-RULES.md). Throughput in bytes/s. */
const NETWORK = { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750 };
const CPU_RATE = 4;

const median = (xs: number[]): number | undefined => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : undefined);

interface Run {
  lcp?: number;
  fcp?: number;
  ttfb?: number;
  cls: number;
  tbt: number;
}

async function loadOnce(url: string, opts: SessionOptions): Promise<Run | undefined> {
  const s = await ScanSession.open(opts); // same capture-and-block route, so no pixel event reaches TikTok
  try {
    const cdp = await s.context.newCDPSession(s.page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', NETWORK);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
    await s.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    // A page still loading after this is itself the result: keep whatever metrics exist by now.
    await s.page.waitForLoadState('load', { timeout: 15_000 }).catch(() => undefined);
    await s.page.waitForTimeout(3_000);
    return await s.page.evaluate(
      () =>
        new Promise<Run>((resolve) => {
          const out: Run = { cls: 0, tbt: 0 };
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
          out.ttfb = nav?.responseStart;
          out.fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
          new PerformanceObserver((l) => l.getEntries().forEach((e) => (out.lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
          // ponytail: plain sum of shifts, overstates Chrome's session-window CLS; port the windowing if it matters
          new PerformanceObserver((l) => l.getEntries().forEach((e) => { const ls = e as PerformanceEntry & { value: number; hadRecentInput: boolean }; if (!ls.hadRecentInput) out.cls += ls.value; })).observe({ type: 'layout-shift', buffered: true });
          // ponytail: TBT window ends ~3s after load, not at Lighthouse's TTI, so it can undercount on very heavy pages
          new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.startTime >= (out.fcp ?? 0) && e.duration > 50) out.tbt += e.duration - 50; })).observe({ type: 'longtask', buffered: true });
          setTimeout(() => resolve(out), 200);
        }),
    );
  } catch {
    return undefined;
  } finally {
    await s.close();
  }
}

/** Median of RUNS cold loads under emulated slow 4G + 4x CPU. undefined if every run failed. */
export async function measureLoad(url: string, opts: SessionOptions): Promise<PerfMetrics | undefined> {
  // ponytail: parallel loads share the scanner's CPU, so TBT/LCP read a bit higher than sequential; fine for ungraded lab numbers
  const runs = (await Promise.all(Array.from({ length: RUNS }, () => loadOnce(url, opts)))).filter((r): r is Run => r !== undefined);
  if (runs.length === 0) return undefined;
  const pick = (k: 'lcp' | 'fcp' | 'ttfb') => median(runs.flatMap((r) => (r[k] === undefined ? [] : [r[k]])));
  return { lcpMs: pick('lcp'), fcpMs: pick('fcp'), ttfbMs: pick('ttfb'), cls: median(runs.map((r) => r.cls)), tbtMs: median(runs.map((r) => r.tbt)), runs: runs.length };
}
