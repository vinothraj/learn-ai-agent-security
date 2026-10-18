import { createHash } from 'node:crypto';

/**
 * Feed text is UNTRUSTED. Everything here produces plain text only; nothing is ever rendered as
 * HTML or passed to a tool-using model. Instructions inside articles are just data.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+[0-9]*);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k.startsWith('#x')) return safeChar(parseInt(k.slice(2), 16));
    if (k.startsWith('#')) return safeChar(parseInt(k.slice(1), 10));
    return ENTITIES[k] ?? m;
  });
}

function safeChar(code: number) {
  return Number.isFinite(code) && code > 31 && code < 0x10ffff ? String.fromCodePoint(code) : ' ';
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|iframe|object|noscript)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First sentences up to a hard limit: a short excerpt with attribution, never a republished article. */
export function excerpt(text: string, maxChars = 280): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  let out = '';
  for (const s of sentences) {
    if ((out + s).length > maxChars) break;
    out += s;
    if (out.split(/[.!?]/).length > 2) break;
  }
  out = out.trim();
  if (!out || out.length > maxChars) {
    // First sentence too long: cut at a word boundary and mark the cut.
    const cut = text.slice(0, maxChars - 1);
    const space = cut.lastIndexOf(' ');
    out = `${(space > maxChars / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
  }
  return out;
}

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|igshid|_hsenc|_hsmi)$/i;

/** Normalises URLs so the same article from different links dedupes: https, lowercase host, no tracking params, no fragment. */
export function canonicalUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  u.protocol = 'https:';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.hash = '';
  u.username = '';
  u.password = '';
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

export function hostAllowed(url: string, allowed: readonly string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  return allowed.some((d) => {
    const dom = d.toLowerCase().replace(/^www\./, '');
    return host === dom || host.endsWith(`.${dom}`);
  });
}

/**
 * 64-bit SimHash over character 4-grams. Short headlines need many small features: with whole
 * words, adding one word to a 12-word title flips too many bits to recognise a near-duplicate.
 */
export function simhash(text: string): bigint {
  const norm = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const shingles = norm.length < 4 ? [norm] : [...new Set(Array.from({ length: norm.length - 3 }, (_, i) => norm.slice(i, i + 4)))];
  const v = new Array<number>(64).fill(0);
  for (const sh of shingles) {
    const h = BigInt(`0x${createHash('sha256').update(sh).digest('hex').slice(0, 16)}`);
    for (let i = 0; i < 64; i++) v[i]! += (h >> BigInt(i)) & 1n ? 1 : -1;
  }
  let out = 0n;
  for (let i = 0; i < 64; i++) if (v[i]! > 0) out |= 1n << BigInt(i);
  return out;
}

export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/**
 * Measured on headline pairs: rewordings of the same story are 6-10 bits apart, different stories
 * 16+ (even same template, different CVE). Ingestion additionally requires identical CVE/GHSA ids.
 */
export const NEAR_DUPLICATE_BITS = 12;

export function extractVulnIds(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(/\bCVE-\d{4}-\d{4,7}\b/gi)) ids.add(m[0].toUpperCase());
  for (const m of text.matchAll(/\bGHSA(-[23456789cfghjmpqrvwx]{4}){3}\b/gi)) ids.add(m[0].toLowerCase().replace(/^ghsa/, 'GHSA'));
  return [...ids].slice(0, 20);
}

// ---------------------------------------------------------------------------
// Rule-based relevance and classification (deterministic, explainable, no AI)
// ---------------------------------------------------------------------------

/**
 * Whole-word matching only: substring matching let "rag" match "storage" and pulled unrelated
 * industrial-control advisories into the AI feed during live testing.
 */
const AI_TERMS =
  /\b(ai|a\.i\.|genai|generative ai|artificial intelligence|llms?|large language models?|language models?|machine learning|ml models?|neural networks?|chatbots?|chatgpt|gpt-\d\w*|copilots?|gemini|claude|agentic|ai agents?|prompt injections?|jailbreak(s|ing)?|model context protocol|mcp|retrieval[- ]augmented|rag|embeddings?|deepfakes?|superintelligence|super intelligence)\b/i;

export function isAiRelevant(text: string): boolean {
  return AI_TERMS.test(text);
}

export const CATEGORIES = ['prompt-injection', 'data-leakage', 'agents-mcp', 'supply-chain', 'model-attacks', 'vulnerability', 'guidance', 'research'] as const;
export type NewsCategory = (typeof CATEGORIES)[number];

const RULES: [NewsCategory, RegExp][] = [
  ['prompt-injection', /prompt injection|jailbreak|indirect injection|guardrail bypass/i],
  ['agents-mcp', /\bmcp\b|model context protocol|ai agent|agentic|tool call|autonomous agent|copilot agent/i],
  ['data-leakage', /data (leak|exposure|exfiltrat)|sensitive (data|information)|privacy|training data extraction|pii/i],
  ['supply-chain', /supply chain|malicious (model|package)|pickle|hugging ?face|dependency|backdoor/i],
  ['model-attacks', /poison|adversarial|model (theft|extraction|inversion)|evasion attack|membership inference/i],
  ['vulnerability', /\bcve-\d{4}|vulnerabilit|exploit|patch|advisory|remote code execution|rce\b/i],
  ['guidance', /guidance|framework|best practice|standard|profile|playbook|joint (advisory|guidance)|principles/i],
];

export function classify(text: string): NewsCategory {
  for (const [cat, re] of RULES) if (re.test(text)) return cat;
  return 'research';
}

export function isHighImpact(text: string, vulnIds: readonly string[]): boolean {
  return vulnIds.length > 0 || /actively exploited|known exploited|zero-day|0-day|critical vulnerabilit|remote code execution|emergency directive/i.test(text);
}

export function fingerprintHex(h: bigint): string {
  return h.toString(16).padStart(16, '0');
}
