#!/usr/bin/env node
// PreToolUse (Read|Grep|Glob): keep heavy or sensitive paths out of the context window.
import { block, readEvent } from './lib.mjs';

const BLOCKED = /(^|[\\/])(node_modules|\.codegraph|graph)([\\/]|$)|poc[\\/]results|\.har$|(^|[\\/])\.env/;

const input = (await readEvent()).tool_input ?? {};
const candidates = [input.file_path, input.path, input.glob, input.pattern].filter((v) => typeof v === 'string');
const hit = candidates.find((p) => BLOCKED.test(p));
if (hit) {
  block(`Blocked path "${hit}": large or sensitive. Use CodeGraph for code, or \`npm run poc -- compare\` for PoC results.`);
}
