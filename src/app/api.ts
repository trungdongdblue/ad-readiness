import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { assertSafeUrl } from '../collectors/url-guard';
import { MARKETS, type Market } from '../domain/api';
import { clientIp } from './client-ip';
import { BusyError, type Jobs } from './jobs';
import type { Store } from './store';

const WINDOW_SEC = 60 * 60;
/** Scans one address may start per hour. Raise it for testing: SCAN_LIMIT_PER_HOUR. */
const MAX_SCANS_PER_WINDOW = Number(process.env['SCAN_LIMIT_PER_HOUR'] ?? 5);
const MAX_BODY = 4_096;

const send = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body));
};

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > MAX_BODY) throw new Error('Request too large');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid request');
  }
}

interface Deps {
  jobs: Jobs;
  store: Store;
  /** Reverse proxies in front of this API (0 = none). See client-ip.ts. */
  trustedHops: number;
}

async function createScan({ jobs, store, trustedHops }: Deps, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: { url?: unknown; market?: unknown };
  try {
    body = (await readJson(req)) as typeof body;
  } catch (err) {
    return send(res, 400, { error: (err as Error).message });
  }
  const market = typeof body.market === 'string' && body.market ? body.market : undefined;
  if (market && !MARKETS.includes(market as Market)) return send(res, 400, { error: 'Unknown market', field: 'market' });
  if (typeof body.url !== 'string' || !body.url.trim()) return send(res, 400, { error: 'Enter your store address', field: 'url' });

  // Bare "mystore.com" is what customers type; the guard only accepts absolute http(s) URLs.
  const raw = /^[a-z][a-z0-9+.-]*:/i.test(body.url.trim()) ? body.url.trim() : `https://${body.url.trim()}`;
  let url: string;
  try {
    url = await assertSafeUrl(raw);
  } catch {
    return send(res, 400, { error: 'We could not reach that address. Check the spelling and use a public store URL.', field: 'url' });
  }
  if ((await store.hit(`ip:${clientIp(req.socket.remoteAddress, req.headers['x-forwarded-for'], trustedHops)}`, WINDOW_SEC)) > MAX_SCANS_PER_WINDOW) return send(res, 429, { error: 'Scan limit reached. Please try again in an hour.' });
  try {
    send(res, 202, { id: await jobs.start({ url, market }) });
  } catch (err) {
    if (err instanceof BusyError) return send(res, 503, { error: err.message });
    throw err;
  }
}

export const createApi = (deps: Deps): RequestListener => (req, res) => {
  const path = (req.url ?? '').split('?')[0] ?? '';
  const run = async (): Promise<void> => {
    if (req.method === 'POST' && path === '/api/scans') return createScan(deps, req, res);
    const id = /^\/api\/scans\/([\w-]+)$/.exec(path)?.[1];
    if (req.method === 'GET' && id) {
      const job = await deps.jobs.get(id);
      return job ? send(res, 200, job) : send(res, 404, { error: 'Scan not found or expired' });
    }
    send(res, 404, { error: 'Not found' });
  };
  run().catch((err: unknown) => {
    process.stderr.write(`api error: ${err instanceof Error ? err.message : String(err)}\n`);
    send(res, 500, { error: 'Something went wrong' });
  });
};
