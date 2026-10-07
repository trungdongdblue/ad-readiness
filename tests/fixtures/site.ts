import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Mirrors the structure of TikTok's base code: load()/page() run inside the IIFE on the raw array. */
const BASE_CODE = (id: string) => `<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
  ttq.methods = ["page","track","identify"];
  ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
  for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
  ttq.load = function (e) {
    var o = document.createElement("script"); o.async = true;
    o.src = "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=" + e + "&lib=" + t;
    document.getElementsByTagName("script")[0].parentNode.insertBefore(o, document.getElementsByTagName("script")[0]);
  };
  ttq.load('${id}'); ttq.page();
}(window, document, 'ttq');
</script>`;

/** Stand-in for TikTok's events.js: replays the queue and POSTs JSON beacons. Wire format is ASSUMED (see payload.ts). */
export const STUB_EVENTS_JS = `(function () {
  var id = new URL(document.currentScript.src).searchParams.get('sdkid');
  function send(ev, props, opts) {
    fetch('https://analytics.tiktok.com/api/v2/pixel', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: ev, event_id: opts && opts.event_id, context: { pixel: { code: id }, page: { url: location.href } }, properties: props || {} }) }).catch(function () {});
  }
  var q = window.ttq; var queued = Array.prototype.slice.call(q);
  q.page = function () { send('Pageview'); };
  q.track = function (e, p, o) { send(e, p, o); };
  queued.forEach(function (c) { if (c[0] === 'page') send('Pageview'); if (c[0] === 'track') send(c[1], c[2], c[3]); });
})();`;

const PIXEL_ID = 'CTESTPIXEL0000000001';
export { PIXEL_ID };

/** A size picker that the store insists on, in the shapes real themes use. `soldout`: every size is disabled. */
export type Sizes = 'radio' | 'select' | 'buttons' | 'soldout' | 'struck';
const PICKER: Record<Sizes, string> = {
  radio: '<fieldset class="size-options"><legend>Select size</legend><a href="#">Size guide</a>' + ['S', 'M', 'L'].map((v) => `<label><input type="radio" name="size" value="${v}" style="display:none"> ${v}</label>`).join('') + '</fieldset>',
  select: '<select name="size"><option value="">Choose a size</option><option value="S" disabled>S</option><option value="M">M</option><option value="L">L</option></select>',
  buttons: '<div class="variant-sizes">' + ['S', 'M'].map((v) => `<button type="button" aria-pressed="false" data-size="${v}">${v}</button>`).join('') + '</div>',
  // Sold out shown only by a line through the label, as on outfitters.com.pk: S must be skipped.
  struck: '<fieldset class="size-options"><label style="text-decoration:line-through"><input type="radio" name="size" value="S" style="display:none"> S</label><label><input type="radio" name="size" value="M" style="display:none"> M</label></fieldset>',
  soldout: '<fieldset class="size-options">' + ['S', 'M'].map((v) => `<label><input type="radio" name="size" value="${v}" disabled> ${v}</label>`).join('') + '</fieldset>',
};
const CHOSEN: Record<Sizes, string> = {
  radio: "!!document.querySelector('input[name=size]:checked')",
  select: "!!document.querySelector('select[name=size]').value",
  buttons: "!!document.querySelector('[aria-pressed=true]')",
  soldout: 'false',
  struck: "!!document.querySelector('input[name=size]:checked')",
};
const WIRE_BUTTONS = "document.querySelectorAll('[data-size]').forEach(function (b) { b.onclick = function () { document.querySelectorAll('[data-size]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); }; });";

export function startFixtureServer(opts: { pixel: boolean; sizes?: Sizes; countryGate?: boolean }): Promise<{ url: string; close: () => Promise<void> }> {
  const base = opts.pixel ? BASE_CODE(PIXEL_ID) : '';
  const server: Server = createServer((req, res) => {
    // A store that opens on "Select your country" and shows nothing else until one is chosen (khaadi.com).
    if (opts.countryGate) {
      if (req.url?.startsWith('/choose')) { res.writeHead(302, { 'set-cookie': 'country=1; Path=/', location: '/' }); res.end(); return; }
      if (req.url === '/' && !req.headers.cookie?.includes('country=1')) {
        res.setHeader('content-type', 'text/html');
        res.end('<html><body><h2>Select Your Country</h2>' + ['Pakistan', 'United Kingdom', 'United States', 'Global'].map((c) => `<a href="/choose?c=${c}">${c}</a> `).join('') + '</body></html>');
        return;
      }
    }
    if (req.url === '/cart/add.js') { res.setHeader('content-type', 'application/json'); res.end('{}'); return; }
    res.setHeader('content-type', 'text/html');
    if (req.url?.startsWith('/checkout')) {
      res.end(`<html><head>${base}</head><body><form><input name="email"><input name="address"></form>
        <script>${opts.pixel ? "ttq.track('InitiateCheckout', { content_type: 'product', content_ids: ['1'], value: 10.5, currency: 'IQD' });" : ''}</script></body></html>`);
      return;
    }
    if (req.url?.startsWith('/products/widget')) {
      res.end(`<html><head>${base}</head><body><h1>Widget</h1>
        ${opts.sizes ? PICKER[opts.sizes] : ''}<p id="err"></p>
        <button id="atc">Add to cart</button>
        <script>
          ${opts.sizes === 'buttons' ? WIRE_BUTTONS : ''}
          ${opts.pixel ? "ttq.track('ViewContent', { content_type: 'product', content_ids: ['1'], value: 10.5, currency: 'USD' });" : ''}
          document.getElementById('atc').onclick = function () {
            ${opts.sizes ? `if (!(${CHOSEN[opts.sizes]})) { document.getElementById('err').textContent = '*Please select the size'; return; }` : ''}
            fetch('/cart/add.js', { method: 'POST' });
            ${opts.pixel ? "ttq.track('AddToCart', { content_type: 'product', content_ids: ['1'], value: 10.5, currency: 'IQD' }, { event_id: 'e1' });" : ''}
          };
        </script></body></html>`);
      return;
    }
    res.end(`<html><head>${base}</head><body><a href="/products/widget">Widget</a><p>${'Welcome to our widget shop, free delivery on every order. '.repeat(12)}</p></body></html>`);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}
