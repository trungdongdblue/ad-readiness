/** Scans a worker (or the dev server) runs at once. Each one drives a Chromium. */
export const SCAN_CONCURRENCY = Number(process.env['SCAN_CONCURRENCY'] ?? 2);
