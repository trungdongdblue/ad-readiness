export const SETTLE = { idleMs: 8_000, extraMs: 2_500 } as const;
export const NAV_TIMEOUT_MS = 30_000;
export const DEVICE = 'Pixel 7';

/** Button / link labels that add a product to cart (EN, VI, AR). Extend per market. */
export const ADD_TO_CART_RE =
  /add to (cart|bag|basket)|buy now|order now|add-to-cart|thêm vào giỏ|mua ngay|أضف إلى السلة|اضف الى السلة|اطلب الآن|اشتري الآن/i;

export const CONSENT_ACCEPT_RE = /accept( all)?|agree|allow all|got it|ok$|موافق|قبول|đồng ý/i;
