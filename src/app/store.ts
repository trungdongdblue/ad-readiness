import { Redis } from 'ioredis';
import type { JobView } from '../domain/api';

/** Everything the API and the workers must share between processes: job state and rate-limit counters. */
export interface Store {
  save(job: JobView, ttlSec: number): Promise<void>;
  load(id: string): Promise<JobView | undefined>;
  /** Counts a hit on `key` inside a fixed window and returns the new count. */
  hit(key: string, windowSec: number): Promise<number>;
}

/** Dev and tests: one process only. */
export function memoryStore(): Store {
  const jobs = new Map<string, { job: JobView; until: number }>();
  const hits = new Map<string, { n: number; until: number }>();
  return {
    async save(job, ttlSec) {
      jobs.set(job.id, { job: structuredClone(job), until: Date.now() + ttlSec * 1000 });
    },
    async load(id) {
      const e = jobs.get(id);
      if (!e || e.until < Date.now()) return undefined;
      return structuredClone(e.job);
    },
    async hit(key, windowSec) {
      const e = hits.get(key);
      const n = e && e.until > Date.now() ? e.n + 1 : 1;
      hits.set(key, { n, until: e && e.until > Date.now() ? e.until : Date.now() + windowSec * 1000 });
      return n;
    },
  };
}

const P = 'adr:';
export function redisStore(url: string): Store {
  const r = new Redis(url, { maxRetriesPerRequest: 2 });
  r.on('error', (err: Error) => process.stderr.write(`redis: ${err.message}\n`));
  return {
    async save(job, ttlSec) {
      await r.set(`${P}job:${job.id}`, JSON.stringify(job), 'EX', ttlSec);
    },
    async load(id) {
      const raw = await r.get(`${P}job:${id}`);
      return raw ? (JSON.parse(raw) as JobView) : undefined;
    },
    async hit(key, windowSec) {
      const k = `${P}rl:${key}`;
      const n = await r.incr(k);
      if (n === 1) await r.expire(k, windowSec);
      return n;
    },
  };
}

/** Redis when REDIS_URL is set, otherwise in memory. */
export const storeFromEnv = (): Store => (process.env['REDIS_URL'] ? redisStore(process.env['REDIS_URL']) : memoryStore());
