import './env';
import { markFailed, scanProcessor } from '../app/process-scan';
import { bullWorker } from '../app/queue';
import { redisStore } from '../app/store';
import { SCAN_CONCURRENCY } from './worker-config';

const url = process.env['REDIS_URL'];
if (!url) {
  console.error('REDIS_URL is required for the worker');
  process.exit(2);
}
const store = redisStore(url);
// SCAN_PROXY must point at the egress proxy in production (deploy/squid.conf): it is the network-level SSRF guard.
const worker = bullWorker(url, scanProcessor(store, undefined, process.env['SCAN_PROXY']), SCAN_CONCURRENCY, markFailed(store));
console.log(`ad-readiness worker up, concurrency ${SCAN_CONCURRENCY}`);

// Finish running scans before exiting so a deploy does not strand them.
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.once(sig, () => void worker.close().then(() => process.exit(0)));
