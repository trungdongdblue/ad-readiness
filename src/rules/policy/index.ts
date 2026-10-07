import type { Finding, Observation, Rule, Severity } from '../../domain/types';
import { mergeEvidence } from '../../parsers/llm';
import { claimHits, mostlyLatin, type Claim } from '../../parsers/policy';
import { unreadable } from '../../parsers/trust';
import { marketNote } from './markets';

const SRC = 'docs/POLICY-RULES.md';

const CLAIMS: { claim: Claim; id: string; title: string; severity: Severity; fix: string }[] = [
  { claim: 'medical', id: 'policy.medical_claim', title: 'Medical claim wording on the page', severity: 'major',
    fix: 'TikTok bans medical claims without an approved medical licence, incl. curing/treating a condition, removing wrinkles, "permanent" body changes (Healthcare and Pharmaceuticals, Sep 2026). Reword to what the product does, or confirm you hold the licence.' },
  { claim: 'exaggerated', id: 'policy.exaggerated_result', title: 'Exaggerated or guaranteed result wording', severity: 'minor',
    fix: 'Ad content and landing pages must not promise or exaggerate results (Misleading and false content, Apr 2026). Drop guarantees, "instant", fixed-time results and "#1" unless you can show proof.' },
  { claim: 'weight', id: 'policy.weight_claim', title: 'Weight loss claim wording', severity: 'major',
    fix: 'Weight Management (Sep 2026) bans unrealistic loss, "without diet or exercise" and "easy or guaranteed", on the landing page too. Some weight products are allowed in some markets with approval and licence (update May 2026).' },
  { claim: 'before_after', id: 'policy.before_after', title: 'Before/after comparison wording', severity: 'minor',
    fix: 'Before/after product-effect comparisons are restricted (Misleading and false content, Apr 2026). Only the text is read here; check the images by hand.' },
  { claim: 'discount', id: 'policy.extreme_discount', title: 'Extreme discount wording (70%+ off)', severity: 'info',
    fix: 'TikTok bans unreasonably low prices vs the market average only when used to scam (Deceptive practices, Aug 2025). A big discount alone is not a violation: check the price is real and the compare-at price is honest.' },
];

/** Page text we can trust for a verdict. `latin`: the English keyword lists can read it. The AI review (when it ran) reads any language. */
const readable = (obs: Observation): { text: string; latin: boolean; ai: boolean } | { why: string } => {
  const t = obs.trust;
  if (!t || unreadable(t)) return { why: 'page content missing, too short or blocked (bot wall, country picker?)' };
  const latin = mostlyLatin(t.text);
  const ai = obs.llm?.claimsChecked === true;
  if (!latin && !ai) return { why: 'page is mostly non-English and the keyword list is English only' };
  return { text: t.text, latin, ai };
};

/** Keyword hits (English pages) plus claims the AI review found and verified in the page. The AI only adds; it never removes a keyword hit. */
const evidenceFor = (obs: Observation, r: { text: string; latin: boolean; ai: boolean }, claim: Claim): string[] => {
  const regex = r.latin ? claimHits(r.text)[claim] : [];
  const ai = r.ai && claim !== 'discount' ? (obs.llm?.claims ?? []).filter((c) => c.claim === claim).map((c) => c.quote) : [];
  return mergeEvidence(regex, ai);
};

/** Evidence only the AI produced is a softer signal than a curated phrase tied to a TikTok example, so it costs at most `minor`. */
const severityFor = (c: (typeof CLAIMS)[number], evidence: string[]): Severity =>
  c.severity === 'major' && evidence.every((e) => e.startsWith('AI: ')) ? 'minor' : c.severity;

const claimRule = (c: (typeof CLAIMS)[number]): Rule => (obs, ctx) => {
  const r = readable(obs);
  if (!('text' in r)) return [];
  const evidence = evidenceFor(obs, r, c.claim);
  // The ban is the same in every market; what differs is what the owner may do about it (docs/MARKET-RULES.md), so only the advice changes.
  const note = marketNote(c.claim, ctx.market);
  return evidence.length ? [{ id: c.id, title: c.title, status: 'detected', severity: severityFor(c, evidence), evidence, fix: note ? `${c.fix} ${note}` : c.fix }] : [];
};

/** One summary line so the report shows the check ran. "No hits" is not a clearance: lists are short and the AI can miss things. */
const summary: Rule = (obs) => {
  const r = readable(obs);
  const id = 'policy.claims';
  if (!('text' in r)) return [{ id, title: 'Claim wording could not be checked', status: 'unverifiable', severity: 'info', evidence: [r.why] }];
  const hit = CLAIMS.some((c) => evidenceFor(obs, r, c.claim).length > 0);
  const how = r.ai ? 'keyword list and AI review of the page text' : 'keyword list, English only';
  const f: Finding = hit
    ? { id, title: 'Risky claim wording found (signals, not a TikTok verdict)', status: 'detected', severity: 'info', evidence: [`see policy.* findings; ${how} (${SRC})`] }
    : { id, title: 'No risky claim wording found', status: 'detected', severity: 'info', evidence: [`not a compliance clearance: ${how}, landing + product page text only (${SRC})`] };
  return [f];
};

/** Add new policy rules here only. Order = report order. */
export const POLICY_RULES: readonly Rule[] = [summary, ...CLAIMS.map(claimRule)];
