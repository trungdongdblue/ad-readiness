/**
 * English keyword lists for risky claims on a landing page (docs/POLICY-RULES.md).
 * Every pattern traces to an example in a TikTok policy page. Phrases TikTok does not list (e.g. "clinically proven") are deliberately absent.
 */
export type Claim = 'medical' | 'exaggerated' | 'weight' | 'before_after' | 'discount';

const CONDITION = 'acne|hair loss|baldness|alopecia|cancer|hiv|covid\\S*|diabet\\w*|eczema|psoriasis|arthritis|hypertension|high blood pressure|disease';

const PATTERNS: Record<Claim, RegExp[]> = {
  medical: [
    new RegExp(`\\b(cure[sd]?|curing|heal(s|ed)?|treat(s|ed|ing)?|prevent(s|ed|ing)?|eliminat(es?|ed))\\b[^.]{0,40}\\b(${CONDITION})\\b`, 'gi'),
    /\b(remove[sd]?|erase[sd]?|eliminat(es?|ed)|get rid of|reverse[sd]?)\b[^.]{0,20}\bwrinkles?\b/gi,
    /\bpermanent(ly)?\s+(hair|fat|weight|wrinkle|scar|whiten\w*|enlarg\w+|cure|results?)/gi,
    /\bmiracle (cure|treatment)\b|\bsecret cure\b/gi,
  ],
  exaggerated: [
    /\bguarantee[sd]?\b[^.]{0,25}\b(results?|cure|weight loss|slim\w*|whiten\w*|growth|effective\w*|success)/gi,
    /\b100\s?% (guaranteed|effective|results?|success)\b/gi,
    /\b(instant(ly)?|overnight|right away)\s+(results?|slim\w*|whiten\w*|weight loss|fat loss|younger|visible)/gi,
    /\b(results?|lose|slim\w*|whiten\w*|regrow\w*|grow|earn)\b[^.]{0,25}\bin (just )?(\d+|one|two|three|seven) (seconds?|minutes?|hours?|days?)\b/gi,
    /\b(#1|number (one|1)|world'?s best)\s?(selling|rated|brand|product|choice|in\b)/gi,
    /\bmiracle\b/gi,
  ],
  weight: [
    /\b(lose|drop|shed|burn)\s+(up to )?\d+\s?(kgs?|lbs?|pounds|kilos?)\b/gi,
    /\b(without|no)\s+(any\s+)?(diet(ing)?|exercise|workout)s?\b/gi,
    /\bfat[- ]burn\w*|\bburns? (belly )?fat\b|\bmelts? (away )?fat\b|\bslimming (tea|pills?|belt|patch(es)?)\b|\bguaranteed weight loss\b/gi,
    /\blose weight (fast|quickly|easily|overnight)\b/gi,
  ],
  before_after: [/\bbefore\s*(and|&|\/|-)\s*after\b|\bbefore\s+vs\.?\s+after\b/gi],
  discount: [/\b(up to )?([7-9]\d|100)\s?%\s?(off|discount)\b/gi],
};

const snippet = (text: string, i: number, len: number): string => `"${text.slice(Math.max(0, i - 30), i + len + 30).replace(/\s+/g, ' ').trim()}"`;

/** Up to 3 distinct quoted snippets per claim type. The lists are English only: see `mostlyLatin`. */
export function claimHits(text: string): Record<Claim, string[]> {
  const out = { medical: [], exaggerated: [], weight: [], before_after: [], discount: [] } as Record<Claim, string[]>;
  for (const claim of Object.keys(PATTERNS) as Claim[]) {
    const seen = new Set<string>();
    for (const re of PATTERNS[claim]) {
      for (const m of text.matchAll(re)) {
        if (seen.size >= 3) break;
        if (seen.has(m[0].toLowerCase())) continue;
        seen.add(m[0].toLowerCase());
        out[claim].push(snippet(text, m.index ?? 0, m[0].length));
      }
    }
  }
  return out;
}

/** The keyword lists cannot read Arabic/Urdu/etc: a mostly non-Latin page must not get a "no risky phrases" verdict. */
export const mostlyLatin = (text: string): boolean => {
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  return letters > 0 && latin / letters >= 0.6;
};
