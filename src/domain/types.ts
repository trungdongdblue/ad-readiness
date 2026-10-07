/** Pure domain types. No I/O, no imports from other layers. */

export type Platform = 'shopify' | 'woocommerce' | 'wix' | 'shoplazza' | 'unknown';
export type Phase = 'landing' | 'product' | 'add-to-cart' | 'checkout';
export type EvidenceSource = 'network' | 'ttq-hook' | 'static';

/** verified = seen on the wire; detected = indirect evidence; unverifiable = cannot be checked externally; missing = checked and absent. */
export type Status = 'verified' | 'detected' | 'unverifiable' | 'missing';
export type Severity = 'blocker' | 'major' | 'minor' | 'info';

export interface CapturedRequest {
  phase: Phase;
  url: string;
  method: string;
  postData: string | null;
  /** true when the harness answered locally so nothing reached TikTok. */
  blocked: boolean;
}

export interface TtqCall {
  phase: Phase;
  method: string;
  args: unknown[];
}

export interface PhaseResult {
  phase: Phase;
  reached: boolean;
  url: string;
  note?: string;
}

/** Median of emulated mobile loads (see collectors/perf.ts). Times in ms. */
export interface PerfMetrics {
  lcpMs?: number;
  fcpMs?: number;
  ttfbMs?: number;
  cls?: number;
  /** Total blocking time: lab stand-in for INP, which needs real users. */
  tbtMs?: number;
  runs: number;
}

export interface ButtonInfo {
  label: string;
  widthPx: number;
  heightPx: number;
  inFirstScreen: boolean;
  /** WCAG contrast ratio; undefined when the background is not a solid colour. */
  contrast?: number;
}

/** First checkout screen only: later steps need data entry, which we never do. */
export interface CheckoutInfo {
  fields: number;
  breadcrumbSteps: number;
}

/** What a crawled page is for. `hub` = a general Policies / Legal page that links to the real ones. */
export type PageKind = 'refund' | 'terms' | 'privacy' | 'shipping' | 'contact' | 'about' | 'faq' | 'hub';

/** One extra page opened after the funnel to look for information. `status` 0 = never loaded (timeout, unsafe address). */
export interface TrustPage {
  kind: PageKind;
  url: string;
  status: number;
  text: string;
  /** The page's own name: <title> and first heading, or the link text for a section. Often says more than the URL. */
  title?: string;
  /** Set when this is one section of a bigger page (a link like /guide#returns): the kind of that page. */
  sectionOf?: PageKind;
  /** Names hidden in icons and mailto/tel links. Kept apart from `text` so the AI reads only what a shopper sees. */
  hints?: string;
  /** The AI's reading of the page: which page types it is mainly about (none = a form, a stub, a list, an error), and which others it has a real section on. Absent = not reviewed. */
  ai?: { covers: PageKind[]; sections?: PageKind[]; substantial: boolean };
}

/** Who runs the store, as the AI read it. Every value is a quote that was found verbatim in the site text. */
export interface SiteIdentity {
  brand?: string;
  company?: string;
  address?: string;
  phone?: string;
  email?: string;
}

/** Plain facts read from the landing and product pages. Rules judge them (docs/COMPLIANCE-RULES.md). */
export interface TrustCapture {
  links: { text: string; href: string }[];
  /** Visible text plus image alt/title (payment icons). */
  text: string;
  /** Footer text of the landing page (identity lives there). */
  footer?: string;
  identity?: SiteIdentity;
  /** Pages opened by the site crawl. Absent = the crawl did not run, so absence of a fact proves nothing. */
  pages?: TrustPage[];
}

/** Real-user p75 from the Chrome UX Report (28-day, phone). `level` says whether it is this page or the whole domain. */
export interface FieldMetrics {
  level: 'url' | 'origin';
  lcpMs?: number;
  inpMs?: number;
  cls?: number;
  fcpMs?: number;
  ttfbMs?: number;
}

export interface MobileCapture {
  /** Lab (emulated) load, only measured when no real-user data exists. */
  perf?: PerfMetrics;
  field?: FieldMetrics;
  /** Why `field` is absent (no key, no data, API error). */
  fieldNote?: string;
  buyButton?: ButtonInfo;
  checkout?: CheckoutInfo;
}

export type LlmClaimType = 'medical' | 'exaggerated' | 'weight' | 'before_after';
export type LlmPolicy = 'refund' | 'terms' | 'privacy' | 'shipping';

/**
 * What the language model added on top of the keyword rules. Every item is already verified against the page
 * (quote found verbatim, link really on the page), so rules can treat it as a plain fact. Absent = model not used or failed.
 */
export interface LlmCapture {
  model: string;
  /** false when the claims call failed or was skipped: an empty `claims` then means "unknown", not "none found". */
  claimsChecked: boolean;
  claims: { claim: LlmClaimType; quote: string }[];
  /** Policy pages the keyword rules could not find a link for but the model identified. Empty when the model was not asked. */
  policyLinks: { policy: LlmPolicy; text: string; href: string }[];
  usage: { inputTokens: number; outputTokens: number; calls: number };
}

/** Raw output of the browser layer. */
export interface Capture {
  mobile?: MobileCapture;
  trust?: TrustCapture;
  llm?: LlmCapture;
  target: string;
  finalUrl: string;
  platform: Platform;
  consentClicked: boolean;
  consentBannerSeen: boolean;
  staticPixelIds: string[];
  requests: CapturedRequest[];
  ttqCalls: TtqCall[];
  phases: PhaseResult[];
  errors: string[];
  durationMs: number;
}

export interface PixelHit {
  id: string;
  source: EvidenceSource;
  phase: Phase;
}

export interface EventHit {
  name: string;
  rawName: string;
  pixelId?: string;
  eventId?: string;
  params: Record<string, unknown>;
  source: EvidenceSource;
  phase: Phase;
}

/** Normalised facts derived from a Capture. Rules only ever read this. */
export interface Observation {
  mobile?: MobileCapture;
  trust?: TrustCapture;
  llm?: LlmCapture;
  platform: Platform;
  pixels: PixelHit[];
  events: EventHit[];
  undecodedBeacons: number;
  consentClicked: boolean;
  consentBannerSeen: boolean;
  phases: PhaseResult[];
}

/** A measured number with its own thresholds, so a UI can draw it without knowing the rule. */
export interface Metric {
  key: 'lcp' | 'inp' | 'cls';
  value: number;
  unit: 'ms' | '';
  /** At or below this is good; above `poor` is poor; between is "needs improvement". */
  good: number;
  poor: number;
  grade: 'good' | 'needs' | 'poor';
}

/** Where a finding's rule comes from. `date`: TikTok's last-update month on the page, or the day we read it. */
export interface Source {
  kind: 'tiktok' | 'third-party' | 'observed';
  title: string;
  url?: string;
  date?: string;
}

export interface Finding {
  id: string;
  title: string;
  status: Status;
  severity: Severity;
  evidence: string[];
  /** Added by `analyze` from `rules/sources.ts`; a finding with no entry there has none. */
  source?: Source[];
  fix?: string;
  metrics?: Metric[];
}

export interface RuleContext {
  market?: string;
}

export type Rule = (obs: Observation, ctx: RuleContext) => Finding[];

export interface Report {
  version: 1;
  target: string;
  finalUrl: string;
  market?: string;
  platform: Platform;
  pixels: string[];
  events: { name: string; count: number; sources: EvidenceSource[]; phases: Phase[] }[];
  undecodedBeacons: number;
  consentBannerSeen: boolean;
  consentClicked: boolean;
  findings: Finding[];
  phases: PhaseResult[];
  errors: string[];
  durationMs: number;
}
