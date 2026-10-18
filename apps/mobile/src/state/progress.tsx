import { contentPack } from '@laas/content';
import {
  computeStreak,
  dayKey,
  isActiveDay,
  levelFor,
  nextLesson,
  type DailyStat,
  type LevelInfo,
  type Lesson,
  type StreakInfo,
} from '@laas/shared';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getLessonStatuses, loadDailyStats, type LessonStatus } from '@/db/repo';
import { useSettings } from './settings';

interface ProgressState {
  today: string;
  stats: Map<string, DailyStat>;
  statuses: Map<string, LessonStatus>;
  completed: Set<string>;
  inProgress: LessonStatus | null;
  totalXp: number;
  level: LevelInfo;
  streak: StreakInfo;
  next: Lesson | null;
  totalSeconds: number;
}

interface ProgressCtx extends ProgressState {
  refresh: () => Promise<void>;
}

const Ctx = createContext<ProgressCtx | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const [raw, setRaw] = useState<{ stats: Map<string, DailyStat>; statuses: LessonStatus[]; today: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    const [stats, statuses] = await Promise.all([loadDailyStats(db), getLessonStatuses(db)]);
    return { stats, statuses, today: dayKey(new Date()) };
  }, [db]);

  const refresh = useCallback(async () => setRaw(await load()), [load]);

  useEffect(() => {
    load().then(setRaw);
    // Re-read on resume so "today" rolls over correctly after midnight.
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
    const activeDays: string[] = [];
    for (const d of raw.stats.values()) {
      totalXp += d.xp;
      totalSeconds += d.activeSeconds;
      if (isActiveDay(d)) activeDays.push(d.day);
    }
    return {
      today: raw.today,
      stats: raw.stats,
      statuses,
      completed,
      inProgress,
      totalXp,
      totalSeconds,
      level: levelFor(totalXp),
      streak: computeStreak(activeDays, raw.today),
      next: nextLesson(contentPack, completed, settings.focusRoadmapId, inProgress?.lessonId ?? null),
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
