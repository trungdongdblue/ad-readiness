import { PICK_PROMPT, REVIEW_PROMPT, PAGE_TYPES, SITE_MAX_LINKS, SITE_MAX_OUTPUT_TOKENS, SITE_TIMEOUT_MS } from '../config/site';
import type { TrustCapture } from '../domain/types';
import { isShopContent, type Target } from '../parsers/crawl';
import { condenseLinks } from '../parsers/llm';
import { reviewInput, verifyPicks, verifyReview } from '../parsers/site-ai';
import { siteText } from '../parsers/site';
import { askJson, type LlmOptions } from './llm';

/** The two model calls that let the crawl read a store in any language. Both return undefined on any failure: the keyword rules still decide. */

const log = (msg: string): void => void process.stderr.write(`${msg}\n`);
const opts = (o: LlmOptions): LlmOptions => ({ ...o, maxOutputTokens: SITE_MAX_OUTPUT_TOKENS, timeoutMs: SITE_TIMEOUT_MS });

const PICK_SCHEMA = {
  type: 'ARRAY',
  maxItems: 20,
  items: { type: 'OBJECT', properties: { type: { type: 'STRING', enum: [...PAGE_TYPES] }, index: { type: 'INTEGER' } }, required: ['type', 'index'] },
};

const STR = { type: 'STRING', nullable: true };
const REVIEW_SCHEMA = {
  type: 'OBJECT',
  properties: {
    pages: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { id: { type: 'INTEGER' }, covers: { type: 'ARRAY', items: { type: 'STRING', enum: [...PAGE_TYPES] } }, sections: { type: 'ARRAY', items: { type: 'STRING', enum: [...PAGE_TYPES] } }, substantial: { type: 'BOOLEAN' } },
        required: ['id', 'covers', 'substantial'],
      },
    },
    identity: { type: 'OBJECT', properties: { brand: STR, company: STR, address: STR, phone: STR, email: STR } },
  },
  required: ['pages', 'identity'],
};

/** Links the keyword lists would not recognise (any language): which of the site's links lead to its policy, contact and About pages. */
export async function pickPageLinks(trust: TrustCapture, siteUrl: string, o: LlmOptions): Promise<Target[]> {
  // Product, collection and blog links never lead to a policy; blanking them keeps their index and spends no tokens.
  const links = condenseLinks(trust.links.map((l) => (isShopContent(l.href) ? { text: '', href: l.href } : l)), SITE_MAX_LINKS);
  if (!links.length) return [];
  const a = await askJson(opts(o), PICK_PROMPT, links.map((l) => `${l.index}|${l.text}|${l.path}`).join('\n'), PICK_SCHEMA);
  if (!a) return [];
  log(`site-ai pick ${o.model}: ${a.usage.inputTokens} in / ${a.usage.outputTokens} out tokens`);
  return verifyPicks(a.data, trust.links, siteUrl);
}

/** Reads what the crawl collected: what each page really is, and who runs the store. Mutates `trust` (page verdicts, identity). */
export async function reviewSite(trust: TrustCapture, o: LlmOptions): Promise<boolean> {
  const { text, ids } = reviewInput(trust);
  if (!ids.length && !trust.footer) return false;
  const a = await askJson(opts(o), REVIEW_PROMPT, text, REVIEW_SCHEMA);
  if (!a) return false;
  log(`site-ai review ${o.model}: ${a.usage.inputTokens} in / ${a.usage.outputTokens} out tokens`);
  const { verdicts, identity } = verifyReview(a.data, ids, siteText(trust));
  for (const [page, ai] of verdicts) page.ai = ai;
  trust.identity = identity;
  return true;
}
