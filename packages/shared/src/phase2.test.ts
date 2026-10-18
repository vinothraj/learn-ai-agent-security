import { describe, expect, it } from 'vitest';
import {
  accuracyByPart,
  addDays,
  buildInsights,
  computeBadges,
  computeStreak,
  dayPart,
  deserializeCard,
  emptyDay,
  formatInterval,
  lastNDays,
  lessonMastery,
  masteryTrend,
  newCard,
  previewIntervals,
  Rating,
  retrievability,
  reviewCard,
  seededShuffle,
  serializeCard,
  skillScores,
  State,
  suggestReminder,
  timeOfDayTotals,
  weakTopics,
  type Evidence,
} from './index';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 18, 12, 0, 0).getTime();

describe('streak freezes', () => {
  const today = '2026-10-18';
  it('earns a freeze after 7 consecutive days and spends it on a missed day', () => {
    // 7 active days, miss 2026-10-15, active 16-18
    const days = [...lastNDays('2026-10-14', 7), '2026-10-16', '2026-10-17', today];
    const s = computeStreak(days, today);
    expect(s.frozenDays).toEqual(['2026-10-15']);
    expect(s.freezes).toBe(0);
    expect(s.current).toBe(10);
    expect(s.longest).toBe(10);
  });
  it('breaks the streak when no freeze is banked', () => {
    const s = computeStreak(['2026-10-13', '2026-10-14', '2026-10-16', '2026-10-17'], today);
    expect(s.current).toBe(2);
    expect(s.frozenDays).toEqual([]);
  });
  it('caps banked freezes at 2 and never spends one on today', () => {
    const s = computeStreak(lastNDays('2026-10-17', 21), today);
    expect(s.freezes).toBe(2);
    expect(s.activeToday).toBe(false);
    expect(s.current).toBe(21);
  });
  it('spends two freezes across a two-day gap', () => {
    const days = [...lastNDays('2026-10-15', 14), today];
    const s = computeStreak(days, today);
    expect(s.frozenDays).toEqual(['2026-10-16', '2026-10-17']);
    expect(s.current).toBe(15);
  });
});

describe('fsrs', () => {
  const now = new Date(NOW);
  it('schedules longer intervals for easier grades', () => {
    const card = newCard(now);
    const p = previewIntervals(card, now);
    expect(p[Rating.Again]).toBeLessThan(p[Rating.Good]);
    expect(p[Rating.Good]).toBeLessThanOrEqual(p[Rating.Easy]);
  });
  it('round-trips card state through JSON with real Dates', () => {
    const reviewed = reviewCard(newCard(now), Rating.Good, now);
    const back = deserializeCard(serializeCard(reviewed));
    expect(back.due).toBeInstanceOf(Date);
    expect(back.due.getTime()).toBe(reviewed.due.getTime());
    expect(back.last_review?.getTime()).toBe(now.getTime());
  });
  it('reports recall only for reviewed cards, decaying over time', () => {
    const card = newCard(now);
    expect(card.state).toBe(State.New);
    expect(retrievability(card, now)).toBeNull();
    let c = reviewCard(card, Rating.Good, now);
    c = reviewCard(c, Rating.Good, c.due);
    const soon = retrievability(c, new Date(c.due.getTime()))!;
    const later = retrievability(c, new Date(c.due.getTime() + 60 * DAY))!;
    expect(soon).toBeGreaterThan(later);
    expect(later).toBeGreaterThan(0);
  });
  it('formats intervals compactly', () => {
    expect(formatInterval(30_000)).toBe('<1m');
    expect(formatInterval(10 * 60_000)).toBe('10m');
    expect(formatInterval(3 * 3_600_000)).toBe('3h');
    expect(formatInterval(4 * DAY)).toBe('4d');
    expect(formatInterval(65 * DAY)).toBe('2mo');
  });
});

describe('mastery', () => {
  const ev = (lessonId: string, correct: boolean, daysAgo = 0): Evidence => ({ lessonId, correct, at: NOW - daysAgo * DAY });

  it('needs repeated evidence before reporting high mastery', () => {
    const one = lessonMastery([ev('a', true)], new Map(), NOW).get('a')!;
    const many = lessonMastery(Array.from({ length: 8 }, () => ev('a', true)), new Map(), NOW).get('a')!;
    expect(one.score).toBe(33);
    expect(many.score).toBe(80);
  });
  it('weights recent answers more than old ones', () => {
    const improving = lessonMastery([ev('a', false, 60), ev('a', false, 60), ev('a', true), ev('a', true)], new Map(), NOW);
    const declining = lessonMastery([ev('a', true, 60), ev('a', true, 60), ev('a', false), ev('a', false)], new Map(), NOW);
    expect(improving.get('a')!.score).toBeGreaterThan(declining.get('a')!.score);
  });
  it('blends flashcard recall when available and ignores future evidence', () => {
    const m = lessonMastery([ev('a', true), ev('a', true), { lessonId: 'a', correct: false, at: NOW + DAY }], new Map([['a', [1, 1]]]), NOW);
    expect(m.get('a')).toEqual({ lessonId: 'a', score: 65, attempts: 2 });
  });
  it('finds weak topics and skill coverage', () => {
    const m = lessonMastery([ev('a', false), ev('a', false), ev('a', true), ev('b', true), ev('b', true)], new Map(), NOW);
    expect(weakTopics(m).map((w) => w.lessonId)).toEqual(['a', 'b']);
    expect(weakTopics(m, 40).map((w) => w.lessonId)).toEqual(['a']);
    const skills = skillScores([{ id: 's', label: 'Skill', lessonIds: ['b', 'unstudied'] }], m);
    expect(skills[0]!.score).toBe(25);
  });
  it('builds a weekly trend that only rises as evidence accumulates', () => {
    const evidence = [ev('a', true, 20), ev('a', true, 10), ev('a', true, 1)];
    const trend = masteryTrend(evidence, ['a'], NOW, 4);
    expect(trend).toHaveLength(4);
    expect(trend[0]!.score).toBe(0);
    expect(trend[3]!.score).toBeGreaterThan(trend[1]!.score);
  });
});

describe('time of day', () => {
  const at = (h: number) => new Date(2026, 9, 18, h, 0, 0).getTime();
  it('buckets hours into day parts', () => {
    expect([4, 5, 11, 12, 16, 17, 20, 21, 23].map(dayPart)).toEqual([
      'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night',
    ]);
  });
  it('suggests a reminder only with enough data and a clear favourite', () => {
    const totals = timeOfDayTotals([
      { startedAt: at(19), seconds: 1500 },
      { startedAt: at(8), seconds: 600 },
    ]);
    expect(suggestReminder(totals, 8)).toMatchObject({ part: 'evening', hour: 18, minute: 0 });
    expect(suggestReminder(totals, 19)).toBeNull(); // already in the evening slot
    expect(suggestReminder(timeOfDayTotals([{ startedAt: at(19), seconds: 600 }]), 8)).toBeNull(); // too little data
  });
  it('reports accuracy by part of day only with enough attempts per group', () => {
    const responses = [
      ...Array.from({ length: 10 }, (_, i) => ({ at: at(8), correct: i < 9 })),
      ...Array.from({ length: 10 }, (_, i) => ({ at: at(22), correct: i < 6 })),
    ];
    const partAccuracy = accuracyByPart(responses);
    const streak = { current: 1, longest: 1, activeToday: true, freezes: 0, frozenDays: [] };
    const ins = buildInsights(new Map(), '2026-10-18', 10, streak, { partAccuracy });
    expect(ins.find((i) => i.id === 'part-accuracy')?.text).toBe(
      'Your quiz accuracy is higher in the morning (90% vs 60% in the night).',
    );
    const few = accuracyByPart(responses.slice(0, 15));
    expect(buildInsights(new Map(), '2026-10-18', 10, streak, { partAccuracy: few }).find((i) => i.id === 'part-accuracy')).toBeUndefined();
  });
});

describe('insight extras', () => {
  it('mentions due cards and a freeze that saved the streak', () => {
    const today = '2026-10-18';
    const streak = { current: 9, longest: 9, activeToday: true, freezes: 0, frozenDays: [addDays(today, -1)] };
    const ins = buildInsights(new Map([[today, { ...emptyDay(today), activeSeconds: 60 }]]), today, 10, streak, { dueCards: 4 });
    expect(ins.map((i) => i.id).slice(0, 2)).toEqual(['freeze-used', 'cards-due']);
    expect(ins[1]!.text).toBe('4 flashcards are due for review.');
  });
});

describe('badges and shuffles', () => {
  it('derives badge state and progress from activity', () => {
    const b = computeBadges({
      lessonsCompleted: 2,
      roadmapsCompleted: 0,
      longestStreak: 7,
      perfectLessons: 1,
      cardsReviewed: 60,
      dailyChallenges: 0,
      distinctGamesPlayed: 3,
      totalGames: 7,
      totalMinutes: 30,
      labsPassed: 0,
      totalLabs: 10,
    });
    const byId = new Map(b.map((x) => [x.id, x]));
    expect(byId.get('first-lesson')!.earned).toBe(true);
    expect(byId.get('five-lessons')).toMatchObject({ earned: false, progress: '2 / 5' });
    expect(byId.get('streak-7')!.earned).toBe(true);
    expect(byId.get('cards-50')).toMatchObject({ earned: true, progress: '50 / 50' });
    expect(byId.get('all-games')!.ratio).toBeCloseTo(3 / 7);
  });
  it('shuffles deterministically per seed without losing items', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = seededShuffle(items, 'daily:2026-10-18');
    expect(seededShuffle(items, 'daily:2026-10-18')).toEqual(a);
    expect(seededShuffle(items, 'daily:2026-10-19')).not.toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
});
