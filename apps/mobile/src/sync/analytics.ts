import { MAX_EVENTS_PER_BATCH, type AnalyticsEvent } from '@laas/shared';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Opt-in usage statistics. While opted in, SQLite triggers (migration v7) queue structured events;
 * they are uploaded with sync and removed locally once accepted. Opting out stops collection,
 * clears the queue and deletes what was already shared.
 */

const OPT_IN_KEY = 'analytics_opt_in';
type Call = <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

export async function isOptedIn(db: SQLiteDatabase): Promise<boolean> {
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', OPT_IN_KEY))?.value === '1';
}

/** Queues existing history once, so retention and completion reflect past activity too. */
async function backfill(db: SQLiteDatabase) {
  const localDay = (col: string) => `date(${col} / 1000, 'unixepoch', 'localtime')`;
  await db.execAsync(`
    INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day)
      SELECT 'ad:' || day, 'active_day', '', SUM(active_seconds), day FROM study_sessions GROUP BY day HAVING SUM(active_seconds) > 0;
    INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day)
      SELECT 'ls:' || lesson_id, 'lesson_started', lesson_id, NULL, ${localDay('started_at')} FROM lesson_progress;
    INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day)
      SELECT 'lc:' || lesson_id, 'lesson_completed', lesson_id, NULL, COALESCE(completed_day, ${localDay('updated_at')}) FROM lesson_progress WHERE status = 'completed';
    INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day)
      SELECT 'qf:' || lesson_id, 'quiz_first_attempt', lesson_id, best_score, COALESCE(completed_day, ${localDay('updated_at')})
      FROM lesson_progress WHERE status = 'completed' AND best_score IS NOT NULL;
    INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day)
      SELECT 'lb:' || content_id, 'lab_started', content_id, NULL, MIN(day) FROM study_sessions WHERE activity = 'lab' AND content_id IS NOT NULL GROUP BY content_id;
    INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day)
      SELECT 'lr:' || lab_id, 'lab_result', lab_id, passed, MIN(day) FROM lab_attempts GROUP BY lab_id;
  `);
}

export async function setOptIn(db: SQLiteDatabase, on: boolean, call: Call | null) {
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', OPT_IN_KEY, on ? '1' : '0');
  if (on) {
    await backfill(db);
    if (call) await uploadAnalytics(db, call);
    return;
  }
  await db.runAsync('DELETE FROM analytics_queue');
  if (call) await call('/v1/me/analytics', { method: 'DELETE' });
}

/** Uploads queued events in batches. A row updated during the upload stays queued for next time. */
export async function uploadAnalytics(db: SQLiteDatabase, call: Call): Promise<number> {
  if (!(await isOptedIn(db))) return 0;
  let sent = 0;
  for (let round = 0; round < 10; round++) {
    const rows = await db.getAllAsync<AnalyticsEvent>('SELECT key, type, subject, value, day FROM analytics_queue ORDER BY day LIMIT ?', MAX_EVENTS_PER_BATCH);
    if (!rows.length) break;
    await call('/v1/events', { method: 'POST', body: { events: rows } });
    for (const r of rows) await db.runAsync('DELETE FROM analytics_queue WHERE key = ? AND value IS ?', r.key, r.value);
    sent += rows.length;
    if (rows.length < MAX_EVENTS_PER_BATCH) break;
  }
  return sent;
}
