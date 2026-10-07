import type { Finding, Rule } from '../../domain/types';
import { normalizeEventName } from '../../parsers/tiktok/events';

const ONCE_PER_ACTION = new Set(['ViewContent', 'AddToCart', 'InitiateCheckout']);

export const nameRules: Rule = (obs) => {
  const unknown = new Set<string>();
  const aliased = new Set<string>();
  for (const e of obs.events) {
    if (e.source === 'static') continue;
    const n = normalizeEventName(e.rawName);
    if (e.rawName === 'page' || n.internal) continue;
    if (!n.known) unknown.add(e.rawName);
    else if (n.aliasOf) aliased.add(`${n.aliasOf} -> ${n.name}`);
  }
  const out: Finding[] = [];
  if (unknown.size) out.push({ id: 'event.unknown_name', title: 'Event names that are not standard (treated as custom events)', status: 'detected' as const, severity: 'minor' as const, evidence: [...unknown], fix: 'Custom events cannot be used for campaign optimisation; use a standard event where one fits.' });
  if (aliased.size) out.push({ id: 'event.alias', title: 'Reserved event names in use (auto-mapped by TikTok)', status: 'detected' as const, severity: 'info' as const, evidence: [...aliased] });
  return out;
};

/** Same Pixel + same event + same phase fired repeatedly with different event_ids => possible double counting. Two different Pixels are not a duplicate: see pixel.multiple. */
export const duplicateRule: Rule = (obs) => {
  const seen = new Map<string, Set<string>>();
  for (const e of obs.events) {
    if (!ONCE_PER_ACTION.has(e.name) || e.source !== 'network') continue;
    const key = `${e.pixelId ? `${e.pixelId}:` : ''}${e.name}@${e.phase}`;
    const ids = seen.get(key) ?? new Set<string>();
    ids.add(e.eventId ?? `anon-${ids.size}`);
    seen.set(key, ids);
  }
  const dup = [...seen.entries()].filter(([, ids]) => ids.size > 1).map(([k, ids]) => `${k} x${ids.size}`);
  if (dup.length === 0) return [];
  return [{ id: 'event.duplicate', title: 'Same event fired more than once for one action', status: 'detected' as const, severity: 'minor' as const, evidence: dup, fix: 'Check for two Pixels or a Pixel plus a theme/app firing the same event; share event_id between browser and server.' }];
};

/** Events API is invisible from outside; we can only report whether event_id is present. */
export const serverSideRule: Rule = (obs) => {
  const withId = obs.events.some((e) => e.eventId);
  return [{
    id: 'serverside.events_api', title: withId ? 'event_id present on browser events (ready for deduplication)' : 'Events API (server-side) cannot be verified from outside',
    status: withId ? 'detected' : 'unverifiable', severity: 'info', evidence: [],
    fix: withId ? undefined : 'If Events API is used, send the same event_id from Pixel and server so TikTok deduplicates (48h window).',
  }];
};
