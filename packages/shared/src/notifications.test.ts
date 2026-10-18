import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFICATION_PREFS, emptyDay, inQuietHours, planLocalNotifications, type DailyStat, type PlanInput } from './index';

// 2026-10-17 is a Saturday, 2026-10-18 a Sunday.
const SAT_NOON = new Date(2026, 9, 17, 12, 0, 0);
const streak = { current: 0, longest: 0, activeToday: false, freezes: 0, frozenDays: [] as string[] };
const day = (d: string, extra: Partial<DailyStat>): DailyStat => ({ ...emptyDay(d), ...extra });

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  now: SAT_NOON,
  prefs: { ...DEFAULT_NOTIFICATION_PREFS, reminderEnabled: true, recapEnabled: true, weeklyReportEnabled: true, reminderHour: 19, recapHour: 21, quietStart: 22, quietEnd: 7 },
  goalMinutes: 10,
  stats: new Map(),
  streak,
  dueCards: 0,
  nextLessonTitle: 'Indirect prompt injection',
  ...over,
});

describe('quiet hours', () => {
  it('handles ranges that cross midnight', () => {
    expect(inQuietHours(23, 22, 7)).toBe(true);
    expect(inQuietHours(6, 22, 7)).toBe(true);
    expect(inQuietHours(7, 22, 7)).toBe(false);
    expect(inQuietHours(13, 12, 14)).toBe(true);
    expect(inQuietHours(3, 5, 5)).toBe(false);
  });
});

describe('planLocalNotifications', () => {
  it('schedules one reminder per day with stable ids, and no recap without activity', () => {
    const plan = planLocalNotifications(base());
    const reminders = plan.filter((p) => p.type === 'reminder');
    expect(reminders).toHaveLength(7);
    expect(new Set(reminders.map((r) => r.id)).size).toBe(7);
    expect(reminders[0]).toMatchObject({ id: 'reminder:2026-10-17' });
    expect(reminders[0]!.fireAt.getHours()).toBe(19);
    expect(plan.some((p) => p.type === 'recap')).toBe(false);
  });

  it('skips today’s reminder once the goal is met and sends a factual recap instead', () => {
    const stats = new Map([['2026-10-17', day('2026-10-17', { activeSeconds: 12 * 60, lessonsCompleted: 1, questionsAnswered: 4, questionsCorrect: 3 })]]);
    const plan = planLocalNotifications(base({ stats }));
    expect(plan.find((p) => p.id === 'reminder:2026-10-17')).toBeUndefined();
    const recap = plan.find((p) => p.type === 'recap')!;
    expect(recap.body).toBe('12 mins · 1 lesson · 4 practice, 75% accuracy. Tomorrow: Indirect prompt injection.');
    expect(recap.fireAt.getHours()).toBe(21);
  });

  it('personalises today’s reminder: streak first, then due cards', () => {
    const s = planLocalNotifications(base({ streak: { ...streak, current: 5 } })).find((p) => p.id === 'reminder:2026-10-17')!;
    expect(s.title).toBe('Keep your 5-day streak alive');
    const c = planLocalNotifications(base({ dueCards: 8 })).find((p) => p.id === 'reminder:2026-10-17')!;
    expect(c).toMatchObject({ title: '8 flashcards ready for review', url: '/review' });
  });

  it('never schedules inside quiet hours and drops past times', () => {
    const late = base({ prefs: { ...base().prefs, reminderHour: 23, recapHour: 23 } });
    const plan = planLocalNotifications({ ...late, stats: new Map([['2026-10-17', day('2026-10-17', { activeSeconds: 600 })]]) });
    expect(plan.every((p) => !inQuietHours(p.fireAt.getHours(), 22, 7))).toBe(true);
    const evening = planLocalNotifications(base({ now: new Date(2026, 9, 17, 20, 0, 0) }));
    expect(evening.find((p) => p.id === 'reminder:2026-10-17')).toBeUndefined(); // 19:00 already passed
  });

  it('sends a weekly report on Sunday instead of the daily recap', () => {
    const stats = new Map([
      ['2026-10-14', day('2026-10-14', { activeSeconds: 600, lessonsCompleted: 1 })],
      ['2026-10-18', day('2026-10-18', { activeSeconds: 300 })],
    ]);
    const plan = planLocalNotifications(base({ now: new Date(2026, 9, 18, 9, 0, 0), stats }));
    expect(plan.find((p) => p.type === 'recap')).toBeUndefined();
    expect(plan.find((p) => p.type === 'weekly')).toMatchObject({ title: 'Your week: 15 minutes of AI security', body: '2 active days, 1 lesson completed. See your weekly report.' });
  });

  it('respects disabled preferences', () => {
    const off = { ...DEFAULT_NOTIFICATION_PREFS };
    expect(planLocalNotifications(base({ prefs: off, stats: new Map([['2026-10-17', day('2026-10-17', { activeSeconds: 900 })]]) }))).toEqual([]);
  });
});
