import './env';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { formatReport } from '../app/format';
import { saveReport } from '../app/save';
import { scanTarget } from '../app/scan-service';
import type { Report } from '../domain/types';
import { compare, metrics, normalizeUrl, toTruthRow, verdict, type Criteria } from '../poc/compare';
import { parseCsv } from '../poc/csv';
import { compareTrust, TRUST_FIELDS } from '../poc/trust-compare';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    stores: { type: 'string', default: 'poc/stores.csv' },
    truth: { type: 'string', default: 'poc/ground-truth.csv' },
    'trust-truth': { type: 'string', default: 'poc/trust-truth.csv' },
    criteria: { type: 'string', default: 'poc/criteria.json' },
    out: { type: 'string', default: `poc/results/${new Date().toISOString().slice(0, 10)}` },
    concurrency: { type: 'string', default: '2' },
    'no-consent': { type: 'boolean', default: false },
    // The PoC measures the keyword rules; the AI review is opt-in so runs stay comparable with earlier results.
    llm: { type: 'boolean', default: false },
    proxy: { type: 'string' },
  },
});

async function runAll(): Promise<void> {
  const rows = parseCsv(await readFile(values.stores, 'utf8')).filter((r) => r.url);
  const limit = Math.max(1, Number(values.concurrency));
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const row = rows[next++];
      if (!row) return;
      try {
        const { report } = await scanTarget({ url: row.url!, market: row.market || undefined, acceptConsent: !values['no-consent'], proxy: values.proxy, checks: ['tracking', 'trust'], llm: values.llm });
        await saveReport(values.out, report);
        console.log(formatReport(report).split('\n').slice(0, 3).join('\n'));
      } catch (err) {
        console.error(`FAILED ${row.url}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  console.log(`done -> ${values.out}\nnext: npm run poc -- compare --out ${values.out}`);
}

async function runCompare(): Promise<void> {
  const truth = parseCsv(await readFile(values.truth, 'utf8')).map(toTruthRow).filter((t) => t.url);
  const reports = new Map<string, Report>();
  for (const f of (await readdir(values.out)).filter((n) => n.endsWith('.json'))) {
    const r = JSON.parse(await readFile(join(values.out, f), 'utf8')) as Report;
    reports.set(normalizeUrl(r.target), r);
  }
  const res = compare(truth, reports);
  console.log(`stores compared: ${res.stores}/${truth.length}`);
  const pct = (n: number | null): string => (n === null ? ' n/a' : `${Math.round(n * 100)}%`.padStart(4));
  console.log('field              precision recall coverage  tp fp fn tn undecided');
  for (const [name, s] of Object.entries(res.fields)) {
    const m = metrics(s);
    console.log(`${name.padEnd(18)} ${pct(m.precision)}      ${pct(m.recall)}   ${pct(m.coverage)}     ${s.tp}  ${s.fp}  ${s.fn}  ${s.tn}  ${s.undecided}`);
  }
  console.log(`platform accuracy: ${pct(res.platformAccuracy)}`);
  const criteria = JSON.parse(await readFile(values.criteria, 'utf8')) as Criteria;
  console.log('\nverdict vs poc/criteria.json:');
  for (const v of verdict(res, criteria)) console.log(`${v.pass ? 'PASS' : 'FAIL'}  ${v.field}: ${v.detail}`);
}

async function runCompareTrust(): Promise<void> {
  const rows = parseCsv(await readFile(values['trust-truth'], 'utf8')).filter((t) => t.url);
  const reports = new Map<string, Report>();
  for (const f of (await readdir(values.out)).filter((n) => n.endsWith('.json'))) {
    const r = JSON.parse(await readFile(join(values.out, f), 'utf8')) as Report;
    reports.set(normalizeUrl(r.target), r);
  }
  const { result, mismatches } = compareTrust(rows, reports);
  console.log(`stores compared: ${result.stores}/${rows.length}`);
  const pct = (n: number | null): string => (n === null ? ' n/a' : `${Math.round(n * 100)}%`.padStart(4));
  console.log('field          precision recall coverage  tp fp fn tn undecided   (fn = false accusation)');
  for (const [name, s] of Object.entries(result.fields)) {
    const m = metrics(s);
    console.log(`${name.padEnd(14)} ${pct(m.precision)}      ${pct(m.recall)}   ${pct(m.coverage)}     ${s.tp}  ${s.fp}  ${s.fn}  ${s.tn}  ${s.undecided}`);
  }
  for (const m of mismatches) console.log(`MISMATCH ${m.field.padEnd(13)} truth=${m.truth} got=${m.got}  ${m.url}`);
  const all = JSON.parse(await readFile(values.criteria, 'utf8')) as Criteria;
  const criteria = Object.fromEntries(Object.entries(all).filter(([k]) => k in TRUST_FIELDS));
  console.log('\nverdict vs poc/criteria.json:');
  for (const v of verdict(result, criteria)) console.log(`${v.pass ? 'PASS' : 'FAIL'}  ${v.field}: ${v.detail}`);
}

const cmd = positionals[0];
if (cmd === 'run') await runAll();
else if (cmd === 'compare') await runCompare();
else if (cmd === 'compare-trust') await runCompareTrust();
else {
  console.error('usage: npm run poc -- run|compare|compare-trust [--stores f] [--truth f] [--out dir] [--concurrency 2] [--no-consent]');
  process.exit(2);
}
