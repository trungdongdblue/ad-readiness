import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface GuardOptions {
  /** Only for local fixtures/tests. Never expose to end users. */
  allowPrivate?: boolean;
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a = 0, b = 0] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::1' || x === '::') return true;
    if (x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb')) return true; // link-local
    if (x.startsWith('fc') || x.startsWith('fd')) return true; // unique local
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    return mapped?.[1] ? isPrivateIp(mapped[1]) : false;
  }
  return true; // not an IP => treat as unsafe
}

/**
 * Validates a user-supplied URL before the browser touches it.
 * NOTE: DNS can change after this check (rebinding) and redirects can leave the checked host.
 * Production MUST also enforce egress rules at the network layer (see docs/ARCHITECTURE.md).
 */
export async function assertSafeUrl(raw: string, opts: GuardOptions = {}): Promise<string> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(`Blocked protocol: ${u.protocol}`);
  if (u.username || u.password) throw new Error('Blocked: URL contains credentials');
  if (opts.allowPrivate) return u.toString();

  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) throw new Error(`Blocked: ${host} resolves to a private or reserved address`);
  return u.toString();
}
