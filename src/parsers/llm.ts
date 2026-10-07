import type { LlmClaimType, LlmPolicy, TrustCapture } from '../domain/types';

/** Pure helpers around the model call: shrink what we send, and refuse anything we cannot verify in what comes back. */

const CLAIMS: readonly LlmClaimType[] = ['medical', 'exaggerated', 'weight', 'before_after'];
const POLICIES: readonly LlmPolicy[] = ['refund', 'terms', 'privacy', 'shipping'];
const MAX_QUOTE = 200;
const MAX_PER_CLAIM = 3;
const MIN_WORDS = 3;

const norm = (s: string): string => s.normalize('NFKC').toLowerCase().replace(/[\s​-‏]+/g, ' ').trim();

/**
 * Page text cut down to what can hold a claim: one copy of each line, no menu items (they are already in `links`),
 * no one- or two-word UI labels. Capped so one scan costs the same on a 2k-char and a 40k-char page.
 */
export function condenseText(t: TrustCapture, maxChars: number): string {
  const menu = new Set(t.links.map((l) => norm(l.text)));
  const seen = new Set<string>();
  const out: string[] = [];
  let size = 0;
  for (const raw of t.text.split(/\n+/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const key = norm(line);
    if (line.split(' ').length < MIN_WORDS || menu.has(key) || seen.has(key)) continue;
    if (size + line.length > maxChars) break;
    seen.add(key);
    out.push(line);
    size += line.length + 1;
  }
  return out.join('\n');
}

/** Distinct links as `index|text|/path`, the shape the model is asked to answer by index. Capped. */
export function condenseLinks(links: TrustCapture['links'], max: number): { index: number; text: string; path: string }[] {
  const seen = new Set<string>();
  const out: { index: number; text: string; path: string }[] = [];
  links.forEach((l, index) => {
    let path = l.href;
    try {
      const u = new URL(l.href);
      path = u.pathname + u.hash;
    } catch {
      /* keep raw href */
    }
    const text = l.text.replace(/\s+/g, ' ').trim().slice(0, 40);
    const key = `${norm(text)}|${path}`;
    if (!text || seen.has(key) || out.length >= max) return;
    seen.add(key);
    out.push({ index, text, path });
  });
  return out;
}

interface RawClaim {
  claim?: unknown;
  quote?: unknown;
}

/** Keeps a claim only if its quote really occurs in the page text. A made-up quote can never become a finding (hard rule 4). */
export function verifyClaims(raw: unknown, pageText: string): { claim: LlmClaimType; quote: string }[] {
  if (!Array.isArray(raw)) return [];
  const haystack = norm(pageText);
  const perClaim = new Map<LlmClaimType, number>();
  const seen = new Set<string>();
  const out: { claim: LlmClaimType; quote: string }[] = [];
  for (const r of raw as RawClaim[]) {
    if (typeof r?.quote !== 'string' || !CLAIMS.includes(r.claim as LlmClaimType)) continue;
    const quote = r.quote.replace(/\s+/g, ' ').trim();
    const claim = r.claim as LlmClaimType;
    const key = `${claim}|${norm(quote)}`;
    if (quote.length < 6 || quote.length > MAX_QUOTE || seen.has(key) || !haystack.includes(norm(quote))) continue;
    if ((perClaim.get(claim) ?? 0) >= MAX_PER_CLAIM) continue;
    seen.add(key);
    perClaim.set(claim, (perClaim.get(claim) ?? 0) + 1);
    out.push({ claim, quote });
  }
  return out;
}

interface RawLink {
  policy?: unknown;
  index?: unknown;
}

/** Maps the model's answers (by index) back to real links; unknown indexes or policies are dropped, one link per policy. */
export function verifyLinks(raw: unknown, links: TrustCapture['links'], wanted: readonly LlmPolicy[]): { policy: LlmPolicy; text: string; href: string }[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<LlmPolicy, { policy: LlmPolicy; text: string; href: string }>();
  for (const r of raw as RawLink[]) {
    const link = typeof r?.index === 'number' ? links[r.index] : undefined;
    const policy = r?.policy as LlmPolicy;
    if (link && POLICIES.includes(policy) && wanted.includes(policy) && !out.has(policy)) out.set(policy, { policy, text: link.text.trim().slice(0, 60), href: link.href });
  }
  return [...out.values()];
}

/** Evidence lists from the keyword rules and the model describe the same phrase twice; keep one. */
export function mergeEvidence(regexHits: readonly string[], llmQuotes: readonly string[]): string[] {
  const seen = regexHits.map(norm);
  const fresh = llmQuotes.filter((q) => !seen.some((h) => h.includes(norm(q)) || norm(q).includes(h.replace(/^"|"$/g, ''))));
  return [...regexHits, ...fresh.map((q) => `AI: "${q}"`)];
}
