import type { Rule } from '../../domain/types';
import { buyButton, checkoutSteps } from './funnel';
import { loadSpeed } from './speed';

/** Add new mobile rules here only. Order = report order. */
export const MOBILE_RULES: readonly Rule[] = [loadSpeed, buyButton, checkoutSteps];
