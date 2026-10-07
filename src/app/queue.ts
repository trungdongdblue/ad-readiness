import { Queue, Worker } from 'bullmq';

export interface ScanJob {
  id: string;
  url: string;
  market?: string;
}
export type Processor = (job: ScanJob) => Promise<void>;

/** What the API needs from a queue. The scan itself runs wherever the matching worker runs. */
export interface ScanQueue {
  add(job: ScanJob): Promise<void>;
  waiting(): Promise<number>;
}

const log = (msg: string): void => void process.stderr.write(`${msg}\n`);

/** Dev and tests: scans run inside this process, `concurrency` at a time. */
export function memoryQueue(run: Processor, concurrency: number): ScanQueue {
  const pending: ScanJob[] = [];
  let active = 0;
  const pump = (): void => {
    while (active < concurrency && pending.length) {
      const job = pending.shift() as ScanJob;
      active += 1;
      run(job)
        .catch((e: unknown) => log(`scan processor failed: ${String(e)}`))
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  };
  return {
    async add(job) {
      pending.push(job);
      pump();
    },
    async waiting() {
      return pending.length;
    },
  };
}

/** BullMQ wants plain connection options (and no per-request retry cap on workers), not a URL. */
function connection(url: string) {
  const u = new URL(url);
  return { host: u.hostname, port: Number(u.port || 6379), password: u.password || undefined, db: Number(u.pathname.slice(1) || 0), maxRetriesPerRequest: null };
}

const NAME = 'scan';

export function bullQueue(url: string): ScanQueue & { close(): Promise<void> } {
  // Job state lives in the Store, so BullMQ keeps nothing once a job ends. attempts 1: a failed scan is shown to the customer, never silently re-run.
  const q = new Queue<ScanJob>(NAME, { connection: connection(url), defaultJobOptions: { attempts: 1, removeOnComplete: true, removeOnFail: true } });
  return {
    async add(job) {
      await q.add(NAME, job, { jobId: job.id });
    },
    waiting: () => q.getWaitingCount(),
    close: () => q.close(),
  };
}

/**
 * A worker that dies mid-scan loses its lock; BullMQ then hands the job to another worker (once), and
 * `onGaveUp` runs if that also stalls, so the customer sees "failed" instead of a scan that never ends.
 */
export function bullWorker(url: string, run: Processor, concurrency: number, onGaveUp: (job: ScanJob) => Promise<void>): Worker<ScanJob> {
  const w = new Worker<ScanJob>(NAME, (job) => run(job.data), { connection: connection(url), concurrency });
  w.on('failed', (job, err) => {
    log(`scan job failed: ${err.message}`);
    if (job) onGaveUp(job.data).catch((e: unknown) => log(`could not mark job failed: ${String(e)}`));
  });
  w.on('error', (err) => log(`worker error: ${err.message}`));
  return w;
}
