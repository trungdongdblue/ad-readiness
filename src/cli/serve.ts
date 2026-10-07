import './env';
import { createServer } from 'node:http';
import { createApi } from '../app/api';
import { createJobs } from '../app/jobs';
import { scanProcessor } from '../app/process-scan';
import { bullQueue, memoryQueue } from '../app/queue';
import { storeFromEnv } from '../app/store';
import { SCAN_CONCURRENCY } from './worker-config';

const port = Number(process.env['PORT'] ?? 8787);
const redis = process.env['REDIS_URL'];
const store = storeFromEnv();
// With Redis the scans run in `npm run worker` processes; without it they run here (dev).
const queue = redis ? bullQueue(redis) : memoryQueue(scanProcessor(store, undefined, process.env['SCAN_PROXY']), SCAN_CONCURRENCY);
if (!redis) console.warn('REDIS_URL not set: scans, job state and rate limits live in this process only (fine for dev, not for production).');

const trustedHops = Number(process.env['TRUSTED_PROXY_HOPS'] ?? 0);
// Loopback by default: the Vite dev server proxies /api here. Set HOST only behind a reverse proxy.
createServer(createApi({ jobs: createJobs(store, queue), store, trustedHops })).listen(port, process.env['HOST'] ?? '127.0.0.1', () => {
  console.log(`ad-readiness API on :${port}${redis ? ' (queue: Redis)' : ' (in-process scans)'}`);
});
