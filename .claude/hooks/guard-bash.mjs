#!/usr/bin/env node
// PreToolUse (Bash): block destructive commands and anything that could pollute real pixel data.
import { block, readEvent } from './lib.mjs';

const command = String((await readEvent()).tool_input?.command ?? '');

const RULES = [
  [/\brm\s+-[a-z]*(rf|fr)\b/i, 'rm -rf is not allowed. Delete specific files instead.'],
  [/git\s+push\b.*(--force|\s-f\b)/, 'Force push is not allowed.'],
  [/git\s+reset\s+--hard/, 'git reset --hard is not allowed.'],
  [/\b(cat|head|tail|less|grep|rg|jq|type)\b[^|;&]*poc[\\/]results/, 'Do not read poc/results directly. Use `npm run poc -- compare`.'],
];
for (const [re, msg] of RULES) if (re.test(command)) block(msg);

if (/--allow-live-events/.test(command) && process.env.ADR_ALLOW_LIVE !== '1') {
  block('--allow-live-events lets scan events reach TikTok and pollute the store\'s real pixel data. Needs ADR_ALLOW_LIVE=1 and owner approval.');
}
