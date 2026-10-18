import { addDays } from './dates';
import { compareWeeks, emptyDay, isActiveDay, minutes, type DailyStat } from './stats';
import type { StreakInfo } from './streak';

export interface Insight {
  id: string;
  text: string;
  tone: 'celebrate' | 'progress' | 'nudge' | 'info';
}

const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Deterministic, rule-based insight sentences. Every number comes from recorded data;
 * nothing is estimated or invented. Ordered most relevant first.
 */
export function buildInsights(
  stats: Map<string, DailyStat>,
  today: string,
  goalMinutes: number,
  streak: StreakInfo,
): Insight[] {
  const out: Insight[] = [];
  const t = stats.get(today) ?? emptyDay(today);
  const todayMin = minutes(t.activeSeconds);

  if (todayMin >= goalMinutes && goalMinutes > 0) {
    out.push({ id: 'goal-met', tone: 'celebrate', text: `Daily goal reached: ${plural(todayMin, 'min')} today.` });
  } else if (todayMin > 0 && goalMinutes - todayMin <= 3) {
    out.push({
      id: 'goal-close',
      tone: 'nudge',
      text: `Just ${plural(goalMinutes - todayMin, 'min')} to close your Learn ring.`,
    });
  }

  const previous = [...stats.values()].filter((d) => d.day < today);
  const prevBest = previous.reduce((m, d) => Math.max(m, d.activeSeconds), 0);
  if (previous.some(isActiveDay) && todayMin >= 2 && t.activeSeconds > prevBest) {
    out.push({ id: 'pb-day', tone: 'celebrate', text: `New personal best: ${plural(todayMin, 'min')} in one day.` });
  }

  if (streak.activeToday && STREAK_MILESTONES.includes(streak.current)) {
    out.push({ id: 'streak-milestone', tone: 'celebrate', text: `${streak.current}-day streak. Consistency beats cramming.` });
  }

  // Average over active days in the previous 14 days (inactive days excluded so the bar is fair).
  const window: DailyStat[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = stats.get(addDays(today, -i));
    if (d && isActiveDay(d)) window.push(d);
  }
  if (window.length >= 3 && todayMin > 0) {
    const avg = Math.round(window.reduce((a, d) => a + d.activeSeconds, 0) / window.length / 60);
    if (todayMin > avg) {
      out.push({
        id: 'above-avg',
        tone: 'progress',
        text: `${plural(todayMin, 'min')} today: ${plural(todayMin - avg, 'min')} more than your daily average.`,
      });
    }
  }

  const week = compareWeeks(stats, today);
  if (week.changePct !== null && week.changePct > 0) {
    out.push({
      id: 'week-up',
      tone: 'progress',
      text: `This week: ${plural(minutes(week.thisWeekSeconds), 'min')}, up ${week.changePct}% on the week before.`,
    });
  }

  if (t.questionsAnswered >= 5) {
    const pct = Math.round((t.questionsCorrect / t.questionsAnswered) * 100);
    if (pct >= 80) out.push({ id: 'accuracy', tone: 'celebrate', text: `${pct}% quiz accuracy today across ${t.questionsAnswered} questions.` });
  }

  if (!streak.activeToday) {
    if (streak.current > 0) {
      out.push({
        id: 'keep-streak',
        tone: 'nudge',
        text: `Keep your ${plural(streak.current, 'day')} streak going with one short lesson today.`,
      });
    } else if (previous.some(isActiveDay)) {
      out.push({ id: 'comeback', tone: 'info', text: 'Welcome back. A 5-minute lesson restarts your streak.' });
    } else {
      out.push({ id: 'first-day', tone: 'info', text: 'Start a 5-minute lesson to begin your first streak.' });
    }
  }

  return out;
}
