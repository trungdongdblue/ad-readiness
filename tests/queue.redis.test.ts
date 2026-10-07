import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createJobs } from '../src/app/jobs';
import { markFailed, scanProcessor } from '../src/app/process-scan';
import { bullQueue, bullWorker } from '../src/app/queue';
import { redisStore } from '../src/app/store';
import type { Report } from '../src/domain/types';

/** Needs REDIS_TEST_URL (a spare db, e.g. redis://127.0.0.1:6379/15); skipped otherwise. */
const url = process.env['REDIS_TEST_URL'];
const report = { findings: [{ id: 'pixel.present', title: 'p', status: 'verified', severity: 'info', evidence: [] }, { id: 'mobile.speed', title: 'm', status: 'detected', severity: 'info', evidence: [] }] } as unknown as Report;

describe.skipIf(!url)('BullMQ queue and worker over Redis', () => {
  // describe bodies run even when skipped, so nothing may touch Redis until beforeAll.
  let store: ReturnType<typeof redisStore>;
  let queue: ReturnType<typeof bullQueue>;
  let worker: ReturnType<typeof bullWorker>;
  beforeAll(() => {
    store = redisStore(url as string);
    queue = bullQueue(url as string);
    worker = bullWorker(url as string, scanProcessor(store, () => Promise.resolve({ report, capture: {} } as never)), 1, markFailed(store));
  });
  afterAll(async () => { await worker.close(); await queue.close(); });

  it('a job added by the API is scanned by a separate worker and readable from the Store', async () => {
    const jobs = createJobs(store, queue);
    const id = await jobs.start({ url: 'https://q.test/' });
    for (let i = 0; i < 50 && (await jobs.get(id))?.status !== 'done'; i++) await new Promise((r) => setTimeout(r, 100));
    expect((await jobs.get(id))?.result?.score.total).toBe(100);
    expect(await queue.waiting()).toBe(0);
  });
});
