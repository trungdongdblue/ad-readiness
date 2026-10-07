# ad-readiness (Ecomdy) - Store Ad-Readiness Grader, Tracking module

Scans a store URL and reports TikTok Pixel / event readiness. Status: PoC v0.1. Plan: docs/ROADMAP.md

## Commands
- `npm run check`  typecheck + tests (run once, at the end of a task)
- `npm run scan -- <url> [--market PK] [--recon] [--no-consent]`
- `npm run poc -- run|compare`  batch scan + accuracy vs ground truth
- `npm run browsers`  one-time Chromium install

## Architecture (details: docs/ARCHITECTURE.md)
Dependency direction: domain <- parsers <- rules/engine <- app <- cli. Browser I/O (collectors, scenarios) is used only by app.
- domain, parsers, rules, engine are PURE: no Playwright, no fs, no network.
- New check: file in src/rules/tracking/ + register in index.ts + test in tests/rules.test.ts.
- New funnel step: file in src/scenarios/ + register in index.ts.

## Hard rules
1. Pixel events must never reach TikTok: scans are capture-and-block. `--allow-live-events` requires ADR_ALLOW_LIVE=1 and owner approval.
2. Never place orders, submit real data, or enter credentials/PII on scanned sites.
3. Every user URL goes through assertSafeUrl (SSRF). `allowPrivate` is for tests only.
4. No false accusations: `missing` only if the funnel phase was reached AND decoding is trusted; otherwise `unverifiable`.
5. TikTok facts need source + date in docs/TRACKING-RULES.md. Never invent endpoints, event names or payload fields; confirm with `--recon`.
6. No secrets in the repo. No console.log outside src/cli and src/app/format.ts.

## Style
TypeScript strict, ES modules, files < 200 lines, named exports, pure functions, behaviour covered in tests/.

## Token discipline
- Use CodeGraph (codegraph_explore / impact) before reading files; read only the lines you need.
- Never read poc/results/** (hooks block it). Use `npm run poc -- compare` summaries.
- docs/* are not preloaded; open one only when the task needs it.
- Keep replies and diffs minimal.
