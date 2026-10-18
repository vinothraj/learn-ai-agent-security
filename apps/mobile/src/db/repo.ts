import {
  deserializeCard,
  emptyDay,
  newCard,
  serializeCard,
  type ActivityType,
  type Card,
  type DailyStat,
  type Evidence,
} from '@laas/shared';
import type { SQLiteDatabase } from 'expo-sqlite';

let txQueue: Promise<unknown> = Promise.resolve();

/**
 * expo-sqlite transactions are not exclusive: a second BEGIN while one is open fails with
 * "cannot start a transaction within a transaction". Queue ours so they never overlap.
 */
export function inTransaction(db: SQLiteDatabase, task: () => Promise<void>): Promise<void> {
  const run = txQueue.then(() => db.withTransactionAsync(task));
  txQueue = run.catch(() => undefined);
  return run;
}

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
/** Returns the XP actually granted (0 if this reason/ref was already awarded). */
export async function awardXp(db: SQLiteDatabase, day: string, amount: number, reason: string, ref: string): Promise<number> {
  if (amount <= 0) return 0;
  const res = await db.runAsync(
    'INSERT OR IGNORE INTO xp_ledger (day, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)',
    day,
    amount,
    reason,
    ref,
    Date.now(),
  );
  return res.changes > 0 ? amount : 0;
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

  const rounds = await db.getAllAsync<{ day: string; n: number; c: number }>(
    'SELECT day, COUNT(*) AS n, SUM(correct) AS c FROM game_rounds GROUP BY day',
  );
  for (const r of rounds) {
    const d = get(r.day);
    d.gameRounds = r.n;
    d.gameCorrect = r.c;
  }

  const reviews = await db.getAllAsync<{ day: string; n: number }>(
    'SELECT day, COUNT(*) AS n FROM card_reviews GROUP BY day',
  );
  for (const r of reviews) get(r.day).cardsReviewed = r.n;

  const labs = await db.getAllAsync<{ day: string; runs: number; passed: number }>(
    'SELECT day, SUM(runs) AS runs, SUM(passed) AS passed FROM lab_attempts GROUP BY day',
  );
  for (const r of labs) {
    const d = get(r.day);
    d.labRuns = r.runs;
    d.labsPassed = r.passed;
  }

  const answers = await db.getAllAsync<{ day: string; n: number }>(
    'SELECT day, COUNT(*) AS n FROM interview_answers GROUP BY day',
  );
  for (const r of answers) get(r.day).interviewAnswers = r.n;

  return map;
}

// ---- Flashcards (FSRS) ----

export interface StoredCard {
  cardId: string;
  lessonId: string;
  due: number;
  card: Card;
}

/**
 * Adds any missing cards for the given lessons in one statement (atomic, no transaction needed,
 * so it is safe when several progress refreshes overlap). Existing schedules are untouched.
 */
export async function ensureCards(db: SQLiteDatabase, cards: readonly { id: string; lessonId: string }[]) {
  if (cards.length === 0) return;
  const now = Date.now();
  const json = serializeCard(newCard(new Date(now)));
  const params = cards.flatMap((c) => [c.id, c.lessonId, now, json, now, now]);
  await db.runAsync(
    `INSERT OR IGNORE INTO fsrs_cards (card_id, lesson_id, due, data, created_at, updated_at)
     VALUES ${cards.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`,
    params,
  );
}

export async function getCards(db: SQLiteDatabase): Promise<StoredCard[]> {
  const rows = await db.getAllAsync<{ card_id: string; lesson_id: string; due: number; data: string }>(
    'SELECT card_id, lesson_id, due, data FROM fsrs_cards ORDER BY due ASC',
  );
  return rows.map((r) => ({ cardId: r.card_id, lessonId: r.lesson_id, due: r.due, card: deserializeCard(r.data) }));
}

export async function saveReview(
  db: SQLiteDatabase,
  r: { cardId: string; lessonId: string; card: Card; rating: number; day: string },
) {
  const now = Date.now();
  await inTransaction(db, async () => {
    await db.runAsync(
      'UPDATE fsrs_cards SET due = ?, data = ?, updated_at = ? WHERE card_id = ?',
      r.card.due.getTime(),
      serializeCard(r.card),
      now,
      r.cardId,
    );
    await db.runAsync(
      'INSERT INTO card_reviews (card_id, lesson_id, rating, day, created_at) VALUES (?, ?, ?, ?, ?)',
      r.cardId,
      r.lessonId,
      r.rating,
      r.day,
      now,
    );
  });
}

// ---- Games and daily challenge ----

export async function recordGameRound(
  db: SQLiteDatabase,
  r: { sessionId: string; gameId: string; roundId: string; lessonId: string | null; correct: boolean; daily: boolean; day: string },
) {
  await db.runAsync(
    `INSERT INTO game_rounds (session_id, game_id, round_id, lesson_id, correct, daily, day, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    r.sessionId,
    r.gameId,
    r.roundId,
    r.lessonId,
    r.correct ? 1 : 0,
    r.daily ? 1 : 0,
    r.day,
    Date.now(),
  );
}

export interface DailyChallengeResult {
  day: string;
  gameId: string;
  correct: number;
  total: number;
}

/** The first completion of the day is the one that counts; replays don't overwrite it. */
export async function completeDailyChallenge(db: SQLiteDatabase, r: DailyChallengeResult): Promise<boolean> {
  const res = await db.runAsync(
    'INSERT OR IGNORE INTO daily_challenges (day, game_id, correct, total, completed_at) VALUES (?, ?, ?, ?, ?)',
    r.day,
    r.gameId,
    r.correct,
    r.total,
    Date.now(),
  );
  return res.changes > 0;
}

export async function getDailyChallenge(db: SQLiteDatabase, day: string): Promise<DailyChallengeResult | null> {
  return db.getFirstAsync<DailyChallengeResult>(
    'SELECT day, game_id AS gameId, correct, total FROM daily_challenges WHERE day = ?',
    day,
  );
}

// ---- Analytics inputs (all local) ----

/** Quiz and game answers linked to a lesson: the evidence behind mastery scores. */
export async function loadEvidence(db: SQLiteDatabase): Promise<Evidence[]> {
  const rows = await db.getAllAsync<{ lesson_id: string; correct: number; created_at: number }>(
    `SELECT lesson_id, correct, created_at FROM question_responses
     UNION ALL
     SELECT lesson_id, correct, created_at FROM game_rounds WHERE lesson_id IS NOT NULL
     UNION ALL
     SELECT lesson_id, passed AS correct, completed_at AS created_at FROM lab_attempts WHERE lesson_id IS NOT NULL
     UNION ALL
     SELECT lesson_id, CASE WHEN coverage >= 60 THEN 1 ELSE 0 END AS correct, created_at FROM interview_answers WHERE lesson_id IS NOT NULL`,
  );
  return rows.map((r) => ({ lessonId: r.lesson_id, correct: r.correct === 1, at: r.created_at }));
}

export async function loadSessions(db: SQLiteDatabase): Promise<{ startedAt: number; seconds: number }[]> {
  return db.getAllAsync<{ startedAt: number; seconds: number }>(
    'SELECT started_at AS startedAt, active_seconds AS seconds FROM study_sessions WHERE active_seconds > 0',
  );
}

export async function loadCounters(db: SQLiteDatabase) {
  const one = async (sql: string) => (await db.getFirstAsync<{ n: number }>(sql))?.n ?? 0;
  return {
    perfectLessons: await one('SELECT COUNT(*) AS n FROM lesson_progress WHERE best_score = 100'),
    distinctGamesPlayed: await one('SELECT COUNT(DISTINCT game_id) AS n FROM game_rounds'),
    dailyChallenges: await one('SELECT COUNT(*) AS n FROM daily_challenges'),
    labsPassed: await one('SELECT COUNT(DISTINCT lab_id) AS n FROM lab_attempts WHERE passed = 1'),
    mocksCompleted: await one('SELECT COUNT(*) AS n FROM mock_sessions WHERE answered > 0'),
    bestMockScore: await one('SELECT COALESCE(MAX(score), 0) AS n FROM mock_sessions'),
    playedGames: (await db.getAllAsync<{ game_id: string }>('SELECT DISTINCT game_id FROM game_rounds')).map((r) => r.game_id),
  };
}

export async function resetAllProgress(db: SQLiteDatabase) {
  await db.execAsync(`
    DELETE FROM lesson_progress;
    DELETE FROM question_responses;
    DELETE FROM study_sessions;
    DELETE FROM xp_ledger;
    DELETE FROM fsrs_cards;
    DELETE FROM card_reviews;
    DELETE FROM game_rounds;
    DELETE FROM daily_challenges;
    DELETE FROM lab_attempts;
    DELETE FROM interview_answers;
    DELETE FROM mock_sessions;
    DELETE FROM interview_bookmarks;
  `);
}

// ---- Security labs ----

export interface LabAttemptInput {
  id: string;
  labId: string;
  lessonId: string | null;
  day: string;
  startedAt: number;
  passed: boolean;
  stars: number;
  runs: number;
  controls: string[];
}

export async function saveLabAttempt(db: SQLiteDatabase, a: LabAttemptInput) {
  await db.runAsync(
    `INSERT OR REPLACE INTO lab_attempts (id, lab_id, lesson_id, day, started_at, completed_at, passed, stars, runs, controls)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    a.id,
    a.labId,
    a.lessonId,
    a.day,
    a.startedAt,
    Date.now(),
    a.passed ? 1 : 0,
    a.stars,
    a.runs,
    JSON.stringify(a.controls),
  );
}

export interface LabBest {
  labId: string;
  stars: number;
  passed: boolean;
  attempts: number;
}

/** Best result per lab (for list badges and recommendations). */
export async function loadLabBests(db: SQLiteDatabase): Promise<Map<string, LabBest>> {
  const rows = await db.getAllAsync<{ lab_id: string; stars: number; passed: number; attempts: number }>(
    `SELECT lab_id, MAX(stars) AS stars, MAX(passed) AS passed, COUNT(*) AS attempts
     FROM lab_attempts GROUP BY lab_id`,
  );
  return new Map(rows.map((r) => [r.lab_id, { labId: r.lab_id, stars: r.stars, passed: r.passed === 1, attempts: r.attempts }]));
}

// ---- Interview practice ----

export interface InterviewAnswerInput {
  questionId: string;
  lessonId: string | null;
  topic: string;
  mode: 'practice' | 'mock';
  sessionId: string | null;
  answer: string;
  coverage: number;
  day: string;
}

/** Returns the row id so a self-rating can be attached afterwards. */
export async function saveInterviewAnswer(db: SQLiteDatabase, a: InterviewAnswerInput): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO interview_answers (question_id, lesson_id, topic, mode, session_id, answer, coverage, day, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    a.questionId,
    a.lessonId,
    a.topic,
    a.mode,
    a.sessionId,
    a.answer,
    a.coverage,
    a.day,
    Date.now(),
  );
  return res.lastInsertRowId;
}

export async function rateInterviewAnswer(db: SQLiteDatabase, answerId: number, rating: number) {
  await db.runAsync('UPDATE interview_answers SET self_rating = ? WHERE id = ?', rating, answerId);
}

export interface QuestionStat {
  questionId: string;
  best: number;
  attempts: number;
}

export async function loadQuestionStats(db: SQLiteDatabase): Promise<Map<string, QuestionStat>> {
  const rows = await db.getAllAsync<{ question_id: string; best: number; attempts: number }>(
    'SELECT question_id, MAX(coverage) AS best, COUNT(*) AS attempts FROM interview_answers GROUP BY question_id',
  );
  return new Map(rows.map((r) => [r.question_id, { questionId: r.question_id, best: r.best, attempts: r.attempts }]));
}

export interface MockSessionInput {
  id: string;
  roleId: string;
  minutes: number;
  questions: number;
  answered: number;
  score: number;
  byTopic: { topic: string; score: number; count: number }[];
  day: string;
  startedAt: number;
}

export async function saveMockSession(db: SQLiteDatabase, m: MockSessionInput) {
  await db.runAsync(
    `INSERT OR REPLACE INTO mock_sessions (id, role_id, minutes, questions, answered, score, by_topic, day, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    m.id,
    m.roleId,
    m.minutes,
    m.questions,
    m.answered,
    m.score,
    JSON.stringify(m.byTopic),
    m.day,
    m.startedAt,
    Date.now(),
  );
}

export interface MockSummary {
  id: string;
  roleId: string;
  minutes: number;
  score: number;
  answered: number;
  questions: number;
  completedAt: number;
}

export async function loadMocks(db: SQLiteDatabase, limit = 10): Promise<MockSummary[]> {
  return db.getAllAsync<MockSummary>(
    `SELECT id, role_id AS roleId, minutes, score, answered, questions, completed_at AS completedAt
     FROM mock_sessions ORDER BY completed_at DESC LIMIT ?`,
    limit,
  );
}

export async function loadBookmarks(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ question_id: string }>('SELECT question_id FROM interview_bookmarks');
  return new Set(rows.map((r) => r.question_id));
}

export async function setBookmark(db: SQLiteDatabase, questionId: string, on: boolean) {
  if (on) {
    await db.runAsync('INSERT OR IGNORE INTO interview_bookmarks (question_id, created_at) VALUES (?, ?)', questionId, Date.now());
  } else {
    await db.runAsync('DELETE FROM interview_bookmarks WHERE question_id = ?', questionId);
  }
}
