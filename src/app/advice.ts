import { askJson, type LlmOptions } from '../collectors/llm';
import { ADVICE_MAX_FIXES, ADVICE_MAX_MINORS, ADVICE_MAX_OUTPUT_TOKENS, ADVICE_MAX_STEPS, ADVICE_MODEL, ADVICE_PROMPT, ADVICE_TIMEOUT_MS } from '../config/advice';
import type { AdviceItem, AdvicePlan } from '../domain/api';
import type { Report } from '../domain/types';
import { rankFixes, scoreIfFixed } from '../engine/advice';
import { scoreFindings } from '../engine/score';
import { adviceText, verifyAdvice } from '../parsers/advice';

export type Advise = (report: Report) => Promise<AdvicePlan | undefined>;

const schema = (n: number) => ({
  type: 'ARRAY',
  maxItems: n,
  items: {
    type: 'OBJECT',
    properties: {
      n: { type: 'INTEGER' },
      steps: { type: 'ARRAY', maxItems: ADVICE_MAX_STEPS, items: { type: 'STRING' } },
      headline: { type: 'STRING' },
      why: { type: 'STRING' },
      check: { type: 'STRING' },
      effort: { type: 'STRING', enum: ['minutes', 'hour', 'developer'] },
      safe_copy: { type: 'STRING' },
    },
    required: ['n', 'headline', 'why', 'steps', 'check', 'effort'],
  },
});

/**
 * One model call per scan: the fixes that matter most (blockers and majors), explained in plain words for a non-technical owner.
 * Ranking, score gain and the projected score come from the real scoring engine, never from the model.
 * Returns undefined on any failure: the scan result and its fixed "How to fix" texts never depend on it.
 */
export async function generateAdvice(report: Report, o: Pick<LlmOptions, 'apiKey' | 'fetchImpl'> & { model?: string }): Promise<AdvicePlan | undefined> {
  const all = rankFixes(report.findings, 50);
  const big = all.filter((r) => r.finding.severity !== 'minor');
  const ranked = (big.length ? big : all.slice(0, ADVICE_MAX_MINORS)).slice(0, ADVICE_MAX_FIXES);
  if (!ranked.length) return undefined;
  const model = o.model ?? ADVICE_MODEL;
  const fixes = ranked.map((r) => r.finding);
  const answer = await askJson({ ...o, model, maxOutputTokens: ADVICE_MAX_OUTPUT_TOKENS, timeoutMs: ADVICE_TIMEOUT_MS }, ADVICE_PROMPT, adviceText(fixes, report), schema(fixes.length));
  if (!answer) return undefined;
  process.stderr.write(`advice ${model}: ${answer.usage.inputTokens} in / ${answer.usage.outputTokens} out tokens\n`);
  const advised = verifyAdvice(answer.data, fixes);
  const items: AdviceItem[] = ranked.flatMap((r, i) => {
    const a = advised.get(i + 1);
    return a ? [{ title: a.headline ?? r.finding.title, severity: r.finding.severity, gain: r.gain, effort: a.effort, why: a.why, steps: a.steps, check: a.check, safeCopy: a.safeCopy }] : [];
  });
  if (!items.length) return undefined;
  const covered = ranked.filter((_, i) => advised.has(i + 1)).map((r) => r.finding);
  return { model, items, now: scoreFindings(report.findings).total, after: scoreIfFixed(report.findings, covered) };
}

/** On when a Gemini key is set. The key is read once, here, and never leaves this process. */
export function adviseFromEnv(key = process.env['GOOGLE_GENAI_API_KEY']): Advise | undefined {
  return key ? (report) => generateAdvice(report, { apiKey: key }) : undefined;
}
