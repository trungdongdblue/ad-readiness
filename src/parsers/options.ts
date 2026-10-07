/** A choosable option on a product page (a size, colour or variant), as read from the page by `collectors/options.ts`. */
export interface Control {
  i: number;
  kind: 'radio' | 'select' | 'button';
  /** Controls that answer the same question (all the sizes) share a group. */
  group: string;
  label: string;
  /** Sold out or disabled. */
  disabled: boolean;
  /** Already chosen. */
  selected: boolean;
}

/** Never click these: they buy, leave the page, or open something that is not an option. */
const NOT_AN_OPTION = /add to|buy|check ?out|pay\b|payment|subscribe|newsletter|sign ?in|log ?in|register|account|submit|send|delete|remove|wishlist|compare|share|notify|guide|chart|help|details|info|اشتر|دفع|تسجيل/i;
export const MAX_PICKS = 3;

export const isSafe = (c: Control): boolean => !c.disabled && !NOT_AN_OPTION.test(c.label);

const byGroup = (controls: readonly Control[]): Control[][] => {
  const groups = new Map<string, Control[]>();
  for (const c of controls) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  return [...groups.values()];
};

/** Layer 1: in every group with nothing chosen, the first option that is available. Groups that already have a choice are left alone. */
export const planSelections = (controls: readonly Control[]): Control[] =>
  byGroup(controls)
    // A lone button is not a choice (it may be Menu or Search); radios and menus can be a single required option.
    .filter((g) => g.length > 1 || g[0]?.kind !== 'button')
    .flatMap((g) => (g.some((c) => c.selected) ? [] : g.filter(isSafe).slice(0, 1)))
    .slice(0, MAX_PICKS);

/** Layer 2: what the model asked for, kept only when every index is a real, available control. Repeats and extras are dropped, order is kept. */
export function verifyPlan(raw: unknown, controls: readonly Control[]): Control[] {
  if (!Array.isArray(raw)) return [];
  const out: Control[] = [];
  for (const i of raw) {
    const c = typeof i === 'number' ? controls.find((x) => x.i === i) : undefined;
    if (c && isSafe(c) && !out.includes(c)) out.push(c);
  }
  return out.slice(0, MAX_PICKS);
}

/** Layer 3: why Add to cart could not be confirmed, in words a shop owner can act on. Never says the event is missing. */
export function describeBlock(controls: readonly Control[], tried: readonly string[], errors: readonly string[]): string {
  if (tried.length) return `chose ${tried.join(', ')} but still saw no cart-add response (the store may add to cart in another way)`;
  const soldOut = byGroup(controls).find((g) => g.every((c) => c.disabled));
  if (soldOut) return `every ${soldOut[0]?.kind === 'select' ? 'choice' : 'option'} in "${soldOut[0]?.group}" is sold out or disabled, so nothing could be added`;
  if (errors.length) return `the store asked for something we could not provide: "${errors[0]}"`;
  return 'clicked, but no cart-add response seen (an option such as size may be required, or the store adds to cart another way)';
}

export const labelOf = (c: Control): string => `"${c.label}"`;
