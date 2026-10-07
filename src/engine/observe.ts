import type { Capture, EventHit, Observation, PixelHit } from '../domain/types';
import { isPixelBeacon, isPixelScript, pixelIdFromScriptUrl } from '../parsers/tiktok/hosts';
import { normalizeEventName } from '../parsers/tiktok/events';
import { decodeBeacon } from '../parsers/tiktok/payload';

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : {});

/** Capture -> Observation. Pure: no I/O. */
export function observe(cap: Capture): Observation {
  const pixels: PixelHit[] = [];
  const events: EventHit[] = [];
  let undecodedBeacons = 0;

  for (const id of cap.staticPixelIds) pixels.push({ id, source: 'static', phase: 'landing' });

  for (const r of cap.requests) {
    if (isPixelScript(r.url)) {
      const id = pixelIdFromScriptUrl(r.url);
      if (id) pixels.push({ id, source: 'network', phase: r.phase });
      continue;
    }
    if (!isPixelBeacon(r.url)) continue;
    const decoded = decodeBeacon(r.url, r.postData);
    if (decoded.length === 0) undecodedBeacons += 1;
    for (const d of decoded) {
      const n = normalizeEventName(d.name);
      events.push({ name: n.name, rawName: d.name, pixelId: d.pixelId, eventId: d.eventId, params: d.params, source: 'network', phase: r.phase });
      if (d.pixelId) pixels.push({ id: d.pixelId, source: 'network', phase: r.phase });
    }
  }

  for (const c of cap.ttqCalls) {
    if (c.method === 'page') {
      events.push({ name: 'PageView', rawName: 'page', params: {}, source: 'ttq-hook', phase: c.phase });
      continue;
    }
    if (c.method !== 'track' || typeof c.args[0] !== 'string') continue;
    const raw = c.args[0];
    const params = asObj(c.args[1]);
    const opts = asObj(c.args[2]);
    const eventId = typeof opts.event_id === 'string' ? opts.event_id : typeof params.event_id === 'string' ? params.event_id : undefined;
    events.push({ name: normalizeEventName(raw).name, rawName: raw, eventId, params, source: 'ttq-hook', phase: c.phase });
  }

  return { mobile: cap.mobile, trust: cap.trust, llm: cap.llm, platform: cap.platform, pixels, events, undecodedBeacons, consentClicked: cap.consentClicked, consentBannerSeen: cap.consentBannerSeen, phases: cap.phases };
}
