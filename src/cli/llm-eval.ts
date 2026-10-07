import './env';
import { parseArgs } from 'node:util';
import { LLM_MODEL } from '../config/llm';
import { reviewPage } from '../collectors/llm';
import type { LlmCapture, LlmClaimType, TrustCapture } from '../domain/types';
import { CLAIM_CASES, LINK_CASES } from '../poc/llm-cases';

const { values } = parseArgs({ options: { models: { type: 'string', default: LLM_MODEL }, repeat: { type: 'string', default: '1' } } });
const key = process.env['GOOGLE_GENAI_API_KEY'];
if (!key) {
  console.error('GOOGLE_GENAI_API_KEY is not set');
  process.exit(2);
}

/** Enough neutral text for the page to count as readable (500+ chars). */
const PAD = Array.from({ length: 12 }, (_, i) => `Our store ships worldwide and every order is packed with care, item number ${i + 1}.`).join('\n');
const FOOTER = Array.from({ length: 40 }, (_, i) => ({ text: `Info page ${i}`, href: `https://s.test/p/${i}` }));
const page = (text: string, links: TrustCapture['links'] = []): TrustCapture => ({ text: `${PAD}\n${text}`, links });
const pool = async <T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i] as T); }));
  return out;
};

for (const model of values.models!.split(',')) {
  let tp = 0, fn = 0, fp = 0, silent = 0, linkOk = 0, linkWrong = 0, linkMiss = 0, failed = 0, inTok = 0, outTok = 0, calls = 0;
  const notes: string[] = [];
  const t0 = Date.now();
  const used = (r: LlmCapture | undefined): void => { if (r) { inTok += r.usage.inputTokens; outTok += r.usage.outputTokens; calls += r.usage.calls; } };
  const repeat = Number(values.repeat);

  const claimRuns = await pool(CLAIM_CASES.flatMap((c) => Array.from({ length: repeat }, () => c)), 4, async (c) => ({ c, r: await reviewPage(page(c.text), { apiKey: key, model }) }));
  for (const { c, r } of claimRuns) {
    used(r);
    if (!r?.claimsChecked) { failed++; continue; }
    const got = new Set<LlmClaimType>(r.claims.map((x) => x.claim));
    for (const t of c.must) got.has(t) ? tp++ : (fn++, notes.push(`MISS ${c.id}: wanted ${t}, got [${[...got]}]`));
    for (const t of got) if (!c.must.includes(t) && !(c.allow ?? []).includes(t)) { fp++; notes.push(`FALSE ${c.id}: reported ${t}`); }
    if (c.must.length === 0 && got.size === 0) silent++;
  }
  const linkRuns = await pool(LINK_CASES.flatMap((c) => Array.from({ length: repeat }, () => c)), 4, async (c) => ({ c, r: await reviewPage(page('Nothing special here to report on this page today, just products.', [...FOOTER, ...c.links]), { apiKey: key, model }) }));
  for (const { c, r } of linkRuns) {
    used(r);
    if (!r) { failed++; continue; }
    // reviewPage only asks about policies the keyword rules cannot resolve; restrict expectations to those it was asked about.
    const asked = Object.entries(c.expect).filter(([p]) => c.wanted.includes(p as never));
    for (const [p, text] of asked) {
      const hit = r.policyLinks.find((x) => x.policy === p);
      hit ? (hit.text === text ? linkOk++ : (linkWrong++, notes.push(`WRONG link ${c.id}: ${p} -> ${hit.text}`))) : (linkMiss++, notes.push(`MISS link ${c.id}: ${p}`));
    }
    for (const x of r.policyLinks) if (!(x.policy in c.expect)) { linkWrong++; notes.push(`INVENTED link ${c.id}: ${x.policy} -> ${x.text}`); }
  }
  const secs = (Date.now() - t0) / 1000;
  console.log(`\n== ${model}  (${secs.toFixed(0)}s, ${calls} calls, ${failed} failed)`);
  console.log(`claims: recall ${tp}/${tp + fn}, false alarms ${fp}, clean negatives ${silent}/${CLAIM_CASES.filter((c) => !c.must.length).length * repeat}`);
  console.log(`links : correct ${linkOk}, wrong/invented ${linkWrong}, missed ${linkMiss}`);
  console.log(`tokens: ${inTok} in, ${outTok} out (avg ${Math.round(inTok / Math.max(1, calls))} in, ${Math.round(outTok / Math.max(1, calls))} out per call)`);
  for (const n of [...new Set(notes)]) console.log('  ' + n);
}
