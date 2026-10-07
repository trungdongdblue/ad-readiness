import './env';
import { parseArgs } from 'node:util';
import { formatReport } from '../app/format';
import { saveRaw, saveReport } from '../app/save';
import { scanTarget, type Check } from '../app/scan-service';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    market: { type: 'string' },
    headed: { type: 'boolean', default: false },
    'no-consent': { type: 'boolean', default: false },
    'no-llm': { type: 'boolean', default: false },
    recon: { type: 'boolean', default: false },
    only: { type: 'string' },
    json: { type: 'boolean', default: false },
    out: { type: 'string', default: 'poc/results/adhoc' },
    proxy: { type: 'string' },
    'allow-live-events': { type: 'boolean', default: false },
  },
});

const url = positionals[0];
if (!url) {
  console.error('usage: npm run scan -- <url> [--only tracking|mobile|trust|policy] [--market PK] [--no-consent] [--no-llm] [--recon] [--headed] [--json] [--proxy URL]');
  process.exit(2);
}
if (values.only && !['tracking', 'mobile', 'trust', 'policy'].includes(values.only)) {
  console.error('--only must be "tracking", "mobile", "trust" or "policy"');
  process.exit(2);
}
if (values['allow-live-events']) {
  console.error('WARNING: --allow-live-events lets scan events reach TikTok and pollute real pixel data.');
}

const { report, capture } = await scanTarget({
  url,
  market: values.market,
  headless: !values.headed,
  acceptConsent: !values['no-consent'],
  llm: !values['no-llm'],
  checks: values.only ? [values.only as Check] : undefined,
  allowLiveEvents: values['allow-live-events'],
  proxy: values.proxy,
});

const file = await saveReport(values.out, report);
console.log(values.json ? JSON.stringify(report, null, 2) : formatReport(report));
console.log(`report: ${file}`);
if (values.recon) console.log(`raw capture (do not paste into AI context): ${await saveRaw(values.out, url, capture)}`);
