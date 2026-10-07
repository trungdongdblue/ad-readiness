/**
 * The address to rate-limit on. `trustedHops` is how many reverse proxies you run in front of the API
 * (each appends the address it saw to X-Forwarded-For). Never trust more entries than you run: the left side is client-controlled.
 */
export function clientIp(socketAddr: string | undefined, forwardedFor: string | string[] | undefined, trustedHops: number): string {
  const fallback = socketAddr ?? 'unknown';
  if (trustedHops <= 0) return fallback;
  const chain = (Array.isArray(forwardedFor) ? forwardedFor.join(',') : (forwardedFor ?? '')).split(',').map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - trustedHops] ?? fallback;
}
