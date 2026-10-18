import { addDays } from './dates';

export const FREEZE_EVERY_DAYS = 7;
export const MAX_FREEZES = 2;

export interface StreakInfo {
  current: number;
  longest: number;
  /** False means the streak is still alive but today's session hasn't happened yet. */
  activeToday: boolean;
  /** Streak freezes banked (earned one per 7 consecutive active days, max 2). */
  freezes: number;
  /** Past days a freeze was spent on, so the calendar can show them. */
  frozenDays: string[];
}

/**
 * Replays history day by day. A missed past day automatically spends a banked freeze
 * instead of breaking the streak. Today never breaks the streak: it is still in progress.
 */
export function computeStreak(activeDays: Iterable<string>, today: string): StreakInfo {
  const days = new Set(activeDays);
  const activeToday = days.has(today);
  const first = [...days].filter((d) => d <= today).sort()[0];
  if (!first) return { current: 0, longest: 0, activeToday, freezes: 0, frozenDays: [] };

  let run = 0;
  let consecutive = 0; // real active days in a row, for earning freezes
  let freezes = 0;
  let longest = 0;
  const frozenDays: string[] = [];

  for (let d = first; d <= today; d = addDays(d, 1)) {
    if (days.has(d)) {
      run++;
      consecutive++;
      if (consecutive % FREEZE_EVERY_DAYS === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
      longest = Math.max(longest, run);
    } else if (d !== today) {
      consecutive = 0;
      if (run > 0 && freezes > 0) {
        freezes--;
        frozenDays.push(d);
      } else {
        run = 0;
      }
    }
  }
  return { current: run, longest, activeToday, freezes, frozenDays };
}
