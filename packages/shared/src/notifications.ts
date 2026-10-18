import { addDays, dayKey, parseDayKey } from './dates';
import { emptyDay, minutes, practiceItems, sumSeconds, series, type DailyStat } from './stats';
import type { StreakInfo } from './streak';

/**
 * Deterministic planner for LOCAL notifications (no server). Re-run whenever progress or
 * settings change; it returns the complete schedule for the next days, which replaces the
 * previous one. Rules: at most one reminder and one recap per day, nothing in quiet hours,
 * no reminder on a day the goal is already met, no recap for a day with no activity.
 */

export interface NotificationPrefs {
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  recapEnabled: boolean;
  weeklyReportEnabled: boolean;
  /** Recap and weekly report time. */
  recapHour: number;
  recapMinute: number;
  /** Quiet hours [start, end) in local hours; start === end disables quiet hours. */
  quietStart: number;
  quietEnd: number;
}

export interface PlanInput {
  now: Date;
  prefs: NotificationPrefs;
  goalMinutes: number;
  stats: Map<string, DailyStat>;
  streak: StreakInfo;
  dueCards: number;
  nextLessonTitle: string | null;
  /** How many days ahead to schedule reminders. */
  horizonDays?: number;
}

export type PlannedType = 'reminder' | 'recap' | 'weekly';

export interface PlannedNotification {
  /** Stable id per type and day: rescheduling never duplicates. */
  id: string;
  type: PlannedType;
  fireAt: Date;
  title: string;
  body: string;
  /** Deep link opened when the notification is tapped. */
  url: string;
}

export function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** Moves a time out of quiet hours to the quiet period's end on the same day (or returns null if that passed). */
function respectQuiet(at: Date, prefs: NotificationPrefs): Date | null {
  if (!inQuietHours(at.getHours(), prefs.quietStart, prefs.quietEnd)) return at;
  const moved = new Date(at);
  moved.setHours(prefs.quietEnd, 0, 0, 0);
  if (moved.getTime() <= at.getTime() && prefs.quietStart > prefs.quietEnd && at.getHours() >= prefs.quietStart) return null; // late evening: skip
  return moved.getDate() === at.getDate() ? moved : null;
}

const at = (day: string, h: number, m: number) => {
  const d = parseDayKey(day);
  d.setHours(h, m, 0, 0);
  return d;
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function reminderText(input: PlanInput, day: string, isToday: boolean) {
  const { streak, dueCards, nextLessonTitle } = input;
  const keepStreak = streak.current > 0 && (isToday ? !streak.activeToday : true);
  if (isToday && keepStreak && streak.current >= 2) {
    return { title: `Keep your ${streak.current}-day streak alive`, body: nextLessonTitle ? `A short lesson is enough: ${nextLessonTitle}.` : 'One short session today keeps it going.', url: '/' };
  }
  if (isToday && dueCards > 0) {
    return { title: `${plural(dueCards, 'flashcard')} ready for review`, body: 'Reviewing now locks them into long-term memory. It takes about two minutes.', url: '/review' };
  }
  const variants = [
    { title: 'Your 5-minute security lesson is ready', body: nextLessonTitle ? `Up next: ${nextLessonTitle}.` : 'Pick up where you left off.', url: '/' },
    { title: 'Today’s daily challenge is waiting', body: 'Five quick rounds on a fictional system. Same puzzle for everyone today.', url: '/practice' },
    { title: 'Ready to close your Learn ring?', body: 'A lesson, a lab or a quick quiz all count toward today’s goal.', url: '/' },
  ];
  return variants[parseDayKey(day).getDate() % variants.length]!;
}

export function planLocalNotifications(input: PlanInput): PlannedNotification[] {
  const { now, prefs, stats, goalMinutes } = input;
  const horizon = input.horizonDays ?? 7;
  const today = dayKey(now);
  const out: PlannedNotification[] = [];
  const t = stats.get(today) ?? emptyDay(today);

  if (prefs.reminderEnabled) {
    for (let i = 0; i < horizon; i++) {
      const day = addDays(today, i);
      const isToday = i === 0;
      if (isToday && minutes(t.activeSeconds) >= goalMinutes) continue; // goal met: no nagging
      const fire = respectQuiet(at(day, prefs.reminderHour, prefs.reminderMinute), prefs);
      if (!fire || fire.getTime() <= now.getTime()) continue;
      out.push({ id: `reminder:${day}`, type: 'reminder', fireAt: fire, ...reminderText(input, day, isToday) });
    }
  }

  // Recap / weekly report for TODAY only: content reflects activity recorded so far (all activity happens in-app).
  const recapAt = respectQuiet(at(today, prefs.recapHour, prefs.recapMinute), prefs);
  const isSunday = parseDayKey(today).getDay() === 0;
  if (recapAt && recapAt.getTime() > now.getTime()) {
    if (isSunday && prefs.weeklyReportEnabled) {
      const week = series(stats, today, 7);
      const total = minutes(sumSeconds(week));
      const activeDays = week.filter((d) => d.activeSeconds >= 60).length;
      const lessons = week.reduce((a, d) => a + d.lessonsCompleted, 0);
      if (total > 0 || lessons > 0) {
        out.push({
          id: `weekly:${today}`,
          type: 'weekly',
          fireAt: recapAt,
          title: `Your week: ${plural(total, 'minute')} of AI security`,
          body: `${plural(activeDays, 'active day')}, ${plural(lessons, 'lesson')} completed. See your weekly report.`,
          url: '/me',
        });
      }
    } else if (prefs.recapEnabled && (t.activeSeconds >= 60 || practiceItems(t) > 0 || t.lessonsCompleted > 0)) {
      const parts = [`${plural(minutes(t.activeSeconds), 'min')}`];
      if (t.lessonsCompleted) parts.push(plural(t.lessonsCompleted, 'lesson'));
      if (practiceItems(t)) parts.push(`${practiceItems(t)} practice`);
      if (t.cardsReviewed) parts.push(plural(t.cardsReviewed, 'card'));
      const answered = t.questionsAnswered + t.gameRounds;
      const acc = answered >= 3 ? `, ${Math.round(((t.questionsCorrect + t.gameCorrect) / answered) * 100)}% accuracy` : '';
      const tomorrow = input.nextLessonTitle ? ` Tomorrow: ${input.nextLessonTitle}.` : '';
      out.push({ id: `recap:${today}`, type: 'recap', fireAt: recapAt, title: 'Today’s learning recap', body: `${parts.join(' · ')}${acc}.${tomorrow}`, url: '/me' });
    }
  }
  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  reminderEnabled: false,
  reminderHour: 20,
  reminderMinute: 0,
  recapEnabled: false,
  weeklyReportEnabled: false,
  recapHour: 21,
  recapMinute: 0,
  quietStart: 22,
  quietEnd: 7,
};
