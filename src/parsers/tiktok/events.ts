/**
 * Event name normalisation.
 * Standard list: help article "Standard Events and Parameters" (updated 2026-04).
 * Aliases: help article "About reserved events" (updated 2025-09).
 */
const STANDARD = [
  'AddPaymentInfo', 'AddToCart', 'AddToWishlist', 'ApplicationApproval', 'CompleteRegistration',
  'Contact', 'CustomizeProduct', 'Download', 'FindLocation', 'InitiateCheckout', 'Purchase',
  'Schedule', 'Search', 'StartTrial', 'SubmitApplication', 'SubmitForm', 'Subscribe', 'ViewContent',
  // Appear as alias targets / Pixel Helper output but not in the standard table:
  'PageView', 'PlaceAnOrder', 'ClickButton',
] as const;

const ALIASES: Record<string, string> = {
  addbilling: 'AddPaymentInfo',
  browse: 'PageView',
  checkout: 'PlaceAnOrder',
  clickform: 'SubmitForm',
  clickindownloadpage: 'ClickButton',
  clicktodownload: 'Download',
  consult: 'Contact',
  consultbyphone: 'Contact',
  completepayment: 'Purchase',
  registration: 'CompleteRegistration',
  startcheckout: 'InitiateCheckout',
  viewconsultationpage: 'ViewContent',
  viewdownloadpage: 'ViewContent',
  viewform: 'ViewContent',
};

const BY_LOWER = new Map<string, string>(STANDARD.map((n) => [n.toLowerCase(), n]));

/** Emitted by the Pixel library itself (seen in recon, 2026-10-01). Not advertiser-defined; never flag. */
const INTERNAL = new Set(['landingpageview', 'engagedsession']);

export interface NormalizedEvent {
  name: string;
  /** true when the raw name is a standard event, a documented alias, or a Pixel-internal event. */
  known: boolean;
  aliasOf?: string;
  internal?: boolean;
}

export function normalizeEventName(raw: string): NormalizedEvent {
  const key = raw.trim().toLowerCase();
  if (INTERNAL.has(key)) return { name: raw.trim(), known: true, internal: true };
  const alias = ALIASES[key];
  if (alias) return { name: alias, known: true, aliasOf: raw.trim() };
  const std = BY_LOWER.get(key);
  if (std) return { name: std, known: true };
  return { name: raw.trim(), known: false };
}
