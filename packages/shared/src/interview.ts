import { z } from 'zod';
import { seededShuffle } from './progress';
import { EvidenceLevel, Level } from './schema';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ids must be kebab-case');

export const InterviewType = z.enum(['concept', 'scenario', 'troubleshooting', 'mcq']);
export type InterviewType = z.infer<typeof InterviewType>;

export const RubricPoint = z.object({
  /** What a strong answer covers, shown to the learner. */
  concept: z.string().min(3),
  /** Phrases that count as covering it (any one). Omit to derive from the concept's words. */
  keywords: z.array(z.string().min(2)).optional(),
  weight: z.number().min(0.5).max(3).optional(),
});
export type RubricPoint = z.infer<typeof RubricPoint>;

export const InterviewItem = z
  .object({
    id,
    type: InterviewType,
    /** Skill-area id (radar axis). */
    topic: id,
    level: Level,
    /** Empty = relevant to every role. */
    roles: z.array(id),
    question: z.string().min(15),
    mcq: z.object({ options: z.array(z.string().min(1)).min(3).max(5), correctIndex: z.number().int().min(0) }).optional(),
    modelAnswer: z.string().min(40),
    reasoning: z.string().min(20),
    followUps: z.array(z.string().min(10)),
    rubric: z.array(RubricPoint),
    evidence: EvidenceLevel,
    lessonId: id.optional(),
  })
  .refine((q) => (q.type === 'mcq') === !!q.mcq, { message: 'mcq items need options; others must not have them' })
  .refine((q) => !q.mcq || q.mcq.correctIndex < q.mcq.options.length, { message: 'mcq correctIndex out of range' })
  .refine((q) => q.type === 'mcq' || q.rubric.length >= 3, { message: 'open questions need at least 3 rubric points' });
export type InterviewItem = z.infer<typeof InterviewItem>;

export const PrepWeek = z.object({
  title: z.string().min(3),
  goal: z.string().min(10),
  /** References: "lesson:<id>", "lab:<id>", "game:<id>", "topic:<skill id>" (interview practice), "mock". */
  tasks: z.array(z.string().regex(/^(lesson|lab|game|topic):[a-z0-9-]+$|^mock$/)).min(2),
});

export const InterviewRole = z.object({
  id,
  title: z.string().min(5),
  summary: z.string().min(20),
  focusSkills: z.array(id).min(2),
  weeks: z.array(PrepWeek).min(2).max(4),
});
export type InterviewRole = z.infer<typeof InterviewRole>;

// ---------------------------------------------------------------------------
// Deterministic answer scoring: transparent keyword/concept coverage, no AI.
// ---------------------------------------------------------------------------

const STOP = new Set(
  'a an the and or of to in on for with from into by as at is are be been was were this that these those it its not no per via vs use using your you we our their them they should would can could must than then also both each any all more most very how what why when which who whom'.split(
    ' ',
  ),
);

const SUFFIXES: [string, string][] = [
  ['ational', 'at'],
  ['ations', 'at'],
  ['ation', 'at'],
  ['ments', ''],
  ['ment', ''],
  ['ities', ''],
  ['ity', ''],
  ['ings', ''],
  ['ing', ''],
  ['ions', ''],
  ['ion', ''],
  ['ies', 'y'],
  ['ied', 'y'],
  ['ers', ''],
  ['er', ''],
  ['ed', ''],
  ['es', ''],
  ['ly', ''],
  ['s', ''],
  ['e', ''],
];

/**
 * Small rule-based stemmer so word forms meet: validate/validation/validated -> "validat",
 * log/logs/logging -> "log", permission/permissions -> "permiss".
 */
export function stem(word: string): string {
  let w = word.toLowerCase();
  for (const [suf, rep] of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length + rep.length >= 3) {
      w = w.slice(0, -suf.length) + rep;
      break;
    }
  }
  // Collapse a doubled final consonant left by suffix removal (logg -> log), except s/l/z.
  if (w.length > 3 && w[w.length - 1] === w[w.length - 2] && !'aeiouslz'.includes(w[w.length - 1]!)) w = w.slice(0, -1);
  return w;
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function stems(text: string): string[] {
  return tokens(text).map(stem);
}

/** Significant words used when a rubric point has no explicit keywords. */
export function significantWords(text: string): string[] {
  return [...new Set(tokens(text).filter((t) => t.length > 2 && !STOP.has(t)).map(stem))];
}

/**
 * A term of 4+ characters also matches answer words that start with it, so rubric prefixes
 * like "authoriz" catch authorize/authorization. Shorter terms must match exactly.
 */
function hasTerm(term: string, answerStems: ReadonlySet<string>): boolean {
  if (answerStems.has(term)) return true;
  if (term.length < 4) return false;
  for (const a of answerStems) if (a.startsWith(term)) return true;
  return false;
}

export function conceptCovered(point: RubricPoint, answerStems: ReadonlySet<string>): boolean {
  if (point.keywords?.length) {
    return point.keywords.some((k) => {
      const ks = stems(k).filter((t) => !STOP.has(t));
      return ks.length > 0 && ks.every((t) => hasTerm(t, answerStems));
    });
  }
  const words = significantWords(point.concept);
  if (words.length === 0) return false;
  const hits = words.filter((w) => hasTerm(w, answerStems)).length;
  return hits >= Math.ceil(words.length * 0.6);
}

export interface AnswerScore {
  /** 0-100, weighted share of rubric concepts covered (MCQ: 0 or 100). */
  coverage: number;
  covered: string[];
  missed: string[];
  wordCount: number;
  /** Plain-language notes, e.g. "Very short answer". */
  notes: string[];
}

export function scoreAnswer(item: InterviewItem, answer: string | number | null): AnswerScore {
  if (item.type === 'mcq') {
    const ok = typeof answer === 'number' && answer === item.mcq!.correctIndex;
    return { coverage: ok ? 100 : 0, covered: [], missed: [], wordCount: 0, notes: answer === null ? ['Skipped'] : [] };
  }
  const text = typeof answer === 'string' ? answer : '';
  const wordCount = tokens(text).length;
  const answerStems = new Set(stems(text));
  let total = 0;
  let got = 0;
  const covered: string[] = [];
  const missed: string[] = [];
  for (const p of item.rubric) {
    const w = p.weight ?? 1;
    total += w;
    if (conceptCovered(p, answerStems)) {
      got += w;
      covered.push(p.concept);
    } else missed.push(p.concept);
  }
  const notes: string[] = [];
  if (wordCount === 0) notes.push('Skipped');
  else if (wordCount < 25) notes.push('Very short answer. Interviewers expect structure and specifics.');
  return { coverage: total ? Math.round((got / total) * 100) : 0, covered, missed, wordCount, notes };
}

export const SELF_RATINGS = [
  { value: 1, label: 'Missed it' },
  { value: 2, label: 'Partial' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Strong' },
] as const;

// ---------------------------------------------------------------------------
// Mock interviews
// ---------------------------------------------------------------------------

export const MOCK_LENGTHS = [
  { minutes: 10, questions: 4 },
  { minutes: 20, questions: 7 },
  { minutes: 30, questions: 10 },
] as const;

export function itemsForRole(items: readonly InterviewItem[], role: InterviewRole): InterviewItem[] {
  return items.filter((i) => i.roles.includes(role.id) || role.focusSkills.includes(i.topic) || i.roles.length === 0);
}

/**
 * Picks a varied question set: weak topics first, then round-robin across topics, with at
 * least one scenario or troubleshooting question when available. Deterministic per seed.
 */
export function buildMock(
  items: readonly InterviewItem[],
  role: InterviewRole,
  count: number,
  weakTopics: readonly string[],
  seed: string,
): InterviewItem[] {
  const pool = seededShuffle(itemsForRole(items, role), seed);
  const byTopic = new Map<string, InterviewItem[]>();
  for (const i of pool) byTopic.set(i.topic, [...(byTopic.get(i.topic) ?? []), i]);
  const topicOrder = [...byTopic.keys()].sort((a, b) => {
    const rank = (t: string) => (weakTopics.includes(t) ? 0 : role.focusSkills.includes(t) ? 1 : 2);
    return rank(a) - rank(b);
  });
  const out: InterviewItem[] = [];
  while (out.length < count && [...byTopic.values()].some((l) => l.length)) {
    for (const t of topicOrder) {
      const next = byTopic.get(t)!.shift();
      if (next) out.push(next);
      if (out.length >= count) break;
    }
  }
  const applied = (i: InterviewItem) => i.type === 'scenario' || i.type === 'troubleshooting';
  if (!out.some(applied)) {
    const extra = pool.find((i) => applied(i) && !out.includes(i));
    if (extra && out.length) out[out.length - 1] = extra;
  }
  return out;
}

export interface MockResult {
  item: InterviewItem;
  score: AnswerScore | null; // null = not reached before time ran out
}

export interface Scorecard {
  overall: number;
  answered: number;
  total: number;
  byTopic: { topic: string; score: number; count: number }[];
  weakTopics: string[];
  strongTopics: string[];
}

/** Unanswered questions count as 0, so running out of time is reflected honestly. */
export function scoreMock(results: readonly MockResult[]): Scorecard {
  const val = (r: MockResult) => r.score?.coverage ?? 0;
  const topics = new Map<string, number[]>();
  for (const r of results) topics.set(r.item.topic, [...(topics.get(r.item.topic) ?? []), val(r)]);
  const byTopic = [...topics.entries()]
    .map(([topic, v]) => ({ topic, score: Math.round(v.reduce((a, b) => a + b, 0) / v.length), count: v.length }))
    .sort((a, b) => a.score - b.score);
  const overall = results.length ? Math.round(results.reduce((a, r) => a + val(r), 0) / results.length) : 0;
  return {
    overall,
    answered: results.filter((r) => r.score && !r.score.notes.includes('Skipped')).length,
    total: results.length,
    byTopic,
    weakTopics: byTopic.filter((t) => t.score < 60).map((t) => t.topic),
    strongTopics: byTopic.filter((t) => t.score >= 80).map((t) => t.topic),
  };
}

export function mockXp(scorecard: Scorecard): number {
  return scorecard.answered === 0 ? 0 : 20 + Math.round(scorecard.overall / 5);
}
