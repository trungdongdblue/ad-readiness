/**
 * Currencies TikTok accepts in the `currency` parameter.
 * Source: help article "About Parameters" (updated 2026-03). NOTE: IQD and JOD are not listed.
 * Re-verify before each release; the list changes.
 */
export const SUPPORTED_CURRENCIES: ReadonlySet<string> = new Set(
  ('AED ARS AUD BDT BHD BIF BOB BRL CAD CHF CLP CNY COP CRC CZK DKK DZD EGP EUR GBP GTQ HKD HNL HUF IDR ILS INR ISK JPY KES KHR KRW KWD KZT ' +
    'MAD MOP MXN MYR NGN NIO NOK NZD OMR PEN PHP PKR PLN PYG QAR RON RUB SAR SEK SGD THB TRY TWD UAH USD VES VND ZAR').split(' '),
);
