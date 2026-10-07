import type { Rule } from '../../domain/types';
import { companyInfo, paymentInfo, priceCurrency, priceShown } from './info';
import { contactInfo, privacyPolicy, refundPolicy, shippingInfo, termsPolicy } from './rules';

/** Add new trust rules here only. Order = report order. */
export const TRUST_RULES: readonly Rule[] = [refundPolicy, termsPolicy, privacyPolicy, shippingInfo, contactInfo, companyInfo, priceShown, priceCurrency, paymentInfo];
