import type { AdvicePlan } from '@domain/api';
import { EFFORT_COPY, SEVERITY_COPY } from '../copy';

/** The plan as plain Markdown, ready to paste to a developer or a teammate. */
export function planMarkdown(url: string, plan: AdvicePlan): string {
  const lift = plan.now !== null && plan.after !== null && plan.after > plan.now ? `Score ${plan.now} -> ${plan.after} after these fixes.\n\n` : '';
  const items = plan.items.map((it, i) => {
    const gain = it.gain > 0 ? `, +${it.gain} pts` : '';
    const steps = it.steps.map((s, n) => `${n + 1}. ${s}`).join('\n');
    const why = it.why ? `${it.why}\n\n` : '';
    const check = it.check ? `\n\nHow to check it worked: ${it.check}` : '';
    const copy = it.safeCopy ? `\n\nSuggested wording: ${it.safeCopy}` : '';
    return `## ${i + 1}. ${it.title} (${SEVERITY_COPY[it.severity].label}, ${EFFORT_COPY[it.effort]}${gain})\n\n${why}${steps}${copy}${check}`;
  });
  return `# TikTok ads fix plan for ${url}\n\n${lift}${items.join('\n\n')}\n`;
}
