import { minutes } from '@laas/shared';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { pushWidgetSnapshot } from '@/widget';
import { SNAPSHOT_KEY, type WidgetSnapshot } from '@/widget/snapshot';
import { useProgress } from './progress';
import { useSettings } from './settings';

/** Keeps the Android home-screen widget in step with progress. Renders nothing. */
export function WidgetSync() {
  if (Platform.OS !== 'android') return null;
  return <Sync />;
}

function Sync() {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const { today, stats, streak, dueCards, next } = useProgress();
  const snapshot: WidgetSnapshot = {
    streak: streak.current,
    todayMinutes: minutes(stats.get(today)?.activeSeconds ?? 0),
    goalMinutes: settings.goalMinutes,
    dueCards: dueCards.length,
    nextLesson: next?.title ?? null,
    day: today,
  };
  const json = JSON.stringify(snapshot);

  useEffect(() => {
    const timer = setTimeout(() => {
      db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', SNAPSHOT_KEY, json)
        .then(() => pushWidgetSnapshot(JSON.parse(json) as WidgetSnapshot))
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [db, json]);

  return null;
}
