import { addToCartStep } from './add-to-cart';
import { checkoutStep } from './checkout';
import { landingStep } from './landing';
import { productStep } from './product';
import type { Step } from './types';

/** Funnel order. Checkout only opens the page; it never types or submits. */
export const STEPS: readonly Step[] = [landingStep, productStep, addToCartStep, checkoutStep];
