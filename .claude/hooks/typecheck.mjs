#!/usr/bin/env node
// PostToolUse (Edit|Write): typecheck after TypeScript edits. Silent on success, <= 15 lines on failure.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readEvent } from './lib.mjs';

const file = String((await readEvent()).tool_input?.file_path ?? '');
if (!/\.tsx?$/.test(file)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const win = process.platform === 'win32';
const bin = join(root, 'node_modules', '.bin', win ? 'tsc.cmd' : 'tsc');
const res = spawnSync(bin, ['--noEmit'], { cwd: root, encoding: 'utf8', shell: win });
if (res.status === 0 || res.error) process.exit(0); // tsc missing => do not block work

process.stderr.write(`${(res.stdout || res.stderr).split('\n').slice(0, 15).join('\n')}\n`);
process.exit(2);
