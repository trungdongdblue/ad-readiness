import type { Finding, Metric, Rule, Severity } from '../../domain/types';

const RANK: Severity[] = ['info', 'minor', 'major'];
const worst = (a: Severity, b: Severity): Severity => (RANK.indexOf(a) >= RANK.indexOf(b) ? a : b);
/** web.dev Core Web Vitals bands, applied to real-user p75 only (docs/MOBILE-RULES.md). */
const grade = (v: number | undefined, good: number, poor: number): Severity => (v === undefined || v <= good ? 'info' : v <= poor ? 'minor' : 'major');
/** Same bands as `grade`, kept with the number so the UI can show where it sits. */
const metric = (key: Metric['key'], value: number | undefined, good: number, poor: number, unit: Metric['unit']): Metric[] =>
  value === undefined ? [] : [{ key, value, unit, good, poor, grade: value <= good ? 'good' : value <= poor ? 'needs' : 'poor' }];
const sec = (ms: number | undefined): string => (ms === undefined ? 'n/a' : `${(ms / 1000).toFixed(1)}s`);

/**
 * Real users (CrUX) are graded. Lab numbers are shown, never graded: emulated slow 4G is far heavier than
 * real users (asimjofa.com 2026-10-02: Lighthouse LCP 19.4s, ours 12.7s, real-user p75 3.0s).
 */
export const loadSpeed: Rule = (obs): Finding[] => {
  const f = obs.mobile?.field;
  const lab = obs.mobile?.perf;
  const why = obs.mobile?.fieldNote;

  if (f) {
    const severity = [grade(f.lcpMs, 2500, 4000), grade(f.inpMs, 200, 500), grade(f.cls, 0.1, 0.25)].reduce(worst);
    const cls = f.cls === undefined ? 'n/a' : f.cls.toFixed(2);
    const inp = f.inpMs === undefined ? 'n/a' : `${Math.round(f.inpMs)}ms`;
    return [{
      id: 'mobile.speed',
      title: `Real-user mobile (p75): LCP ${sec(f.lcpMs)}, INP ${inp}, CLS ${cls}`,
      status: 'detected',
      severity,
      evidence: [
        `FCP ${sec(f.fcpMs)}`, `TTFB ${sec(f.ttfbMs)}`,
        f.level === 'origin' ? 'domain-level data (Google has none for this exact page)' : 'page-level data',
        'Chrome Users, last 28 days; not TikTok in-app browser',
      ],
      metrics: [...metric('lcp', f.lcpMs, 2500, 4000, 'ms'), ...metric('inp', f.inpMs, 200, 500, 'ms'), ...metric('cls', f.cls, 0.1, 0.25, '')],
      fix: severity === 'info' ? undefined : 'Compress images, cut redirects and third-party scripts, host closer to the market (TikTok loading guidance).',
    }];
  }

  if (lab) {
    const cls = lab.cls === undefined ? 'n/a' : lab.cls.toFixed(2);
    const tbt = lab.tbtMs === undefined ? 'n/a' : `${Math.round(lab.tbtMs)}ms`;
    return [{
      id: 'mobile.speed',
      title: `Mobile load (lab only, slow 4G): LCP ${sec(lab.lcpMs)}, TBT ${tbt}, CLS ${cls}`,
      status: 'detected',
      severity: 'info',
      evidence: [`no real-user data: ${why ?? 'not queried'}`, `FCP ${sec(lab.fcpMs)}`, `TTFB ${sec(lab.ttfbMs)}`, `median of ${lab.runs} emulated loads`, 'heavier than real users, so not graded'],
    }];
  }

  return [{ id: 'mobile.speed', title: 'Load speed was not measured', status: 'unverifiable', severity: 'info', evidence: why ? [why] : [] }];
};
