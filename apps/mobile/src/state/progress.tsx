import { contentPack, flashcardsByLesson, lessonById } from '@laas/content';
import {
  computeBadges,
  computeStreak,
  dayKey,
  isActiveDay,
  lessonMastery,
  levelFor,
  nextLesson,
  retrievability,
  roadmapProgress,
  skillScores,
  weakTopics,
  type Badge,
  type DailyStat,
  type Evidence,
  type Lesson,
  type LessonMastery,
  type LevelInfo,
  type StreakInfo,
} from '@laas/shared';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  ensureCards,
  getCards,
  getDailyChallenge,
  getLessonStatuses,
  loadCounters,
  loadDailyStats,
  loadEvidence,
  loadLabBests,
  loadBookmarks,
  loadMocks,
  loadQuestionStats,
  type MockSummary,
  type QuestionStat,
  loadSessions,
  type DailyChallengeResult,
  type LabBest,
  type LessonStatus,
  type StoredCard,
} from '@/db/repo';
import { useSettings } from './settings';

interface Raw {
  today: string;
  now: number;
  stats: Map<string, DailyStat>;
  statuses: LessonStatus[];
  cards: StoredCard[];
  evidence: Evidence[];
  sessions: { startedAt: number; seconds: number }[];
  dailyToday: DailyChallengeResult | null;
  counters: Awaited<ReturnType<typeof loadCounters>>;
  labBests: Map<string, LabBest>;
  questionStats: Map<string, QuestionStat>;
  mocks: MockSummary[];
  bookmarks: Set<string>;
}

interface ProgressCtx {
  today: string;
  stats: Map<string, DailyStat>;
  statuses: Map<string, LessonStatus>;
  completed: Set<string>;
  inProgress: LessonStatus | null;
  totalXp: number;
  totalSeconds: number;
  level: LevelInfo;
  streak: StreakInfo;
  next: Lesson | null;
  cards: StoredCard[];
  dueCards: StoredCard[];
  mastery: Map<string, LessonMastery>;
  weak: LessonMastery[];
  skills: { id: string; label: string; score: number }[];
  evidence: Evidence[];
  sessions: { startedAt: number; seconds: number }[];
  dailyToday: DailyChallengeResult | null;
  badges: Badge[];
  labBests: Map<string, LabBest>;
  questionStats: Map<string, QuestionStat>;
  mocks: MockSummary[];
  bookmarks: Set<string>;
  playedGames: Set<string>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<ProgressCtx | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const [raw, setRaw] = useState<Raw | null>(null);

  const load = useCallback(async (): Promise<Raw> => {
    const now = new Date();
    const today = dayKey(now);
    const statuses = await getLessonStatuses(db);
    // Completed lessons always have their flashcards in the deck (also back-fills Phase 1 progress).
    const completedIds = statuses.filter((s) => s.status === 'completed').map((s) => s.lessonId);
    await ensureCards(db, completedIds.flatMap((id) => flashcardsByLesson.get(id) ?? []));
    const [stats, cards, evidence, sessions, dailyToday, counters, labBests, questionStats, mocks, bookmarks] = await Promise.all([
      loadDailyStats(db),
      getCards(db),
      loadEvidence(db),
      loadSessions(db),
      getDailyChallenge(db, today),
      loadCounters(db),
      loadLabBests(db),
      loadQuestionStats(db),
      loadMocks(db),
      loadBookmarks(db),
    ]);
    return { today, now: now.getTime(), stats, statuses, cards, evidence, sessions, dailyToday, counters, labBests, questionStats, mocks, bookmarks };
  }, [db]);

  const refresh = useCallback(async () => setRaw(await load()), [load]);

  useEffect(() => {
    load().then(setRaw);
    // Re-read on resume so "today" and due cards roll over correctly.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load().then(setRaw);
    });
    return () => sub.remove();
  }, [load]);

  const value = useMemo<ProgressCtx | null>(() => {
    if (!raw) return null;
    const statuses = new Map(raw.statuses.map((s) => [s.lessonId, s]));
    const completed = new Set(raw.statuses.filter((s) => s.status === 'completed').map((s) => s.lessonId));
    const inProgress = raw.statuses.find((s) => s.status === 'in_progress') ?? null;

    let totalXp = 0;
    let totalSeconds = 0;
    let cardsReviewed = 0;
    const activeDays: string[] = [];
    for (const d of raw.stats.values()) {
      totalXp += d.xp;
      totalSeconds += d.activeSeconds;
      cardsReviewed += d.cardsReviewed;
      if (isActiveDay(d)) activeDays.push(d.day);
    }
    const streak = computeStreak(activeDays, raw.today);

    const nowDate = new Date(raw.now);
    const recall = new Map<string, number[]>();
    for (const c of raw.cards) {
      const r = retrievability(c.card, nowDate);
      if (r !== null) recall.set(c.lessonId, [...(recall.get(c.lessonId) ?? []), r]);
    }
    const mastery = lessonMastery(raw.evidence, recall, raw.now);
    const weak = weakTopics(mastery).filter((w) => lessonById.has(w.lessonId));

    const roadmapsCompleted = contentPack.roadmaps.filter((r) => {
      const p = roadmapProgress(r, completed);
      return p.total > 0 && p.done === p.total;
    }).length;

    return {
      today: raw.today,
      stats: raw.stats,
      statuses,
      completed,
      inProgress,
      totalXp,
      totalSeconds,
      level: levelFor(totalXp),
      streak,
      next: nextLesson(contentPack, completed, settings.focusRoadmapId, inProgress?.lessonId ?? null),
      cards: raw.cards,
      dueCards: raw.cards.filter((c) => c.due <= raw.now),
      mastery,
      weak,
      skills: skillScores(contentPack.skills, mastery),
      evidence: raw.evidence,
      sessions: raw.sessions,
      dailyToday: raw.dailyToday,
      badges: computeBadges({
        lessonsCompleted: completed.size,
        roadmapsCompleted,
        longestStreak: streak.longest,
        perfectLessons: raw.counters.perfectLessons,
        cardsReviewed,
        dailyChallenges: raw.counters.dailyChallenges,
        distinctGamesPlayed: raw.counters.distinctGamesPlayed,
        totalGames: contentPack.games.length,
        totalMinutes: Math.floor(totalSeconds / 60),
        labsPassed: raw.counters.labsPassed,
        totalLabs: contentPack.labs.length,
        mocksCompleted: raw.counters.mocksCompleted,
        bestMockScore: raw.counters.bestMockScore,
      }),
      labBests: raw.labBests,
      questionStats: raw.questionStats,
      mocks: raw.mocks,
      bookmarks: raw.bookmarks,
      playedGames: new Set(raw.counters.playedGames),
      refresh,
    };
  }, [raw, refresh, settings.focusRoadmapId]);

  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProgress() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}
