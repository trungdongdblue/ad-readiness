import { LINKS_PROMPT, CLAIMS_PROMPT, LLM_MAX_LINKS, LLM_MAX_OUTPUT_TOKENS, LLM_MAX_TEXT_CHARS, LLM_TIMEOUT_MS } from '../config/llm';
import type { LlmCapture, LlmPolicy, TrustCapture } from '../domain/types';
import { condenseLinks, condenseText, verifyClaims, verifyLinks } from '../parsers/llm';
import { unreadable, unresolvedPolicies } from '../parsers/trust';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface LlmOptions {
  apiKey: string;
  model: string;
  /** Defaults to the claims/links limits in config/llm.ts. */
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

const log = (msg: string): void => void process.stderr.write(`${msg}\n`);

/** One structured-output call. Returns undefined on any failure: the scan must never depend on the model. */
export async function askJson(o: LlmOptions, system: string, user: string, schema: object): Promise<{ data: unknown; usage: Usage } | undefined> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0, maxOutputTokens: o.maxOutputTokens ?? LLM_MAX_OUTPUT_TOKENS, responseMimeType: 'application/json', responseSchema: schema },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await (o.fetchImpl ?? fetch)(`${ENDPOINT}/${o.model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': o.apiKey },
        body,
        signal: AbortSignal.timeout(o.timeoutMs ?? LLM_TIMEOUT_MS),
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }
      if (!res.ok) {
        // Never log the response body: it can echo request text.
        log(`llm: HTTP ${res.status}`);
        return undefined;
      }
      const j = (await res.json()) as GeminiResponse;
      const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return undefined;
      const u = j.usageMetadata;
      // Thinking tokens are billed as output.
      return { data: JSON.parse(text), usage: { inputTokens: u?.promptTokenCount ?? 0, outputTokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0) } };
    } catch (err) {
      log(`llm: ${err instanceof Error ? err.name : 'error'}`);
    }
  }
  return undefined;
}

const CLAIMS_SCHEMA = {
  type: 'ARRAY',
  maxItems: 8,
  items: { type: 'OBJECT', properties: { claim: { type: 'STRING', enum: ['medical', 'exaggerated', 'weight', 'before_after'] }, quote: { type: 'STRING' } }, required: ['claim', 'quote'] },
};

const linksSchema = (wanted: readonly LlmPolicy[]) => ({
  type: 'ARRAY',
  maxItems: wanted.length,
  items: { type: 'OBJECT', properties: { policy: { type: 'STRING', enum: [...wanted] }, index: { type: 'INTEGER' } }, required: ['policy', 'index'] },
});

/**
 * Second opinion on a scanned page. Adds claim quotes the keyword lists missed (any language) and, only when the keyword
 * rules found no link for a policy, the link the model recognises. Everything returned has been checked against the page.
 */
export async function reviewPage(trust: TrustCapture | undefined, o: LlmOptions): Promise<LlmCapture | undefined> {
  if (!trust || unreadable(trust)) return undefined;
  const text = condenseText(trust, LLM_MAX_TEXT_CHARS);
  // With the site crawl the AI has already read the links (collectors/site-ai.ts); asking again would pay twice for the same answer.
  const wanted = trust.links.length && !trust.pages ? unresolvedPolicies(trust) : [];
  const links = wanted.length ? condenseLinks(trust.links, LLM_MAX_LINKS) : [];

  const [claims, linkAnswer] = await Promise.all([
    text ? askJson(o, CLAIMS_PROMPT, `<page>\n${text}\n</page>`, CLAIMS_SCHEMA) : undefined,
    links.length
      ? askJson(o, LINKS_PROMPT, `wanted: ${wanted.join(', ')}\n${links.map((l) => `${l.index}|${l.text}|${l.path}`).join('\n')}`, linksSchema(wanted))
      : undefined,
  ]);
  if (!claims && !linkAnswer) return undefined;

  const used = [claims, linkAnswer].filter((x): x is NonNullable<typeof x> => x !== undefined);
  return {
    model: o.model,
    claimsChecked: claims !== undefined,
    claims: claims ? verifyClaims(claims.data, trust.text) : [],
    policyLinks: linkAnswer ? verifyLinks(linkAnswer.data, trust.links, wanted) : [],
    usage: { calls: used.length, inputTokens: used.reduce((n, x) => n + x.usage.inputTokens, 0), outputTokens: used.reduce((n, x) => n + x.usage.outputTokens, 0) },
  };
}
