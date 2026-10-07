import { randomUUID } from 'node:crypto';
import type { JobView } from '../domain/api';
import { TTL_SEC } from './process-scan';
import type { ScanQueue } from './queue';
import type { ScanInput } from './scan-service';
import type { Store } from './store';

/** Customers beyond this many waiting scans get "busy" instead of a wait of many minutes. */
const MAX_WAITING = 20;

export class BusyError extends Error {
  constructor() {
    super('The grader is busy right now. Please try again in a minute.');
  }
}

/** The API side: accept a scan, queue it, answer polls. A worker (this process in dev, another container in production) does the scanning. */
export function createJobs(store: Store, queue: ScanQueue) {
  async function start(input: Pick<ScanInput, 'url' | 'market'>): Promise<string> {
    if ((await queue.waiting()) >= MAX_WAITING) throw new BusyError();
    const view: JobView = { id: randomUUID(), status: 'queued' };
    await store.save(view, TTL_SEC);
    await queue.add({ id: view.id, ...input });
    return view.id;
  }
  return { start, get: (id: string) => store.load(id) };
}

export type Jobs = ReturnType<typeof createJobs>;
