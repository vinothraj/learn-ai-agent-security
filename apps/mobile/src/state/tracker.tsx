import { activeMsForTick, dayKey, XP_RULES, type ActivityType } from '@laas/shared';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { AppState, View } from 'react-native';

import { addStudySeconds, awardXp, secondsOnDay } from '@/db/repo';
import { useProgress } from './progress';
import { useSettings } from './settings';

const TICK_MS = 5_000;
const FLUSH_MS = 15_000;

interface TrackerCtx {
  getLastInteraction: () => number;
  markInteraction: () => void;
}

const Ctx = createContext<TrackerCtx | null>(null);

/** Wraps the app and records the time of the latest touch anywhere on screen. */
export function TrackerProvider({ children }: { children: ReactNode }) {
  const lastInteraction = useRef(0);
  const markInteraction = useCallback(() => {
    lastInteraction.current = Date.now();
  }, []);
  const getLastInteraction = useCallback(() => lastInteraction.current, []);
  return (
    <Ctx.Provider value={{ getLastInteraction, markInteraction }}>
      <View style={{ flex: 1 }} onTouchStart={markInteraction}>
        {children}
      </View>
    </Ctx.Provider>
  );
}

/**
 * Counts active learning time while the calling screen is focused. Time is credited only
 * when the app is foregrounded and the learner touched the screen within the idle window.
 */
export function useStudySession(activity: ActivityType, contentId: string | null) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStudySession must be used inside TrackerProvider');
  const db = useSQLiteContext();
  const { refresh } = useProgress();
  const { settings } = useSettings();
  const goalMinutes = settings.goalMinutes;
  const { getLastInteraction, markInteraction } = ctx;

  useFocusEffect(
    useCallback(() => {
      const startedAt = Date.now();
      let lastTick = startedAt;
      let pendingMs = 0;
      let sessionDay = dayKey(new Date());
      markInteraction(); // opening a learning screen is itself an interaction

      const tick = (foreground = AppState.currentState === 'active') => {
        const now = Date.now();
        pendingMs += activeMsForTick({ lastTickAt: lastTick, now, lastInteractionAt: getLastInteraction(), foreground });
        lastTick = now;
      };

      const flush = async () => {
        const seconds = Math.floor(pendingMs / 1000);
        if (seconds <= 0) return;
        pendingMs -= seconds * 1000;
        const day = dayKey(new Date());
        if (day !== sessionDay) sessionDay = day; // a new row per day keeps daily totals exact
        await addStudySeconds(db, {
          sessionId: `${startedAt}-${activity}-${sessionDay}`,
          day: sessionDay,
          activity,
          contentId,
          startedAt,
          seconds,
        });
        if ((await secondsOnDay(db, sessionDay)) >= goalMinutes * 60) {
          await awardXp(db, sessionDay, XP_RULES.dailyGoalMet, 'daily_goal', sessionDay);
        }
        await refresh();
      };

      const tickTimer = setInterval(() => tick(), TICK_MS);
      const flushTimer = setInterval(() => {
        tick();
        flush();
      }, FLUSH_MS);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          lastTick = Date.now(); // never credit time spent in the background
        } else {
          tick(true); // credit up to the moment we left
          flush();
        }
      });

      return () => {
        clearInterval(tickTimer);
        clearInterval(flushTimer);
        sub.remove();
        if (AppState.currentState === 'active') tick();
        flush();
      };
    }, [activity, contentId, db, goalMinutes, getLastInteraction, markInteraction, refresh]),
  );
}
