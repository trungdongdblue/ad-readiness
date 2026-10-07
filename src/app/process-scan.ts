import type { AdviceState, JobView, Stage } from '../domain/api';
import { rankFixes } from '../engine/advice';
import { scoreFindings } from '../engine/score';
import { adviseFromEnv, type Advise } from './advice';
import type { Processor } from './queue';
import { scanTarget, type ScanInput, type ScanOutput } from './scan-service';
import type { Store } from './store';

export const TTL_SEC = 30 * 60;
export const SCAN_FAILED = 'We could not finish scanning this store. Check the address and try again in a few minutes.';

type Scan = (input: ScanInput) => Promise<ScanOutput>;
const log = (msg: string): void => void process.stderr.write(`${msg}\n`);

/** Runs one scan and writes its progress and outcome to the Store. Never throws: a failed scan is a result, not a crash. */
/** `advise` writes the AI fix plan after the result is already visible; without it (no key) the scan is the whole job. */
export function scanProcessor(store: Store, scan: Scan = scanTarget, proxy?: string, advise: Advise | undefined = adviseFromEnv()): Processor {
  return async ({ id, url, market }) => {
    const view: JobView = { id, status: 'running' };
    // Saves are chained so a slow "stage" write can never land after the final result.
    let writes: Promise<void> = store.save(view, TTL_SEC);
    const write = (): void => {
      writes = writes.then(() => store.save(view, TTL_SEC)).catch((e: unknown) => log(`save failed: ${String(e)}`));
    };
    const onStage = (stage: Stage): void => {
      view.stage = stage;
      write();
    };
    try {
      const { report, capture } = await scan({ url, market, proxy, onStage });
      const u = capture.llm?.usage;
      if (u) log(`llm ${capture.llm?.model}: ${u.calls} calls, ${u.inputTokens} in / ${u.outputTokens} out tokens (${url})`);
      view.result = { report, score: scoreFindings(report.findings) };
      view.status = 'done';
      if (advise && rankFixes(report.findings, 1).length) view.advice = { status: 'pending' };
    } catch (err) {
      log(`scan failed ${url}: ${err instanceof Error ? err.message : String(err)}`);
      view.status = 'failed';
      view.error = SCAN_FAILED;
    }
    write();
    if (view.advice && view.result && advise) {
      view.advice = await advise(view.result.report).then(
        (plan): AdviceState => (plan ? { status: 'done', plan } : { status: 'failed' }),
        (e: unknown): AdviceState => (log(`advice failed ${url}: ${e instanceof Error ? e.message : String(e)}`), { status: 'failed' }),
      );
      write();
    }
    await writes;
  };
}

export const markFailed = (store: Store): ((job: { id: string }) => Promise<void>) => (job) =>
  store.save({ id: job.id, status: 'failed', error: SCAN_FAILED }, TTL_SEC);
