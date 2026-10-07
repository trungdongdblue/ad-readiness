import { useCallback, useEffect, useState } from 'react';
import type { AdviceState, Market, ScanResult, Stage } from '@domain/api';
import { ApiError, fetchScan, startScan } from './api';

export type ScanState =
  | { kind: 'idle'; error?: { field?: 'url' | 'market'; message: string } }
  | { kind: 'scanning'; id: string; url: string; market?: Market; stage?: Stage; startedAt: number }
  | { kind: 'done'; id: string; url: string; market?: Market; result: ScanResult; advice?: AdviceState }
  | { kind: 'failed'; message: string };

const POLL_MS = 2_000;
const MAX_POLL_ERRORS = 4;
const ADVICE_POLL_MS = 1_500;
/** About 45 s: a plan normally takes 2 to 5 s, so anything longer is a stuck model call. */
const MAX_ADVICE_POLLS = 30;

/** idle -> scanning (poll the job) -> done | failed. `submit` surfaces form errors back into `idle`. */
export function useScan() {
  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const jobId = state.kind === 'scanning' ? state.id : undefined;

  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let errors = 0;
    const tick = async (): Promise<void> => {
      try {
        const job = await fetchScan(jobId);
        if (stopped) return;
        errors = 0;
        if (job.status === 'done' && job.result) setState((s) => (s.kind === 'scanning' ? { kind: 'done', id: s.id, url: s.url, market: s.market, result: job.result as ScanResult, advice: job.advice } : s));
        else if (job.status === 'failed') setState({ kind: 'failed', message: job.error ?? 'The scan failed.' });
        else {
          setState((s) => (s.kind === 'scanning' ? { ...s, stage: job.stage } : s));
          timer = setTimeout(tick, POLL_MS);
        }
      } catch (err) {
        if (stopped) return;
        // A scan can outlive a flaky connection; only give up on a gone job or repeated failures.
        if ((err instanceof ApiError && err.status === 404) || ++errors >= MAX_POLL_ERRORS) setState({ kind: 'failed', message: err instanceof ApiError ? err.message : 'Lost connection to the grader.' });
        else timer = setTimeout(tick, POLL_MS);
      }
    };
    let timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  // The result is shown at once; the AI plan lands a few seconds later on the same job.
  const adviceJob = state.kind === 'done' && state.advice?.status === 'pending' ? state.id : undefined;
  useEffect(() => {
    if (!adviceJob) return;
    let stopped = false;
    let polls = 0;
    const settle = (advice: AdviceState): void => setState((s) => (s.kind === 'done' && s.id === adviceJob ? { ...s, advice } : s));
    const tick = async (): Promise<void> => {
      try {
        const job = await fetchScan(adviceJob);
        if (stopped) return;
        if (job.advice?.status !== 'pending') return settle(job.advice ?? { status: 'failed' });
      } catch {
        if (stopped) return;
      }
      if (++polls >= MAX_ADVICE_POLLS) return settle({ status: 'failed' });
      timer = setTimeout(tick, ADVICE_POLL_MS);
    };
    let timer = setTimeout(tick, ADVICE_POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [adviceJob]);

  const submit = useCallback(async (url: string, market: string): Promise<void> => {
    try {
      const { id } = await startScan(url, market);
      setState({ kind: 'scanning', id, url, market: (market || undefined) as Market | undefined, startedAt: Date.now() });
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError('Something went wrong. Please try again.');
      setState({ kind: 'idle', error: { field: e.field, message: e.message } });
    }
  }, []);

  const reset = useCallback(() => setState({ kind: 'idle' }), []);
  return { state, submit, reset };
}
