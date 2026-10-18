import type { ActivityType } from './schema';
import { addDays, lastNDays } from './dates';

export interface DailyStat {
  day: string;
  activeSeconds: number;
  byActivity: Partial<Record<ActivityType, number>>;
  lessonsCompleted: number;
  questionsAnswered: number;
  questionsCorrect: number;
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
    xp: 0,
  };
}

export const minutes = (seconds: number) => Math.floor(seconds / 60);

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
  return d.activeSeconds >= 60 || d.lessonsCompleted > 0 || d.questionsAnswered > 0;
}

export interface RingGoals {
  learnMinutes: number;
  practiceQuestions: number;
  lessons: number;
}

export const DEFAULT_RING_GOALS: RingGoals = { learnMinutes: 10, practiceQuestions: 5, lessons: 1 };

export interface Rings {
  learn: number;
  practice: number;
  lessons: number;
}

/** Ring fill ratios, capped at 1 for drawing (values above goal are still shown as text). */
export function ringProgress(today: DailyStat, goals: RingGoals): Rings {
  const ratio = (v: number, g: number) => (g <= 0 ? 0 : Math.min(1, v / g));
  return {
    learn: ratio(today.activeSeconds / 60, goals.learnMinutes),
    practice: ratio(today.questionsAnswered, goals.practiceQuestions),
    lessons: ratio(today.lessonsCompleted, goals.lessons),
  };
}
