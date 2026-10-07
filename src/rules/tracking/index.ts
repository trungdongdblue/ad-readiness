import type { Rule } from '../../domain/types';
import { eventCoverage, purchaseRule } from './coverage';
import { paramRules } from './params';
import { pixelPresent, pixelSilent } from './pixel';
import { duplicateRule, nameRules, serverSideRule } from './quality';

/** Add new rules here only. Order = report order. */
export const TRACKING_RULES: readonly Rule[] = [pixelPresent, pixelSilent, eventCoverage, purchaseRule, paramRules, nameRules, duplicateRule, serverSideRule];
