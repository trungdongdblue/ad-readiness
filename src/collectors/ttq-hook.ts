/**
 * Init script injected into every frame. Wraps window.ttq in a Proxy and reports track/page/identify
 * calls through the exposed binding. Independent of the (undocumented) beacon wire format.
 * Limitation: calls made inside TikTok's own library via Event Builder rules are not visible here;
 * the network layer covers those.
 */
export const TTQ_HOOK_SCRIPT = `
(() => {
  if (window.__adrHooked) return;
  window.__adrHooked = true;
  const TRACKED = new Set(['track', 'page', 'identify']);
  const report = (method, args) => {
    try { window.__adrReport && window.__adrReport({ method, args: JSON.parse(JSON.stringify(args)) }); } catch (_) {}
  };
  const wrap = (t) => {
    if (!t || typeof t !== 'object') return t;
    const proxy = new Proxy(t, {
      get(target, prop) {
        const v = Reflect.get(target, prop);
        if (typeof prop === 'string' && TRACKED.has(prop) && typeof v === 'function') {
          return function (...args) { report(prop, args); return v.apply(target, args); };
        }
        return v;
      },
    });
    return proxy;
  };
  let current;
  try {
    Object.defineProperty(window, 'ttq', { configurable: true, enumerable: true, get() { return current; }, set(v) { current = wrap(v); } });
  } catch (_) {}
})();
`;
