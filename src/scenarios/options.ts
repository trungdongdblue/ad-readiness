import type { Page } from 'playwright';
import { planOptions } from '../collectors/option-ai';
import type { LlmOptions } from '../collectors/llm';
import { choose, pageErrors, snapshotControls } from '../collectors/options';
import { describeBlock, labelOf, planSelections, type Control } from '../parsers/options';

export interface Recovery {
  ok: boolean;
  /** What we chose, so the report can say under which conditions Add to cart was checked. */
  tried: string[];
  /** Why it did not work, when it did not. */
  why?: string;
}

const sameSite = (page: Page, origin: string): boolean => new URL(page.url()).origin === origin;

/**
 * The first click on Add to cart did nothing (usually a size must be chosen). Try to make it work, then click again with `retry`.
 * Layer 1 chooses the first available option of every group with nothing chosen. Layer 2 asks the model, when a key is set.
 * Nothing here decides a verdict: `retry` returns true only when a cart-add response was seen.
 * Hard rule 2: only option controls are clicked, nothing is typed, and a page that leaves the store is abandoned.
 */
export async function recover(page: Page, retry: () => Promise<boolean>, added: () => boolean, ai?: LlmOptions): Promise<Recovery> {
  const origin = new URL(page.url()).origin;
  const tried: string[] = [];
  const errors = await pageErrors(page);
  let controls = await snapshotControls(page);

  /** Some stores add to cart the moment a size is tapped (outfitters.com.pk on mobile), so watch for the response after each choice. */
  const afterChoice = async (): Promise<boolean> => {
    for (let i = 0; i < 10 && !added(); i++) await page.waitForTimeout(250);
    return added();
  };
  const done = new Set<string>();
  const failed = new Set<string>();
  const apply = async (picks: readonly Control[]): Promise<boolean> => {
    for (const c of picks) {
      if (!sameSite(page, origin)) return false;
      if (await choose(page, c)) {
        tried.push(labelOf(c));
        if (await afterChoice()) return true;
      }
    }
    return false;
  };

  // Layer 1: one group at a time, looking again after each choice because the page may re-render.
  // An option that cannot be clicked (sold out in a way we could not see) is skipped and the next one in its group is tried.
  for (let attempt = 0; attempt < 6; attempt++) {
    const next = planSelections(controls.filter((c) => !done.has(c.group) && !failed.has(`${c.group}|${c.label}`)))[0];
    if (!next) break;
    const before = tried.length;
    if (await apply([next])) return { ok: true, tried };
    if (tried.length > before) done.add(next.group);
    else failed.add(`${next.group}|${next.label}`);
    controls = await snapshotControls(page);
  }
  if (tried.length && (await retry())) return { ok: true, tried };

  // Layer 2: the model reads the controls and says which to choose.
  if (ai && sameSite(page, origin)) {
    const fresh = await snapshotControls(page);
    const before = tried.length;
    if (await apply(await planOptions(fresh, errors, ai))) return { ok: true, tried };
    if (tried.length > before && (await retry())) return { ok: true, tried };
  }

  return { ok: false, tried, why: describeBlock(await snapshotControls(page), tried, errors) };
}
