import { MAX_PICKS, verifyPlan, type Control } from '../parsers/options';
import { OPTION_MAX_OUTPUT_TOKENS, OPTION_PROMPT, OPTION_TIMEOUT_MS } from '../config/options';
import { askJson, type LlmOptions } from './llm';

const SCHEMA = { type: 'ARRAY', maxItems: MAX_PICKS, items: { type: 'INTEGER' } };
const clean = (s: string): string => s.replace(/[<>|\n]/g, ' ').slice(0, 60);

/**
 * Layer 2: when the generic rules could not get Add to cart to work, the model says which options to choose.
 * It only returns indexes of controls we listed, and `verifyPlan` drops anything unsafe. The verdict never comes from the model:
 * it still comes from the cart-add response. Returns [] on any failure.
 */
export async function planOptions(controls: readonly Control[], errors: readonly string[], o: LlmOptions): Promise<Control[]> {
  if (!controls.length) return [];
  const lines = controls.map((c) => `${c.i}|${c.kind}|${clean(c.group)}|${clean(c.label)}|${c.disabled ? 'unavailable' : c.selected ? 'chosen' : 'free'}`);
  const user = `<errors>\n${errors.map(clean).join('\n')}\n</errors>\n<controls>\n${lines.join('\n')}\n</controls>`;
  const a = await askJson({ ...o, maxOutputTokens: OPTION_MAX_OUTPUT_TOKENS, timeoutMs: OPTION_TIMEOUT_MS }, OPTION_PROMPT, user, SCHEMA);
  if (!a) return [];
  process.stderr.write(`option-ai ${o.model}: ${a.usage.inputTokens} in / ${a.usage.outputTokens} out tokens\n`);
  return verifyPlan(a.data, controls);
}
