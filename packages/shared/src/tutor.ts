import { z } from 'zod';
import { stem, tokens } from './interview';
import type { Lesson } from './schema';

/**
 * "Ask the tutor" building blocks shared by the app (offline lesson search) and the API
 * (retrieval for grounded AI answers). Retrieval is lexical BM25 over our own approved lessons,
 * so it needs no embeddings, no network and no paid service.
 */

const STOP = new Set(
  'a an and are as at be but by can do does for from how i if in into is it its me my of on or should so than that the their them then there these this to was we what when where which who why will with you your'.split(
    ' ',
  ),
);

const terms = (text: string) => tokens(text).filter((t) => t.length > 1 && !STOP.has(t)).map(stem);

interface Doc {
  lesson: Lesson;
  tf: Map<string, number>;
  length: number;
}
export interface LessonIndex {
  docs: Doc[];
  df: Map<string, number>;
  avgLength: number;
  vocabulary: Set<string>;
}

function lessonText(l: Lesson): string {
  // Title and tags are repeated to weight them above body text.
  return [l.title, l.title, l.tags.join(' '), l.tags.join(' '), l.summary, l.objective, ...l.explanation, l.example.title, l.example.body, l.risk, ...l.controls].join(' ');
}

export function buildLessonIndex(lessons: readonly Lesson[]): LessonIndex {
  const docs = lessons.map((lesson) => {
    const ts = terms(lessonText(lesson));
    const tf = new Map<string, number>();
    for (const t of ts) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { lesson, tf, length: ts.length };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLength = docs.reduce((a, d) => a + d.length, 0) / Math.max(1, docs.length);
  return { docs, df, avgLength, vocabulary: buildDomainVocabulary(lessons) };
}

export interface LessonHit {
  lessonId: string;
  title: string;
  score: number;
  summary: string;
  /** The lesson's first explanation paragraph, used for offline answers. */
  excerpt: string;
}

/** BM25 (k1 = 1.2, b = 0.75). Returns hits with a positive score, best first. */
export function searchLessons(index: LessonIndex, query: string, k = 3): LessonHit[] {
  const q = [...new Set(terms(query))];
  if (!q.length) return [];
  const N = index.docs.length;
  return index.docs
    .map((d) => {
      let score = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        const n = index.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += (idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * d.length) / index.avgLength));
      }
      return { lessonId: d.lesson.id, title: d.lesson.title, score: Math.round(score * 100) / 100, summary: d.lesson.summary, excerpt: d.lesson.explanation[0] ?? '' };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * A question is on-topic when it uses at least one course term: lesson tags plus a curated
 * security/AI vocabulary. Raw retrieval scores alone let everyday words ("good", "weather") through.
 */
const DOMAIN_TERMS =
  'ai llm llms genai model models prompt prompts injection jailbreak jailbreaking agent agents agentic tool tools mcp rag retrieval embedding embeddings vector ' +
  'security secure attack attacker attacks threat threats risk risks vulnerability vulnerabilities exploit cve owasp atlas nist guardrail guardrails ' +
  'poisoning poison leakage leak exfiltration privacy pii sensitive authorization authentication permission permissions privilege least oauth token tokens ' +
  'sandbox approval human-in-the-loop audit logging monitoring red-team red teaming testing pentest severity remediation mitigation defense defence defend ' +
  'injection xss output context chatbot assistant copilot plugin api apis supply chain hallucination misuse abuse safety alignment classifier filter moderation ' +
  'trust boundary boundaries architecture data training fine-tuning dataset system-prompt confidential secret secrets credential credentials encryption';

export function buildDomainVocabulary(lessons: readonly Lesson[]): Set<string> {
  const words = [...DOMAIN_TERMS.split(/\s+/), ...lessons.flatMap((l) => l.tags.flatMap((t) => t.split('-')))];
  return new Set(words.flatMap((w) => terms(w)));
}
export const MAX_QUESTION_LENGTH = 500;

/**
 * Requests to attack real systems or build malware are refused before any model is called.
 * The lessons teach defence with fictional systems; this keeps the tutor on that side of the line.
 */
const OFFENSIVE: RegExp[] = [
  /\b(hack|break|get)\s+into\b/,
  /\bsteal(ing)?\b/,
  /\b(crack|brute[- ]?force)\w*\b.*\b(password|account|wifi|hash)/,
  /\b(write|build|create|make|code|generate)\b.*\b(malware|ransomware|keylogger|virus|trojan|botnet|phishing|stealer)\b/,
  /\b(malware|ransomware|keylogger|phishing (email|page|kit))\b.*\b(for me|that works|undetectable)\b/,
  /\b(working|real|live|undetectable)\b.*\b(jailbreak|exploit|payload)s?\b.*\b(for|against|on)\b/,
  /\b(ddos|dos attack|denial of service)\b.*\b(site|server|website|someone)\b/,
  /\b(evade|bypass|disable)\b.*\b(antivirus|edr|detection|logging)\b/,
  /\b(dox|doxx|stalk)/,
];

export type RefusalReason = 'empty' | 'too_long' | 'offensive' | 'off_topic';
export type GuardResult = { ok: true; hits: LessonHit[] } | { ok: false; reason: RefusalReason; hits: LessonHit[] };

export function guardQuestion(index: LessonIndex, question: string): GuardResult {
  const q = question.trim();
  if (!q) return { ok: false, reason: 'empty', hits: [] };
  if (q.length > MAX_QUESTION_LENGTH) return { ok: false, reason: 'too_long', hits: [] };
  const lower = q.toLowerCase();
  if (OFFENSIVE.some((re) => re.test(lower))) return { ok: false, reason: 'offensive', hits: [] };
  const hits = searchLessons(index, q);
  const onTopic = terms(q).some((t) => index.vocabulary.has(t));
  if (!hits.length || !onTopic) return { ok: false, reason: 'off_topic', hits: [] };
  return { ok: true, hits };
}

export const REFUSALS: Record<RefusalReason, string> = {
  empty: 'Ask a question about AI, LLM or agent security.',
  too_long: `Please keep questions under ${MAX_QUESTION_LENGTH} characters.`,
  offensive:
    'I can’t help with attacking real systems or building malicious tools. I can explain how these attacks work conceptually and how to defend against them.',
  off_topic: 'I can only answer questions covered by the lessons in this app: AI security, GenAI/LLM security and AI agent security.',
};

/** Shape the model must return; anything else is discarded and the fallback is used. */
/** A citation as models actually return it: an id string, or an object carrying the id. */
const citationId = (c: unknown): string | null => {
  if (typeof c === 'string') return c.replace(/^\[|\]$/g, '').trim();
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    for (const k of ['lessonId', 'id', 'lesson']) if (typeof o[k] === 'string') return citationId(o[k]);
  }
  return null;
};

export const TutorAnswer = z
  .object({
    answer: z.string().trim().min(1).max(2400),
    citations: z.array(z.unknown()).default([]),
    refused: z.boolean().default(false),
  })
  .transform((a) => ({
    answer: a.answer,
    citations: a.citations.map(citationId).filter((c): c is string => !!c).slice(0, 3),
    refused: a.refused,
  }));
export type TutorAnswer = z.infer<typeof TutorAnswer>;

export interface TutorResponse {
  answer: string;
  citations: { lessonId: string; title: string }[];
  /** "ai" answers are model-generated and labelled as such in the UI. */
  origin: 'ai' | 'lessons';
  refused: boolean;
}

/** Deterministic answer: what the most relevant lessons say, with links. Works offline. */
export function lessonAnswer(hits: LessonHit[]): TutorResponse {
  const top = hits.slice(0, 2);
  const [first, second] = top;
  const parts = first ? [first.summary, first.excerpt] : [];
  if (second) parts.push(`Related: ${second.title}. ${second.summary}`);
  return {
    answer: parts.filter(Boolean).join('\n\n'),
    citations: top.map((h) => ({ lessonId: h.lessonId, title: h.title })),
    origin: 'lessons',
    refused: false,
  };
}

export function refusal(reason: RefusalReason, hits: LessonHit[] = []): TutorResponse {
  return { answer: REFUSALS[reason], citations: hits.slice(0, 2).map((h) => ({ lessonId: h.lessonId, title: h.title })), origin: 'lessons', refused: true };
}
