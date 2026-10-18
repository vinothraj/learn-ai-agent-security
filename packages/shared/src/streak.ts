import { addDays } from './dates';

export interface StreakInfo {
  current: number;
  longest: number;
  /** False means the streak is still alive but today's session hasn't happened yet. */
  activeToday: boolean;
}

/**
 * A day counts toward the streak when the learner did any qualifying learning.
 * The streak stays alive through the end of today even if today has no activity yet.
 */
export function computeStreak(activeDays: Iterable<string>, today: string): StreakInfo {
  const days = new Set(activeDays);
  const activeToday = days.has(today);

  let current = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // not the start of a run
    let len = 0;
    let c = day;
    while (days.has(c)) {
      len++;
      c = addDays(c, 1);
    }
    longest = Math.max(longest, len);
  }
  return { current, longest, activeToday };
}
