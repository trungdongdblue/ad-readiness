import type { Finding, Rule } from '../../domain/types';
import { phaseNote, reached } from '../tracking/helpers';

const MIN_TAP_PX = 44;
const MIN_CONTRAST = 3;

export const buyButton: Rule = (obs): Finding[] => {
  const b = obs.mobile?.buyButton;
  if (!b) {
    const why = reached(obs, 'product') ? 'no buy button found' : phaseNote(obs, 'product');
    return [{ id: 'mobile.buy_button', title: 'Buy button could not be checked', status: 'unverifiable', severity: 'info', evidence: [why] }];
  }
  const issues = [
    ...(b.inFirstScreen ? [] : ['below the first screen (needs scrolling)']),
    ...(Math.min(b.widthPx, b.heightPx) < MIN_TAP_PX ? [`tap target ${b.widthPx}x${b.heightPx}px, under ${MIN_TAP_PX}px`] : []),
    ...(b.contrast !== undefined && b.contrast < MIN_CONTRAST ? [`contrast ${b.contrast.toFixed(1)}:1, under ${MIN_CONTRAST}:1`] : []),
  ];
  const evidence = [`"${b.label}"`, `${b.widthPx}x${b.heightPx}px`, b.inFirstScreen ? 'in first screen' : 'below first screen', b.contrast === undefined ? 'contrast n/a' : `contrast ${b.contrast.toFixed(1)}:1`];
  return [{
    id: 'mobile.buy_button',
    title: issues.length ? `Buy button: ${issues.join('; ')}` : 'Buy button is visible and large enough',
    status: 'detected', severity: issues.length ? 'minor' : 'info', evidence,
    fix: issues.length ? 'Keep one clear, large buy button in the first mobile screen (TikTok website advertising guide).' : undefined,
  }];
};

/** Counts only: no source defines a good/bad number of checkout fields, so no judgement (docs/MOBILE-RULES.md). */
export const checkoutSteps: Rule = (obs): Finding[] => {
  const c = obs.mobile?.checkout;
  if (!reached(obs, 'checkout') || !c) {
    return [{ id: 'mobile.checkout', title: 'Checkout could not be checked', status: 'unverifiable', severity: 'info', evidence: [phaseNote(obs, 'checkout')] }];
  }
  const steps = c.breadcrumbSteps > 0 ? `${c.breadcrumbSteps}-step indicator` : 'no step indicator';
  return [{
    id: 'mobile.checkout', title: `Checkout first screen: ${c.fields} visible fields, ${steps}`, status: 'detected', severity: 'info',
    evidence: [`${c.fields} fields`, steps, 'later steps not observable (no data entry)'],
  }];
};
