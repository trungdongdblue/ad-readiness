/** Shared helpers for hook scripts. Hooks receive a JSON event on stdin. */
export async function readEvent() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Exit code 2 blocks a PreToolUse call and feeds stderr back to Claude. */
export function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
