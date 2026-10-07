import './env';
import { parseArgs } from 'node:util';
import { pickPageLinks, reviewSite } from '../collectors/site-ai';
import { SITE_MODEL } from '../config/site';
import type { PageKind, TrustCapture, TrustPage } from '../domain/types';
import { IDENTITY_CASES, LINK_CASES, PAGE_CASES } from '../poc/site-cases';

const { values } = parseArgs({ options: { models: { type: 'string', default: SITE_MODEL }, repeat: { type: 'string', default: '2' } } });
const key = process.env['GOOGLE_GENAI_API_KEY'];
if (!key) {
  console.error('GOOGLE_GENAI_API_KEY is not set');
  process.exit(2);
}
const SITE = 'https://s.test/';
const NAV = Array.from({ length: 40 }, (_, i) => ({ text: i % 2 ? `Collection ${i}` : `Product ${i}`, href: `${SITE}${i % 2 ? 'collections' : 'products'}/p${i}` }));
/** Footer links every real store has: their names must not make a page look like a policy page. */
const FOOT = ['Refund Policy', 'Return Policy', 'Shipping Policy', 'Terms and Conditions', 'Privacy Policy'].map((text, i) => ({ text, href: `${SITE}pages/foot${i}` }));
const PAD = 'Welcome to our store. '.repeat(30);
const sets = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x) => b.includes(x));
const pool = async <T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i] as T); }));
  return out;
};

for (const model of values.models!.split(',')) {
  const o = { apiKey: key, model };
  const notes: string[] = [];
  const t0 = Date.now();
  const reps = Number(values.repeat);
  let calls = 0;

  // 1. Which links lead to which page. Right = a listed path; wrong = any other pick for the type, or any pick for an empty type.
  let linkOk = 0, linkMiss = 0, linkWrong = 0;
  const linkRuns = await pool(LINK_CASES.flatMap((c) => Array.from({ length: reps }, () => c)), 4, async (c) => {
    const trust: TrustCapture = { text: PAD, links: [...c.links.map(([text, p]) => ({ text, href: p.startsWith('http') ? p : `${SITE}${p.slice(1)}` })), ...NAV] };
    return { c, picks: await pickPageLinks(trust, SITE, o) };
  });
  for (const { c, picks } of linkRuns) {
    calls++;
    for (const [type, paths] of Object.entries(c.expect) as [PageKind, string[]][]) {
      const got = picks.filter((p) => p.kind === type).map((p) => new URL(p.url).pathname);
      if (!paths.length) { if (got.length) { linkWrong += got.length; notes.push(`LINK WRONG ${c.id}: ${type} -> ${got}`); } continue; }
      // Which page types a link serves is decided later, by reading the page: here the link only has to be opened (any type, hub included).
      if (picks.some((p) => paths.includes(new URL(p.url).pathname))) linkOk++; else { linkMiss++; notes.push(`LINK MISS ${c.id}: ${type} wanted ${paths}, got [${got}]`); }
      for (const g of got) if (!paths.includes(g) && !Object.values(c.expect).some((v) => v?.includes(g))) { linkWrong++; notes.push(`LINK WRONG ${c.id}: ${type} -> ${g}`); }
    }
  }

  // 2. What each page really covers. The costly error is claiming coverage the page does not have.
  let pageOk = 0, pageFalseCover = 0, pageMissCover = 0, secFalse = 0, secMiss = 0, subOk = 0, subN = 0, injected = 0;
  const pageRuns = await pool(Array.from({ length: reps }, () => 0), 2, async () => {
    const pages: TrustPage[] = PAGE_CASES.map((c, i) => ({ kind: c.assigned, url: `${SITE}pages/p${i}`, status: c.status ?? 200, title: c.title, text: c.text }));
    const trust: TrustCapture = { text: PAD, links: [...NAV, ...FOOT], footer: '© 2026 Test Shop', pages };
    await reviewSite(trust, o);
    return trust.pages!;
  });
  for (const pages of pageRuns) {
    calls++;
    PAGE_CASES.forEach((c, i) => {
      const ai = pages[i]?.ai;
      if (!ai) { pageMissCover++; notes.push(`PAGE NO VERDICT ${c.id}`); return; }
      const false_ = ai.covers.filter((x) => !c.covers.includes(x));
      const miss = c.covers.filter((x) => !ai.covers.includes(x));
      const wantSec = c.sections ?? [];
      const secF = (ai.sections ?? []).filter((x) => !wantSec.includes(x));
      const secM = wantSec.filter((x) => !(ai.sections ?? []).includes(x));
      if (secF.length) { secFalse++; notes.push(`PAGE FALSE SECTION ${c.id}: ${secF}`); }
      if (secM.length) { secMiss++; notes.push(`PAGE MISSED SECTION ${c.id}: ${secM}`); }
      if (!false_.length && !miss.length && !secF.length && !secM.length) pageOk++;
      if (false_.length) { pageFalseCover++; notes.push(`PAGE FALSE COVER ${c.id}: ${false_}`); if (c.id === 'injection') injected++; }
      if (miss.length) { pageMissCover++; notes.push(`PAGE MISSED ${c.id}: ${miss}`); }
      if (c.covers.length && c.substantial !== undefined) { subN++; if (ai.substantial === c.substantial) subOk++; else notes.push(`PAGE SUBSTANCE ${c.id}: got ${ai.substantial}`); }
    });
  }

  // 3. Who runs the store. Right = the value contains the expected text; wrong = a value where none is allowed.
  let idOk = 0, idMiss = 0, idWrong = 0;
  const idRuns = await pool(IDENTITY_CASES.flatMap((c) => Array.from({ length: reps }, () => c)), 4, async (c) => {
    const trust: TrustCapture = { text: `${PAD} ${c.footer}`, links: NAV, footer: c.footer, pages: [] };
    await reviewSite(trust, o);
    return { c, id: trust.identity ?? {} };
  });
  for (const { c, id } of idRuns) {
    calls++;
    for (const [k, want] of Object.entries(c.expect) as [keyof typeof id, string][]) (id[k] ?? '').toLowerCase().includes(want.toLowerCase()) ? idOk++ : (idMiss++, notes.push(`ID MISS ${c.id}: ${k} wanted ${want}, got ${id[k]}`));
    for (const k of c.none ?? []) if (id[k]) { idWrong++; notes.push(`ID WRONG ${c.id}: ${k} = ${id[k]}`); }
  }

  const n = PAGE_CASES.length * reps;
  console.log(`\n== ${model}  (${((Date.now() - t0) / 1000).toFixed(0)}s, ${calls} calls)`);
  console.log(`links   : right ${linkOk}, missed ${linkMiss}, wrong ${linkWrong}`);
  console.log(`pages   : exactly right ${pageOk}/${n}, false coverage ${pageFalseCover}, missed coverage ${pageMissCover}, false section ${secFalse}, missed section ${secMiss}, substance ${subOk}/${subN}, fooled by injected page ${injected}`);
  console.log(`identity: right ${idOk}, missed ${idMiss}, wrong ${idWrong}`);
  for (const x of [...new Set(notes)]) console.log('  ' + x);
}
