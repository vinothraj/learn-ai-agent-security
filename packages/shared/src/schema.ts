import { z } from 'zod';

/** How established a claim is. Every lesson and interview answer carries one. */
export const EvidenceLevel = z.enum(['established', 'emerging', 'opinion']);
export type EvidenceLevel = z.infer<typeof EvidenceLevel>;

export const ReviewStatus = z.enum(['needs_review', 'reviewed', 'published', 'archived']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const Level = z.enum(['beginner', 'intermediate', 'advanced']);
export type Level = z.infer<typeof Level>;

export const ActivityType = z.enum(['lesson', 'quiz', 'review', 'lab', 'game', 'interview', 'news']);
export type ActivityType = z.infer<typeof ActivityType>;

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ids must be kebab-case');

export const Reference = z.object({
  title: z.string().min(3),
  publisher: z.string().min(2),
  url: z.string().regex(/^https:\/\/[^\s]+$/, 'references must be https URLs'),
});
export type Reference = z.infer<typeof Reference>;

export const QuizQuestion = z
  .object({
    id,
    prompt: z.string().min(10),
    options: z.array(z.string().min(1)).min(2).max(5),
    correctIndex: z.number().int().min(0),
    explanation: z.string().min(10),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: 'correctIndex out of range',
    path: ['correctIndex'],
  });
export type QuizQuestion = z.infer<typeof QuizQuestion>;

export const InterviewQuestion = z.object({
  id,
  question: z.string().min(10),
  modelAnswer: z.string().min(40),
  /** Key concepts a strong answer should mention; used for deterministic scoring. */
  keyConcepts: z.array(z.string().min(2)).min(2),
  evidence: EvidenceLevel,
});
export type InterviewQuestion = z.infer<typeof InterviewQuestion>;

export const Lesson = z.object({
  id,
  roadmapId: id,
  title: z.string().min(4),
  summary: z.string().min(10),
  level: Level,
  minutes: z.number().int().min(2).max(15),
  tags: z.array(z.string()).min(1),
  prerequisites: z.array(id),
  /** Supporting (Roadmap F) lessons recommended when the learner struggles with this one. */
  supportLessons: z.array(id).optional(),
  objective: z.string().min(10),
  explanation: z.array(z.string().min(10)).min(1),
  example: z.object({ title: z.string(), body: z.string().min(20) }),
  risk: z.string().min(20),
  controls: z.array(z.string().min(5)).min(2),
  quiz: z.array(QuizQuestion).min(2).max(5),
  interview: InterviewQuestion,
  references: z.array(Reference).min(1),
  evidence: EvidenceLevel,
  status: ReviewStatus,
  version: z.number().int().min(1),
  /** Date a human expert last reviewed this lesson (YYYY-MM-DD). Drives the content-freshness metric. */
  reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type Lesson = z.infer<typeof Lesson>;

export const Roadmap = z.object({
  id,
  code: z.string().length(1),
  title: z.string(),
  tagline: z.string(),
  description: z.string(),
  /** Security roadmaps are the default; supporting ones are recommended on demand. */
  kind: z.enum(['security', 'career', 'supporting']),
  lessonIds: z.array(id),
});
export type Roadmap = z.infer<typeof Roadmap>;

export const ThreatItem = z.object({
  id,
  title: z.string(),
  category: z.string(),
  summary: z.string().min(20),
  defense: z.string().min(20),
  lessonId: id.optional(),
  reference: Reference,
});
export type ThreatItem = z.infer<typeof ThreatItem>;

export const Flashcard = z.object({
  id,
  lessonId: id,
  front: z.string().min(5),
  back: z.string().min(5),
});
export type Flashcard = z.infer<typeof Flashcard>;

/** Multiple-choice round, optionally with a scenario (document, request, architecture) to inspect. */
export const ChoiceRound = z
  .object({
    id,
    lessonId: id.optional(),
    prompt: z.string().min(10),
    scenario: z.string().optional(),
    options: z.array(z.string().min(1)).min(2).max(6),
    correctIndex: z.number().int().min(0),
    explanation: z.string().min(10),
  })
  .refine((r) => r.correctIndex < r.options.length, { message: 'correctIndex out of range', path: ['correctIndex'] });
export type ChoiceRound = z.infer<typeof ChoiceRound>;

/** Tap every segment that contains a malicious instruction. */
export const SpotRound = z
  .object({
    id,
    lessonId: id.optional(),
    prompt: z.string().min(10),
    segments: z.array(z.object({ text: z.string().min(3), malicious: z.boolean() })).min(3).max(8),
    explanation: z.string().min(10),
  })
  .refine((r) => r.segments.some((s) => s.malicious), { message: 'needs at least one malicious segment' });
export type SpotRound = z.infer<typeof SpotRound>;

/** Pair each finding with its remediation. */
export const MatchRound = z.object({
  id,
  lessonId: id.optional(),
  prompt: z.string().min(10),
  pairs: z.array(z.object({ left: z.string().min(3), right: z.string().min(3) })).min(3).max(4),
  explanation: z.string().min(10),
});
export type MatchRound = z.infer<typeof MatchRound>;

const gameBase = {
  id,
  title: z.string(),
  tagline: z.string(),
  icon: z.enum(['spot', 'lock', 'database', 'tag', 'wrench', 'scale', 'link']),
};

export const Game = z.discriminatedUnion('kind', [
  z.object({ ...gameBase, kind: z.literal('choice'), rounds: z.array(ChoiceRound).min(3) }),
  z.object({ ...gameBase, kind: z.literal('spot'), rounds: z.array(SpotRound).min(3) }),
  z.object({ ...gameBase, kind: z.literal('match'), rounds: z.array(MatchRound).min(3) }),
]);
export type Game = z.infer<typeof Game>;
export type GameRound = ChoiceRound | SpotRound | MatchRound;

/** Radar-chart axis: a named group of lessons. */
export const SkillArea = z.object({
  id,
  label: z.string().min(3).max(20),
  lessonIds: z.array(id).min(1),
});
export type SkillArea = z.infer<typeof SkillArea>;

