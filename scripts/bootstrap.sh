#!/usr/bin/env bash
# One-time setup on a developer machine.
set -euo pipefail
cd "$(dirname "$0")/.."

npm ci
npm run browsers

# CodeGraph = pre-indexed code graph so the agent reads fewer files (fewer tokens).
# `codegraph init` builds .codegraph/ for this project. The first-time installer wires the MCP server
# into your agents (machine-level, run once):  npx @colbymchenry/codegraph
if command -v codegraph >/dev/null 2>&1; then
  codegraph init
else
  echo "CodeGraph not found. Run once: npx @colbymchenry/codegraph   then: codegraph init"
fi

npm run check
