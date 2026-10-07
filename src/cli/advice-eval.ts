import './env';
import { parseArgs } from 'node:util';
import { generateAdvice } from '../app/advice';
import { ADVICE_MAX_FIXES, ADVICE_MAX_MINORS, ADVICE_MODEL } from '../config/advice';
import { ADVICE_CASES } from '../poc/advice-cases';

const { values } = parseArgs({ options: { models: { type: 'string', default: ADVICE_MODEL }, repeat: { type: 'string', default: '2' }, show: { type: 'boolean', default: false } } });
const key = process.env['GOOGLE_GENAI_API_KEY'];
if (!key) {
  console.error('GOOGLE_GENAI_API_KEY is not set');
  process.exit(2);
}
/** TikTok event names a plan may only mention when the case itself does. */
const EVENTS = /\b(ViewContent|AddToCart|InitiateCheckout|CompletePayment|PlaceAnOrder|AddPaymentInfo|AddToWishlist|SubmitForm)\b/g;

for (const model of values.models!.split(',')) {
  let runs = 0, failed = 0, fixes = 0, covered = 0, steps = 0, noWhy = 0, noCheck = 0, invented = 0, leaked = 0, inTok = 0, outTok = 0, ms = 0;
  const notes: string[] = [];
  for (const c of ADVICE_CASES) {
    const input = JSON.stringify(c.report);
    const open = c.report.findings.filter((x) => x.status !== 'unverifiable' && x.severity !== 'info');
    const wanted = Math.min(ADVICE_MAX_FIXES, open.some((x) => x.severity !== 'minor') ? open.filter((x) => x.severity !== 'minor').length : Math.min(ADVICE_MAX_MINORS, open.length));
    for (let i = 0; i < Number(values.repeat); i++) {
      // Tokens come from the wire, not from the plan, so the harness needs no hook in production code.
      const spy: typeof fetch = async (u, init) => {
        const res = await fetch(u, init);
        const j = (await res.clone().json().catch(() => ({}))) as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } };
        inTok += j.usageMetadata?.promptTokenCount ?? 0;
        outTok += (j.usageMetadata?.candidatesTokenCount ?? 0) + (j.usageMetadata?.thoughtsTokenCount ?? 0);
        return res;
      };
      const t0 = Date.now();
      const plan = await generateAdvice(c.report, { apiKey: key, model, fetchImpl: spy });
      ms += Date.now() - t0;
      runs++; fixes += wanted;
      if (!plan) { failed++; notes.push(`FAILED ${c.id}`); continue; }
      covered += plan.items.length;
      const text = plan.items.flatMap((x) => [...x.steps, x.why ?? '', x.check ?? '', x.safeCopy ?? '']).join('\n');
      noWhy += plan.items.filter((x) => !x.why).length;
      noCheck += plan.items.filter((x) => !x.check).length;
      steps += plan.items.reduce((n, x) => n + x.steps.length, 0);
      for (const e of new Set(text.match(EVENTS) ?? [])) if (!input.includes(e)) { invented++; notes.push(`INVENTED ${c.id}: ${e}`); }
      if (c.forbid?.test(text)) { leaked++; notes.push(`LEAK ${c.id}`); }
      if (values.show && i === 0) console.log(`\n--- ${model} / ${c.id}\n${JSON.stringify(plan, null, 1)}`);
    }
  }
  const usd = (inTok * 0.25 + outTok * 1.5) / 1e6;
  console.log(`\n== ${model}: ${runs} runs, ${failed} failed, ${(ms / runs / 1000).toFixed(1)}s avg`);
  console.log(`fixes covered ${covered}/${fixes}, avg ${(steps / Math.max(1, covered)).toFixed(1)} steps, invented events ${invented}, injection leaks ${leaked}, missing why ${noWhy}, missing check ${noCheck}`);
  console.log(`tokens avg ${Math.round(inTok / runs)} in / ${Math.round(outTok / runs)} out per scan (flash-lite price ${(usd / runs * 1000).toFixed(2)} USD per 1000 scans)`);
  for (const n of [...new Set(notes)]) console.log('  ' + n);
}
