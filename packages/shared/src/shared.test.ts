import { describe, expect, it } from 'vitest';
import {
  activeMsForTick,
  addDays,
  buildInsights,
  compareWeeks,
  computeStreak,
  dayKey,
  emptyDay,
  IDLE_CUTOFF_MS,
  lastNDays,
  levelFor,
  MAX_TICK_MS,
  nextLesson,
  pickDaily,
  quizXp,
  ringProgress,
  scoreQuiz,
  startOfWeek,
  type ContentPack,
  type DailyStat,
  type Lesson,
} from './index';

const day = (d: string, seconds: number, extra: Partial<DailyStat> = {}): DailyStat => ({
  ...emptyDay(d),
  activeSeconds: seconds,
  ...extra,
});
const toMap = (days: DailyStat[]) => new Map(days.map((d) => [d.day, d]));

describe('dates', () => {
  it('formats local day keys and crosses month boundaries', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('returns n days oldest first', () => {
    expect(lastNDays('2026-10-18', 3)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
  });
  it('finds Monday as start of week', () => {
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12'); // Sunday -> previous Monday
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12');
  });
});

describe('activeMsForTick', () => {
  const base = { lastTickAt: 1_000_000, foreground: true };
  it('credits the full interval when the learner is interacting', () => {
    expect(activeMsForTick({ ...base, now: 1_005_000, lastInteractionAt: 1_004_000 })).toBe(5_000);
  });
  it('stops crediting after the idle cutoff', () => {
    const lastInteractionAt = 1_000_000 - IDLE_CUTOFF_MS + 2_000;
    expect(activeMsForTick({ ...base, now: 1_005_000, lastInteractionAt })).toBe(2_000);
    expect(activeMsForTick({ ...base, now: 1_005_000, lastInteractionAt: 0 })).toBe(0);
  });
  it('credits nothing in the background', () => {
    expect(activeMsForTick({ ...base, foreground: false, now: 1_005_000, lastInteractionAt: 1_005_000 })).toBe(0);
  });
  it('caps long gaps and ignores clock going backwards', () => {
    expect(activeMsForTick({ ...base, now: 1_100_000, lastInteractionAt: 1_100_000 })).toBe(MAX_TICK_MS);
    expect(activeMsForTick({ ...base, now: 999_000, lastInteractionAt: 999_000 })).toBe(0);
  });
});

describe('xp and levels', () => {
  it('maps xp to levels with progress', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: 'Recruit', progress: 0 });
    expect(levelFor(400)).toMatchObject({ level: 2, title: 'Analyst', progress: 0.5 });
    expect(levelFor(99_999)).toMatchObject({ nextAt: null, progress: 1 });
  });
  it('gives a perfect-score bonus', () => {
    expect(quizXp(3, 3)).toBe(50);
    expect(quizXp(2, 3)).toBe(20);
    expect(quizXp(0, 0)).toBe(0);
  });
});

describe('computeStreak', () => {
  const today = '2026-10-18';
  it('keeps yesterday\'s streak alive before today\'s session', () => {
    const s = computeStreak(['2026-10-15', '2026-10-16', '2026-10-17'], today);
    expect(s).toEqual({ current: 3, longest: 3, activeToday: false });
  });
  it('counts today and reports longest historic run', () => {
    const s = computeStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-17', today], today);
    expect(s).toEqual({ current: 2, longest: 4, activeToday: true });
  });
  it('resets after a missed day', () => {
    expect(computeStreak(['2026-10-15'], today).current).toBe(0);
  });
});

describe('stats', () => {
  const today = '2026-10-18';
  it('compares rolling weeks honestly', () => {
    const m = toMap([day(today, 600), day('2026-10-14', 300), day('2026-10-09', 450)]);
    const w = compareWeeks(m, today);
    expect(w.thisWeekSeconds).toBe(900);
    expect(w.lastWeekSeconds).toBe(450);
    expect(w.changePct).toBe(100);
    expect(w.bestDay?.day).toBe(today);
  });
  it('returns null change when there is no baseline', () => {
    expect(compareWeeks(toMap([day(today, 60)]), today).changePct).toBeNull();
  });
  it('caps ring progress at 1', () => {
    const r = ringProgress(day(today, 1200, { questionsAnswered: 2, lessonsCompleted: 3 }), {
      learnMinutes: 10,
      practiceQuestions: 4,
      lessons: 1,
    });
    expect(r).toEqual({ learn: 1, practice: 0.5, lessons: 1 });
  });
});

describe('buildInsights', () => {
  const today = '2026-10-18';
  const noStreak = { current: 0, longest: 0, activeToday: false };
  it('invites a first lesson for brand-new learners', () => {
    expect(buildInsights(new Map(), today, 10, noStreak).map((i) => i.id)).toEqual(['first-day']);
  });
  it('nudges when the goal is within 3 minutes', () => {
    const ins = buildInsights(toMap([day(today, 8 * 60)]), today, 10, { current: 1, longest: 1, activeToday: true });
    expect(ins[0]).toMatchObject({ id: 'goal-close', text: 'Just 2 mins to close your Learn ring.' });
  });
  it('compares today to the average of previous active days', () => {
    const m = toMap([
      day('2026-10-15', 300),
      day('2026-10-16', 300),
      day('2026-10-17', 300),
      day(today, 9 * 60),
    ]);
    const ins = buildInsights(m, today, 20, { current: 4, longest: 4, activeToday: true });
    expect(ins.find((i) => i.id === 'above-avg')?.text).toBe('9 mins today: 4 mins more than your daily average.');
    expect(ins.find((i) => i.id === 'pb-day')).toBeDefined();
  });
  it('welcomes learners back after a break without shaming', () => {
    const ins = buildInsights(toMap([day('2026-10-01', 600)]), today, 10, noStreak);
    expect(ins.map((i) => i.id)).toEqual(['comeback']);
  });
});

describe('progress', () => {
  const lesson = (id: string, roadmapId: string, prerequisites: string[] = []) =>
    ({ id, roadmapId, prerequisites }) as unknown as Lesson;
  const pack = {
    version: 't',
    threats: [],
    lessons: [lesson('a1', 'a'), lesson('a2', 'a', ['a1']), lesson('b1', 'b'), lesson('f1', 'f')],
    roadmaps: [
      { id: 'f', code: 'F', kind: 'supporting', lessonIds: ['f1'] },
      { id: 'b', code: 'B', kind: 'security', lessonIds: ['b1'] },
      { id: 'a', code: 'A', kind: 'security', lessonIds: ['a1', 'a2'] },
    ],
  } as unknown as ContentPack;

  it('resumes the in-progress lesson first', () => {
    expect(nextLesson(pack, new Set(), 'a', 'b1')?.id).toBe('b1');
  });
  it('prefers the focus roadmap and respects prerequisites', () => {
    expect(nextLesson(pack, new Set(), 'b', null)?.id).toBe('b1');
    expect(nextLesson(pack, new Set(['b1']), 'b', null)?.id).toBe('a1');
    expect(nextLesson(pack, new Set(['a1', 'b1']), null, null)?.id).toBe('a2');
  });
  it('falls back to supporting roadmaps last', () => {
    expect(nextLesson(pack, new Set(['a1', 'a2', 'b1']), null, null)?.id).toBe('f1');
    expect(nextLesson(pack, new Set(['a1', 'a2', 'b1', 'f1']), null, null)).toBeNull();
  });
  it('scores quizzes', () => {
    const qs = [{ correctIndex: 1 }, { correctIndex: 0 }, { correctIndex: 2 }] as never[];
    expect(scoreQuiz(qs, [1, 0, null])).toEqual({ correct: 2, total: 3, percent: 67 });
  });
  it('picks the same daily item for everyone on a given day', () => {
    const items = ['x', 'y', 'z', 'w'];
    expect(pickDaily(items, today(), 'threat')).toBe(pickDaily(items, today(), 'threat'));
    expect(pickDaily([], '2026-10-18', 's')).toBeNull();
  });
});

function today() {
  return '2026-10-18';
}
