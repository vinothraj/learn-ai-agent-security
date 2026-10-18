import type { ActivityType } from './schema';
import { addDays, lastNDays } from './dates';

export interface DailyStat {
  day: string;
  activeSeconds: number;
  byActivity: Partial<Record<ActivityType, number>>;
  lessonsCompleted: number;
  questionsAnswered: number;
  questionsCorrect: number;
  gameRounds: number;
  gameCorrect: number;
  cardsReviewed: number;
  /** Simulated security tests executed in labs. */
  labRuns: number;
  labsPassed: number;
  interviewAnswers: number;
  xp: number;
}

export function emptyDay(day: string): DailyStat {
  return {
    day,
    activeSeconds: 0,
    byActivity: {},
    lessonsCompleted: 0,
    questionsAnswered: 0,
    questionsCorrect: 0,
    gameRounds: 0,
    gameCorrect: 0,
    cardsReviewed: 0,
    labRuns: 0,
    labsPassed: 0,
    interviewAnswers: 0,
    xp: 0,
  };
}

export const minutes = (seconds: number) => Math.floor(seconds / 60);

/** Practice items = quiz questions + game rounds + simulated lab tests + interview answers. */
export const practiceItems = (d: DailyStat) => d.questionsAnswered + d.gameRounds + d.labRuns + d.interviewAnswers;

/** Fills gaps so charts always get one entry per day, oldest first. */
export function series(stats: Map<string, DailyStat>, endDay: string, n: number): DailyStat[] {
  return lastNDays(endDay, n).map((d) => stats.get(d) ?? emptyDay(d));
}

export function sumSeconds(days: DailyStat[]): number {
  return days.reduce((acc, d) => acc + d.activeSeconds, 0);
}

export interface WeekComparison {
  thisWeekSeconds: number;
  lastWeekSeconds: number;
  /** Percentage change; null when last week had no activity (no honest baseline). */
  changePct: number | null;
  bestDay: DailyStat | null;
}

/** Rolling 7 days ending today vs the 7 days before that. */
export function compareWeeks(stats: Map<string, DailyStat>, today: string): WeekComparison {
  const thisWeek = series(stats, today, 7);
  const lastWeek = series(stats, addDays(today, -7), 7);
  const thisWeekSeconds = sumSeconds(thisWeek);
  const lastWeekSeconds = sumSeconds(lastWeek);
  const best = thisWeek.reduce<DailyStat | null>(
    (b, d) => (d.activeSeconds > 0 && (!b || d.activeSeconds > b.activeSeconds) ? d : b),
    null,
  );
  return {
    thisWeekSeconds,
    lastWeekSeconds,
    changePct:
      lastWeekSeconds > 0
        ? Math.round(((thisWeekSeconds - lastWeekSeconds) / lastWeekSeconds) * 100)
        : null,
    bestDay: best,
  };
}

/** A day counts toward streaks if the learner did at least a minute or finished something. */
export function isActiveDay(d: DailyStat): boolean {
  return d.activeSeconds >= 60 || d.lessonsCompleted > 0 || practiceItems(d) > 0 || d.cardsReviewed > 0;
}

export const PRACTICE_GOAL = 5;
export const REVISE_GOAL = 5;

export interface RingValue {
  value: number; // 0..1, capped for drawing
  detail: string;
}

export function learnRing(today: DailyStat, goalMinutes: number): RingValue {
  return {
    value: goalMinutes <= 0 ? 0 : Math.min(1, today.activeSeconds / 60 / goalMinutes),
    detail: `${minutes(today.activeSeconds)} / ${goalMinutes} min`,
  };
}

export function practiceRing(today: DailyStat): RingValue {
  const n = practiceItems(today);
  return { value: Math.min(1, n / PRACTICE_GOAL), detail: `${n} / ${PRACTICE_GOAL} items` };
}

/**
 * Revision ring. Goal is the smaller of 5 and what was actually available today, so a
 * learner with few cards can still close it. An empty deck is shown honestly as locked.
 */
export function reviseRing(reviewedToday: number, dueNow: number, deckSize: number): RingValue {
  if (deckSize === 0) return { value: 0, detail: 'Unlocks after a lesson' };
  const goal = Math.min(REVISE_GOAL, reviewedToday + dueNow);
  if (goal === 0) return { value: 1, detail: 'All caught up' };
  return { value: Math.min(1, reviewedToday / goal), detail: `${reviewedToday} / ${goal} cards` };
}
