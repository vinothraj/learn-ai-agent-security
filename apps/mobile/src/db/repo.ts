import { emptyDay, type ActivityType, type DailyStat } from '@laas/shared';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface LessonStatus {
  lessonId: string;
  status: 'in_progress' | 'completed';
  step: number;
  bestScore: number | null;
  updatedAt: number;
}

export async function getLessonStatuses(db: SQLiteDatabase): Promise<LessonStatus[]> {
  return db.getAllAsync<LessonStatus>(
    `SELECT lesson_id AS lessonId, status, step, best_score AS bestScore, updated_at AS updatedAt
     FROM lesson_progress ORDER BY updated_at DESC`,
  );
}

export async function saveLessonStep(db: SQLiteDatabase, lessonId: string, step: number) {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO lesson_progress (lesson_id, status, step, started_at, updated_at)
     VALUES (?, 'in_progress', ?, ?, ?)
     ON CONFLICT(lesson_id) DO UPDATE SET
       step = CASE WHEN status = 'completed' THEN step ELSE excluded.step END,
       updated_at = excluded.updated_at`,
    lessonId,
    step,
    now,
    now,
  );
}

/** Marks a lesson complete. Returns true only on the first completion (XP is awarded once). */
export async function completeLesson(
  db: SQLiteDatabase,
  lessonId: string,
  scorePct: number,
  day: string,
): Promise<boolean> {
  const now = Date.now();
  const prev = await db.getFirstAsync<{ status: string }>(
    'SELECT status FROM lesson_progress WHERE lesson_id = ?',
    lessonId,
  );
  await db.runAsync(
    `INSERT INTO lesson_progress (lesson_id, status, step, best_score, attempts, started_at, updated_at, completed_at, completed_day)
     VALUES (?, 'completed', 0, ?, 1, ?, ?, ?, ?)
     ON CONFLICT(lesson_id) DO UPDATE SET
       status = 'completed',
       step = 0,
       attempts = attempts + 1,
       best_score = MAX(COALESCE(best_score, 0), excluded.best_score),
       updated_at = excluded.updated_at,
       completed_at = COALESCE(completed_at, excluded.completed_at),
       completed_day = COALESCE(completed_day, excluded.completed_day)`,
    lessonId,
    scorePct,
    now,
    now,
    now,
    day,
  );
  return prev?.status !== 'completed';
}

export async function recordResponse(
  db: SQLiteDatabase,
  r: { questionId: string; lessonId: string; source: 'lesson' | 'quick_quiz'; correct: boolean; day: string },
) {
  await db.runAsync(
    `INSERT INTO question_responses (question_id, lesson_id, source, correct, day, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    r.questionId,
    r.lessonId,
    r.source,
    r.correct ? 1 : 0,
    r.day,
    Date.now(),
  );
}

/** Idempotent per (reason, ref): replays and double-taps never double-award XP. */
export async function awardXp(db: SQLiteDatabase, day: string, amount: number, reason: string, ref: string) {
  if (amount <= 0) return;
  await db.runAsync(
    'INSERT OR IGNORE INTO xp_ledger (day, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)',
    day,
    amount,
    reason,
    ref,
    Date.now(),
  );
}

export async function addStudySeconds(
  db: SQLiteDatabase,
  s: { sessionId: string; day: string; activity: ActivityType; contentId: string | null; startedAt: number; seconds: number },
) {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO study_sessions (id, day, activity, content_id, started_at, ended_at, active_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       active_seconds = active_seconds + excluded.active_seconds,
       ended_at = excluded.ended_at`,
    s.sessionId,
    s.day,
    s.activity,
    s.contentId,
    s.startedAt,
    now,
    s.seconds,
  );
}

export async function secondsOnDay(db: SQLiteDatabase, day: string): Promise<number> {
  const row = await db.getFirstAsync<{ s: number | null }>(
    'SELECT SUM(active_seconds) AS s FROM study_sessions WHERE day = ?',
    day,
  );
  return row?.s ?? 0;
}

/** All-time per-day rollup. Small: one row per active day. */
export async function loadDailyStats(db: SQLiteDatabase): Promise<Map<string, DailyStat>> {
  const map = new Map<string, DailyStat>();
  const get = (day: string) => {
    let d = map.get(day);
    if (!d) map.set(day, (d = emptyDay(day)));
    return d;
  };

  const time = await db.getAllAsync<{ day: string; activity: ActivityType; s: number }>(
    'SELECT day, activity, SUM(active_seconds) AS s FROM study_sessions GROUP BY day, activity',
  );
  for (const r of time) {
    const d = get(r.day);
    d.activeSeconds += r.s;
    d.byActivity[r.activity] = (d.byActivity[r.activity] ?? 0) + r.s;
  }

  const lessons = await db.getAllAsync<{ day: string; n: number }>(
    `SELECT completed_day AS day, COUNT(*) AS n FROM lesson_progress
     WHERE completed_day IS NOT NULL GROUP BY completed_day`,
  );
  for (const r of lessons) get(r.day).lessonsCompleted = r.n;

  const qs = await db.getAllAsync<{ day: string; n: number; c: number }>(
    'SELECT day, COUNT(*) AS n, SUM(correct) AS c FROM question_responses GROUP BY day',
  );
  for (const r of qs) {
    const d = get(r.day);
    d.questionsAnswered = r.n;
    d.questionsCorrect = r.c;
  }

  const xp = await db.getAllAsync<{ day: string; xp: number }>(
    'SELECT day, SUM(amount) AS xp FROM xp_ledger GROUP BY day',
  );
  for (const r of xp) get(r.day).xp = r.xp;

  return map;
}

export async function resetAllProgress(db: SQLiteDatabase) {
  await db.execAsync(`
    DELETE FROM lesson_progress;
    DELETE FROM question_responses;
    DELETE FROM study_sessions;
    DELETE FROM xp_ledger;
  `);
}
