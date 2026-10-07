import type { ScanSession } from '../collectors/browser-session';
import type { LlmOptions } from '../collectors/llm';
import type { ButtonInfo, CheckoutInfo, Phase, PhaseResult, Platform, TrustCapture } from '../domain/types';

export interface ScenarioState {
  /** Set by add-to-cart once a cart-add response confirmed the item is in the cart. */
  cartReady?: boolean;
  buyButton?: ButtonInfo;
  checkout?: CheckoutInfo;
  trust?: TrustCapture;
  platform: Platform;
  staticPixelIds: string[];
  productUrl?: string;
  consentClicked: boolean;
  consentBannerSeen: boolean;
}

export interface StepContext {
  session: ScanSession;
  targetUrl: string;
  state: ScenarioState;
  acceptConsent: boolean;
  /** Target market (PK, IQ, ...): lets the landing step pick the right country on a "select your country" page. */
  market?: string;
  /** Set when a Gemini key exists: lets a step ask the model for help getting past a page (never for a verdict). */
  ai?: LlmOptions;
}

/** One browser step = one funnel phase. Add checkout.ts later without touching the runner. */
export interface Step {
  phase: Phase;
  run(ctx: StepContext): Promise<PhaseResult>;
}
