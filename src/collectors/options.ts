import type { Page } from 'playwright';
import { ADD_TO_CART_RE } from '../config/constants';
import type { Control } from '../parsers/options';
import { NOT_MAIN } from './main-button';

/**
 * Reads the option controls of a product page (sizes, colours, variants) and tags each with data-adr-i so it can be clicked later.
 * A string, not a function: tsx/esbuild injects a `__name` helper into named inner functions that does not exist in the page.
 * Only controls inside something that looks like an option group are listed, so random buttons are never offered.
 */
const SNAPSHOT_JS = `(() => {
  const NOT_MAIN_SEL = ${JSON.stringify(NOT_MAIN)};
  document.querySelectorAll('[data-adr-i]').forEach((e) => e.removeAttribute('data-adr-i'));
  const OPT = '[class*="size" i],[class*="swatch" i],[class*="variant" i],[class*="option" i],[class*="colo" i],[id*="size" i],[id*="variant" i],[id*="option" i],[id*="colo" i],[aria-label*="size" i],[aria-label*="colo" i],fieldset,[role="radiogroup"],[role="group"]';
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest(NOT_MAIN_SEL); };
  const txt = (e) => (e.getAttribute('aria-label') || e.textContent || e.value || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
  // Sold out is shown in many ways: disabled, a class, "sold out" text, a line through the label, or taps switched off.
  const dis = (e) => e.disabled === true || e.getAttribute('aria-disabled') === 'true' || /(sold|unavailable|out-of-stock|disabled)/i.test(String(e.className)) || /sold out|out of stock|unavailable|نفد/i.test(e.textContent || '') || getComputedStyle(e).pointerEvents === 'none' || [e, ...e.querySelectorAll('*')].slice(0, 3).some((x) => getComputedStyle(x).textDecorationLine.includes('line-through'));
  const groups = new Map();
  const gid = (e, hint) => { const c = e.closest(OPT); if (!c) return hint; if (!groups.has(c)) groups.set(c, 'g' + groups.size); return groups.get(c); };
  const out = [];
  const add = (el, kind, group, label, disabled, selected) => { if (out.length >= 60) return; el.setAttribute('data-adr-i', String(out.length)); out.push({ i: out.length, kind, group, label, disabled, selected }); };
  document.querySelectorAll('input[type=radio]').forEach((inp) => {
    const lab = inp.id ? document.querySelector('label[for="' + inp.id + '"]') : inp.closest('label');
    const target = vis(inp) ? inp : lab && vis(lab) ? lab : null;
    if (target) add(target, 'radio', 'n:' + (inp.name || gid(inp, 'x')), txt(lab || inp) || inp.value, inp.disabled || dis(lab || inp), inp.checked);
  });
  document.querySelectorAll('[role=radio],[role=option]').forEach((e) => {
    if (vis(e)) add(e, 'radio', gid(e, 'x'), txt(e), dis(e), e.getAttribute('aria-checked') === 'true' || e.getAttribute('aria-selected') === 'true');
  });
  document.querySelectorAll('select').forEach((s) => {
    if (!vis(s)) return;
    const opts = [...s.options];
    const ph = (o, k) => k === 0 && (o.value === '' || /select|choose|اختر|--/i.test(o.text));
    const cand = opts.find((o, k) => !ph(o, k) && !o.disabled);
    const cur = opts[s.selectedIndex];
    const chosen = Boolean(cur) && !ph(cur, s.selectedIndex);
    add(s, 'select', 's:' + (s.name || s.id), cand ? cand.text.trim().slice(0, 40) : cur ? cur.text.trim().slice(0, 40) : '', !cand && !chosen, chosen);
    if (cand) s.setAttribute('data-adr-v', cand.value);
  });
  document.querySelectorAll('button,[role=button],li,label,[tabindex="0"]').forEach((e) => {
    if (e.hasAttribute('data-adr-i') || e.querySelector('[data-adr-i],input,select,button,li') || !e.closest(OPT) || !vis(e)) return;
    const t = txt(e);
    if (!t || t.length > 14) return;
    const sel = ['aria-pressed', 'aria-checked', 'aria-selected'].some((a) => e.getAttribute(a) === 'true') || /(^|[\\s_-])(selected|active|checked|current)([\\s_-]|$)/i.test(String(e.className));
    add(e, 'button', gid(e, 'x'), t, e.disabled === true || dis(e), sel);
  });
  return out;
})()`;

/** Messages the store showed because an option is missing, for example "*Please select the size". */
const ERRORS_JS = `(() => {
  const re = /(please|must|kindly|required|مطلوب|الرجاء)/i;
  const pick = /(size|colou?r|variant|option|select|choose|مقاس|لون|اختر)/i;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  return [...document.querySelectorAll('p,span,div,small,label,li,[role=alert]')]
    .filter((e) => e.children.length === 0 && vis(e) && (e.textContent || '').length < 80 && re.test(e.textContent || '') && pick.test(e.textContent || ''))
    .map((e) => (e.textContent || '').trim()).slice(0, 3);
})()`;

export async function snapshotControls(page: Page): Promise<Control[]> {
  const all = (await page.evaluate(SNAPSHOT_JS).catch(() => [])) as Control[];
  // The Add to cart button itself can sit inside an option group; it is never an option.
  return all.filter((c) => !ADD_TO_CART_RE.test(c.label));
}

export const pageErrors = async (page: Page): Promise<string[]> => ((await page.evaluate(ERRORS_JS).catch(() => [])) as string[]);

/** Picks one option, found again by group and label because a page often re-renders after each choice. Returns false when it is gone. */
export async function choose(page: Page, want: Pick<Control, 'group' | 'label'>): Promise<boolean> {
  const c = (await snapshotControls(page)).find((x) => x.group === want.group && x.label === want.label && !x.disabled);
  if (!c) return false;
  const el = page.locator(`[data-adr-i="${c.i}"]`).first();
  try {
    if (c.kind === 'select') await el.selectOption((await el.getAttribute('data-adr-v')) ?? '', { timeout: 3_000 });
    else await el.click({ timeout: 3_000 });
    await page.waitForTimeout(400);
    return true;
  } catch {
    return false;
  }
}
