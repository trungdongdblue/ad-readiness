import type { Finding, Phase, Report, Severity } from './types';

/** Markets offered in the form; the API rejects anything else. Omitted market = "Other". */
export const MARKETS = ['PK', 'IQ', 'AE', 'SA', 'EG'] as const;
export type Market = (typeof MARKETS)[number];

/** The four report groups. `trust` is shown to customers as "Information". */
export type GroupKey = 'tracking' | 'mobile' | 'trust' | 'policy';
export type Verdict = 'ready' | 'fixes' | 'not_ready';

export interface GroupScore {
  key: GroupKey;
  /** 0-100. null when nothing in the group could be checked: shown as "not checked", never as 0. */
  score: number | null;
  /** Findings that could be decided (everything except `unverifiable`). */
  checked: number;
  /** Decided findings that cost points (severity above info). */
  issues: number;
  findings: Finding[];
}

export interface ScoreSummary {
  total: number | null;
  verdict: Verdict | null;
  groups: GroupScore[];
  /** How much of the report could be decided at all: `checked` of `total` findings (the rest are `unverifiable`). */
  coverage: { checked: number; total: number };
  /** Too little was checked to call a store ready: the verdict is held at "fixes". */
  partial: boolean;
}

export interface ScanResult {
  report: Report;
  score: ScoreSummary;
}

/** Where a running scan is: funnel phases, then the slow mobile measurement, then analysis. */
export type Stage = Phase | 'crawl' | 'mobile' | 'analysis';

/** minutes = a setting or a text edit; hour = a new page, app or section; developer = needs theme or code changes. */
export type Effort = 'minutes' | 'hour' | 'developer';

export interface AdviceItem {
  title: string;
  severity: Severity;
  /** Points the total score gains when only this finding is fixed (0 when a cap or a missing total hides it). */
  gain: number;
  effort: Effort;
  /** Plain-words reason this matters to the owner's ads or sales. */
  why?: string;
  steps: string[];
  /** How the owner can confirm the fix worked. */
  check?: string;
  /** Compliant rewrite of a quoted claim, in the quote's language. Policy findings only. */
  safeCopy?: string;
}

/** Fixes ordered by score gain. `now` and `after` are the total score before and after all of them. */
export interface AdvicePlan {
  model: string;
  items: AdviceItem[];
  now: number | null;
  after: number | null;
}

export type AdviceState = { status: 'pending' } | { status: 'done'; plan: AdvicePlan } | { status: 'failed' };

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface JobView {
  id: string;
  status: JobStatus;
  stage?: Stage;
  result?: ScanResult;
  /** Absent when the AI plan is off or there is nothing to fix. Arrives after `result`. */
  advice?: AdviceState;
  /** Safe to show to the customer. */
  error?: string;
}
