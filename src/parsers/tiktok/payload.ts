/**
 * Best-effort decoder for browser-pixel beacons.
 * The wire format is NOT documented officially; the shapes below come from third-party sources
 * (Omnibug PR #113, 2020; Events API docs) and CONFIRMED by recon on a live Shopify store (2026-10-01):
 * POST /api/v2/pixel with {event, event_id, context.pixel.code, properties}, plus GET ?analytics_message=<base64>.
 * Anything undecodable is counted, never guessed.
 * Run `npm run scan -- <url> --recon` to capture real samples and extend this file.
 */
export interface RawEvent {
  name: string;
  pixelId?: string;
  eventId?: string;
  params: Record<string, unknown>;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

function tryJson(text: string | null): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function items(body: unknown): Obj[] {
  if (Array.isArray(body)) return body.filter(isObj);
  if (!isObj(body)) return [];
  for (const key of ['batch', 'data', 'events']) {
    const v = body[key];
    if (Array.isArray(v)) {
      return v.filter(isObj).map((i) => ({ ...i, pixel_code: i.pixel_code ?? body.pixel_code ?? body.event_source_id }));
    }
  }
  return [body];
}

/** GET beacons carry the same JSON, base64-encoded, in `analytics_message` (observed on a live store, 2026-10). */
function fromAnalyticsMessage(query: URLSearchParams): unknown {
  const raw = query.get('analytics_message');
  if (!raw) return undefined;
  try {
    return tryJson(Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return undefined;
  }
}

export function decodeBeacon(url: string, postData: string | null): RawEvent[] {
  let query: URLSearchParams;
  try {
    query = new URL(url).searchParams;
  } catch {
    return [];
  }
  const out: RawEvent[] = [];
  for (const it of items(tryJson(postData) ?? fromAnalyticsMessage(query))) {
    const name = str(it.event) ?? str(it.event_name);
    if (!name) continue;
    const ctx = isObj(it.context) ? it.context : {};
    const pixel = isObj(ctx.pixel) ? ctx.pixel : {};
    const props = (([it.properties, it.params, it.parameters, ctx.properties].find(isObj) ?? {}) as Obj);
    out.push({
      name,
      pixelId:
        str(pixel.code) ?? str(it.pixel_code) ?? str(it.event_source_id) ?? query.get('pixel_code') ?? query.get('sdkid') ?? undefined,
      eventId: str(it.event_id) ?? str(props.event_id),
      params: props,
    });
  }
  if (out.length === 0) {
    const name = query.get('event') ?? query.get('event_name');
    if (name) out.push({ name, pixelId: query.get('pixel_code') ?? query.get('sdkid') ?? undefined, params: {} });
  }
  return out;
}
