import { z } from 'zod';

/**
 * Opt-in engagement events (MASTER_PROMPT §16). Deliberately minimal: an event type, a content
 * id or category (never free text), an optional small integer and the learner's local day.
 * `key` makes uploads idempotent: re-sending the same event never double-counts.
 */
export const ANALYTICS_EVENT_TYPES = [
  'active_day', // value = active seconds that day (latest total wins)
  'lesson_started',
  'lesson_completed',
  'quiz_first_attempt', // value = score percent on the first completion
  'lab_started',
  'lab_result', // value = 1 passed, 0 failed
  'notification_tap', // subject = reminder | recap | weekly | push
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const AnalyticsEvent = z.strictObject({
  key: z.string().regex(/^[a-z]{2}:[a-z0-9:-]{1,100}$/),
  type: z.enum(ANALYTICS_EVENT_TYPES),
  subject: z.string().regex(/^[a-z0-9-]{0,64}$/),
  value: z.number().int().min(0).max(86_400).nullable(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type AnalyticsEvent = z.infer<typeof AnalyticsEvent>;

export const MAX_EVENTS_PER_BATCH = 500;
export const EventBatch = z.strictObject({ events: z.array(AnalyticsEvent).max(MAX_EVENTS_PER_BATCH) });

/** Aggregates over fewer people than this are suppressed (shown as null). */
export const MIN_COHORT = 5;

/** A ratio that is suppressed when its population is too small to be non-identifying. */
export interface Rate {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
}

export function rate(numerator: number, denominator: number, population = denominator): Rate {
  if (population < MIN_COHORT || denominator === 0) return { value: null, numerator: null, denominator: null };
  return { value: Math.round((numerator / denominator) * 1000) / 10, numerator, denominator };
}

/** Distinct-user counts below the minimum cohort are suppressed. */
export const userCount = (n: number): number | null => (n < MIN_COHORT ? null : n);

export interface EngagementReport {
  window: { from: string; to: string; days: number };
  minCohort: number;
  active: { dau: number | null; wau: number | null; mau: number | null; series: { day: string; users: number | null }[] };
  minutes: { total: number | null; perActiveUser: number | null };
  lessonCompletion: Rate;
  quizAverage: { value: number | null; attempts: number | null };
  labCompletion: Rate;
  retention: { cohort: string; size: number | null; d1: number | null; d7: number | null; d30: number | null }[];
  roadmapDropoff: { roadmapId: string; title: string; starters: number | null; steps: { lessonId: string; title: string; reached: number | null }[] }[];
  notifications: { push: Rate; localTaps: number | null };
  freshness: { lessons: { reviewed: number; total: number; pct: number }; reviewWindowDays: number; packLabel: string; sources: { name: string; runs: number; ok: number; successRate: number | null }[] };
}
