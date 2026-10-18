import { planLocalNotifications } from '@laas/shared';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { logNotificationTap } from '@/db/repo';
import { applyPlan, getPushToken, notificationsSupported, pushAvailability, safeRoute } from '@/lib/notifications';
import { useProgress } from './progress';
import { useSettings } from './settings';
import { useSync } from './sync';

const PUSH_TOKEN_KEY = 'push_token';

/**
 * Keeps scheduled local notifications in step with progress and settings, routes taps to the
 * right screen (logging the tap locally and, for server pushes, to the API), and registers the
 * device for opt-in server push topics. Renders nothing.
 */
export function NotificationManager() {
  if (!notificationsSupported) return null;
  return <Manager />;
}

function Manager() {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const { stats, streak, dueCards, next } = useProgress();
  const sync = useSync();
  const handled = useRef(new Set<string>());

  // ---- Local schedule: re-plan (debounced) whenever inputs change ----
  const dueCount = dueCards.length;
  const nextTitle = next?.title ?? null;
  useEffect(() => {
    const timer = setTimeout(() => {
      const plan = planLocalNotifications({ now: new Date(), prefs: settings, goalMinutes: settings.goalMinutes, stats, streak, dueCards: dueCount, nextLessonTitle: nextTitle });
      applyPlan(plan).catch(() => {
        // Scheduling failures must never break the app; the next change re-plans.
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [settings, stats, streak, dueCount, nextTitle]);

  // ---- Taps (cold start and while running) ----
  const response = Notifications.useLastNotificationResponse();
  const { session, call } = sync;
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const req = response.notification.request;
    if (handled.current.has(req.identifier)) return;
    handled.current.add(req.identifier);
    const data = (req.content.data ?? {}) as { url?: unknown; type?: unknown; notificationId?: unknown };
    const serverId = typeof data.notificationId === 'string' ? data.notificationId : null;
    logNotificationTap(db, serverId ?? req.identifier, typeof data.type === 'string' ? data.type : serverId ? 'push' : 'local').catch(() => {});
    if (serverId && session) call(`/v1/notifications/${serverId}/tapped`, { method: 'POST' }).catch(() => {});
    const url = safeRoute(data.url);
    if (url) router.push(url as never);
  }, [response, db, session, call]);

  // ---- Server push registration for opt-in topics ----
  const topics = [settings.advisoriesPush && 'advisories', settings.contentPush && 'content'].filter(Boolean).join(',');
  useEffect(() => {
    if (!session || !pushAvailability().available) return;
    (async () => {
      const stored = (await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', PUSH_TOKEN_KEY))?.value ?? null;
      if (!topics) {
        if (stored) {
          await call(`/v1/devices/${encodeURIComponent(stored)}`, { method: 'DELETE' });
          await db.runAsync('DELETE FROM kv WHERE key = ?', PUSH_TOKEN_KEY);
        }
        return;
      }
      const token = await getPushToken();
      if (!token) return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      await call('/v1/devices', { method: 'PUT', body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android', topics: topics.split(','), timezone } });
      await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', PUSH_TOKEN_KEY, token);
    })().catch(() => {
      // Offline or push unavailable: retried on the next settings or session change.
    });
  }, [session, topics, db, call]);

  return null;
}
