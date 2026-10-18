import { z } from 'zod';

/**
 * Offline-first sync protocol. Each device keeps its own SQLite store; changes travel as
 * envelopes keyed by (collection, key). The SAME merge function runs on the server and on
 * every device, so all replicas converge regardless of the order changes arrive in.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ms = z.number().int().min(0);
const ref = z.string().min(1).max(120);

export const SYNC_SCHEMAS = {
  lesson_progress: z.strictObject({
    lessonId: ref,
    status: z.enum(['in_progress', 'completed']),
    step: z.number().int().min(0).max(100),
    bestScore: z.number().int().min(0).max(100).nullable(),
    attempts: z.number().int().min(0).max(10_000),
    startedAt: ms,
    updatedAt: ms,
    completedAt: ms.nullable(),
    completedDay: day.nullable(),
  }),
  question_responses: z.strictObject({
    questionId: ref,
    lessonId: ref,
    source: z.enum(['lesson', 'quick_quiz']),
    correct: z.boolean(),
    day,
    createdAt: ms,
  }),
  study_sessions: z.strictObject({
    day,
    activity: z.enum(['lesson', 'quiz', 'review', 'lab', 'game', 'interview', 'news']),
    contentId: ref.nullable(),
    startedAt: ms,
    endedAt: ms,
    activeSeconds: z.number().int().min(0).max(86_400),
  }),
  xp_ledger: z.strictObject({ day, amount: z.number().int().min(0).max(1000), reason: ref, ref, createdAt: ms }),
  fsrs_cards: z.strictObject({ cardId: ref, lessonId: ref, due: ms, data: z.string().max(2000), updatedAt: ms }),
  card_reviews: z.strictObject({ cardId: ref, lessonId: ref, rating: z.number().int().min(1).max(4), day, createdAt: ms }),
  game_rounds: z.strictObject({
    sessionId: ref,
    gameId: ref,
    roundId: ref,
    lessonId: ref.nullable(),
    correct: z.boolean(),
    daily: z.boolean(),
    day,
    createdAt: ms,
  }),
  daily_challenges: z.strictObject({ day, gameId: ref, correct: z.number().int().min(0), total: z.number().int().min(1), completedAt: ms }),
  lab_attempts: z.strictObject({
    labId: ref,
    lessonId: ref.nullable(),
    day,
    startedAt: ms,
    completedAt: ms,
    passed: z.boolean(),
    stars: z.number().int().min(0).max(3),
    runs: z.number().int().min(0).max(10_000),
    controls: z.array(ref).max(50),
  }),
  interview_answers: z.strictObject({
    questionId: ref,
    lessonId: ref.nullable(),
    topic: ref,
    mode: z.enum(['practice', 'mock']),
    sessionId: ref.nullable(),
    answer: z.string().max(4000),
    coverage: z.number().int().min(0).max(100),
    selfRating: z.number().int().min(1).max(4).nullable(),
    day,
    createdAt: ms,
  }),
  mock_sessions: z.strictObject({
    roleId: ref,
    minutes: z.number().int().min(1).max(120),
    questions: z.number().int().min(0).max(100),
    answered: z.number().int().min(0).max(100),
    score: z.number().int().min(0).max(100),
    byTopic: z.array(z.strictObject({ topic: ref, score: z.number().int().min(0).max(100), count: z.number().int().min(0) })).max(20),
    day,
    startedAt: ms,
    completedAt: ms,
  }),
  interview_bookmarks: z.strictObject({ questionId: ref, createdAt: ms }),
  /** Profile-level preferences only; theme, motion and reminders stay per device. */
  profile: z.strictObject({
    displayName: z.string().max(40),
    goalMinutes: z.number().int().min(1).max(240),
    focusRoadmapId: ref,
    targetRole: ref,
    gamification: z.boolean(),
  }),
} as const;

export type SyncCollection = keyof typeof SYNC_SCHEMAS;
export const SYNC_COLLECTIONS = Object.keys(SYNC_SCHEMAS) as SyncCollection[];

export interface SyncEnvelope {
  collection: SyncCollection;
  key: string;
  /** Client clock (ms) of the change; used for last-write-wins where that is the rule. */
  updatedAt: number;
  deleted?: boolean;
  data: Record<string, unknown>;
}

export const MAX_PUSH = 500;
export const MAX_PULL = 1000;

export const SyncEnvelopeSchema = z
  .object({
    collection: z.enum(SYNC_COLLECTIONS as [SyncCollection, ...SyncCollection[]]),
    key: z.string().min(1).max(200),
    updatedAt: ms,
    deleted: z.boolean().optional(),
    data: z.record(z.string(), z.unknown()),
  })
  .superRefine((e, ctx) => {
    if (e.deleted) return; // tombstones carry no payload requirements
    const r = SYNC_SCHEMAS[e.collection].safeParse(e.data);
    if (!r.success) ctx.addIssue({ code: 'custom', message: `invalid ${e.collection}: ${r.error.issues[0]?.message ?? 'data'}`, path: ['data'] });
  });

export const SyncRequest = z.object({
  cursor: z.number().int().min(0),
  changes: z.array(SyncEnvelopeSchema).max(MAX_PUSH),
});
export type SyncRequest = z.infer<typeof SyncRequest>;

export interface SyncResponse {
  cursor: number;
  changes: SyncEnvelope[];
  hasMore: boolean;
}

/** JSON with sorted object keys: Postgres jsonb reorders keys, so plain stringify can't compare. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** True when two envelopes hold the same data and deletion state (timestamps ignored). */
export function sameRecord(a: SyncEnvelope, b: SyncEnvelope): boolean {
  return !!a.deleted === !!b.deleted && stableStringify(a.data) === stableStringify(b.data);
}

/** Only deletable collections accept tombstones; logs are append-only. */
const DELETABLE: ReadonlySet<SyncCollection> = new Set(['interview_bookmarks']);

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : d);

/**
 * Deterministic, commutative-enough merge per collection. Returns the record to keep.
 *  - logs (responses, reviews, rounds, xp, labs, mocks): first write wins (immutable)
 *  - lesson_progress: "completed" is sticky; best score and attempts take the max
 *  - study_sessions: a session only grows, so keep the larger counters
 *  - daily_challenges: the earliest completion of the day counts
 *  - interview_answers: immutable except the self-rating, which may be added later
 *  - fsrs_cards, profile, bookmarks: last write wins
 */
export function mergeRecord(existing: SyncEnvelope | null, incoming: SyncEnvelope): SyncEnvelope {
  if (!existing) return incoming;
  const c = incoming.collection;
  if (incoming.deleted && !DELETABLE.has(c)) return existing;

  switch (c) {
    case 'lesson_progress': {
      const a = existing.data;
      const b = incoming.data;
      const completed = a.status === 'completed' || b.status === 'completed';
      const newer = incoming.updatedAt >= existing.updatedAt ? b : a;
      const firstCompleted = [a, b].filter((x) => typeof x.completedAt === 'number').sort((x, y) => num(x.completedAt) - num(y.completedAt))[0];
      return {
        ...existing,
        updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
        data: {
          lessonId: a.lessonId,
          status: completed ? 'completed' : 'in_progress',
          step: completed ? 0 : newer.step,
          bestScore: a.bestScore === null && b.bestScore === null ? null : Math.max(num(a.bestScore, -1), num(b.bestScore, -1)),
          attempts: Math.max(num(a.attempts), num(b.attempts)),
          startedAt: Math.min(num(a.startedAt, Infinity), num(b.startedAt, Infinity)),
          updatedAt: Math.max(num(a.updatedAt), num(b.updatedAt)),
          completedAt: firstCompleted?.completedAt ?? null,
          completedDay: firstCompleted?.completedDay ?? null,
        },
      };
    }
    case 'study_sessions':
      return {
        ...existing,
        updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
        data: {
          ...existing.data,
          endedAt: Math.max(num(existing.data.endedAt), num(incoming.data.endedAt)),
          activeSeconds: Math.max(num(existing.data.activeSeconds), num(incoming.data.activeSeconds)),
        },
      };
    case 'daily_challenges':
      return num(incoming.data.completedAt) < num(existing.data.completedAt) ? incoming : existing;
    case 'interview_answers':
      return {
        ...existing,
        updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
        data: { ...existing.data, selfRating: incoming.data.selfRating ?? existing.data.selfRating ?? null },
      };
    case 'fsrs_cards':
    case 'profile':
    case 'interview_bookmarks':
      return incoming.updatedAt >= existing.updatedAt ? incoming : existing;
    default:
      return existing; // append-only logs: first write wins
  }
}
