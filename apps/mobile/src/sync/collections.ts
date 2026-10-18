import type { SyncCollection } from '@laas/shared';
import type { SQLiteDatabase } from 'expo-sqlite';

type Data = Record<string, unknown>;

/**
 * Per-collection adapters between local SQLite rows and sync envelope data.
 * `read` returns null when the record does not exist locally. `write` receives the MERGED data.
 * Keys here must match the outbox trigger key expressions in db/migrations.ts.
 */
export interface Adapter {
  read(db: SQLiteDatabase, key: string): Promise<{ data: Data; time: number } | null>;
  write(db: SQLiteDatabase, key: string, data: Data | null): Promise<void>;
  /** SQL that lists every local key, used to enqueue existing data on first sign-in. */
  allKeys: string;
}

const b = (v: unknown) => (v ? 1 : 0);
const splitFirst = (s: string): [string, string] => {
  const i = s.indexOf(':');
  return [s.slice(0, i), s.slice(i + 1)];
};

const PROFILE_FIELDS = ['displayName', 'goalMinutes', 'focusRoadmapId', 'targetRole', 'gamification'] as const;

export const ADAPTERS: Record<SyncCollection, Adapter> = {
  lesson_progress: {
    allKeys: 'SELECT lesson_id AS key FROM lesson_progress',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM lesson_progress WHERE lesson_id = ?', key);
      if (!r) return null;
      return {
        time: r.updated_at as number,
        data: {
          lessonId: r.lesson_id,
          status: r.status,
          step: r.step,
          bestScore: r.best_score ?? null,
          attempts: r.attempts,
          startedAt: r.started_at,
          updatedAt: r.updated_at,
          completedAt: r.completed_at ?? null,
          completedDay: r.completed_day ?? null,
        },
      };
    },
    async write(db, _key, d) {
      if (!d) return;
      await db.runAsync(
        `INSERT OR REPLACE INTO lesson_progress (lesson_id, status, step, best_score, attempts, started_at, updated_at, completed_at, completed_day)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        d.lessonId as string,
        d.status as string,
        d.step as number,
        d.bestScore as number | null,
        d.attempts as number,
        d.startedAt as number,
        d.updatedAt as number,
        d.completedAt as number | null,
        d.completedDay as string | null,
      );
    },
  },
  question_responses: {
    allKeys: 'SELECT sync_id AS key FROM question_responses',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM question_responses WHERE sync_id = ?', key);
      if (!r) return null;
      return {
        time: r.created_at as number,
        data: { questionId: r.question_id, lessonId: r.lesson_id, source: r.source, correct: r.correct === 1, day: r.day, createdAt: r.created_at },
      };
    },
    async write(db, key, d) {
      if (!d) return;
      await db.runAsync(
        `INSERT OR IGNORE INTO question_responses (question_id, lesson_id, source, correct, day, created_at, sync_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        d.questionId as string,
        d.lessonId as string,
        d.source as string,
        b(d.correct),
        d.day as string,
        d.createdAt as number,
        key,
      );
    },
  },
  study_sessions: {
    allKeys: 'SELECT id AS key FROM study_sessions',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM study_sessions WHERE id = ?', key);
      if (!r) return null;
      return {
        time: r.ended_at as number,
        data: { day: r.day, activity: r.activity, contentId: r.content_id ?? null, startedAt: r.started_at, endedAt: r.ended_at, activeSeconds: r.active_seconds },
      };
    },
    async write(db, key, d) {
      if (!d) return;
      await db.runAsync(
        `INSERT INTO study_sessions (id, day, activity, content_id, started_at, ended_at, active_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET ended_at = excluded.ended_at, active_seconds = excluded.active_seconds`,
        key,
        d.day as string,
        d.activity as string,
        d.contentId as string | null,
        d.startedAt as number,
        d.endedAt as number,
        d.activeSeconds as number,
      );
    },
  },
  xp_ledger: {
    allKeys: "SELECT reason || ':' || ref AS key FROM xp_ledger",
    async read(db, key) {
      const [reason, ref] = splitFirst(key);
      const r = await db.getFirstAsync<Data>('SELECT * FROM xp_ledger WHERE reason = ? AND ref = ?', reason, ref);
      if (!r) return null;
      return { time: r.created_at as number, data: { day: r.day, amount: r.amount, reason: r.reason, ref: r.ref, createdAt: r.created_at } };
    },
    async write(db, _key, d) {
      if (!d) return;
      await db.runAsync(
        'INSERT OR IGNORE INTO xp_ledger (day, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)',
        d.day as string,
        d.amount as number,
        d.reason as string,
        d.ref as string,
        d.createdAt as number,
      );
    },
  },
  fsrs_cards: {
    allKeys: 'SELECT card_id AS key FROM fsrs_cards',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM fsrs_cards WHERE card_id = ?', key);
      if (!r) return null;
      return { time: r.updated_at as number, data: { cardId: r.card_id, lessonId: r.lesson_id, due: r.due, data: r.data, updatedAt: r.updated_at } };
    },
    async write(db, _key, d) {
      if (!d) return;
      await db.runAsync(
        `INSERT INTO fsrs_cards (card_id, lesson_id, due, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(card_id) DO UPDATE SET due = excluded.due, data = excluded.data, updated_at = excluded.updated_at`,
        d.cardId as string,
        d.lessonId as string,
        d.due as number,
        d.data as string,
        d.updatedAt as number,
        d.updatedAt as number,
      );
    },
  },
  card_reviews: {
    allKeys: 'SELECT sync_id AS key FROM card_reviews',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM card_reviews WHERE sync_id = ?', key);
      if (!r) return null;
      return { time: r.created_at as number, data: { cardId: r.card_id, lessonId: r.lesson_id, rating: r.rating, day: r.day, createdAt: r.created_at } };
    },
    async write(db, key, d) {
      if (!d) return;
      await db.runAsync(
        'INSERT OR IGNORE INTO card_reviews (card_id, lesson_id, rating, day, created_at, sync_id) VALUES (?, ?, ?, ?, ?, ?)',
        d.cardId as string,
        d.lessonId as string,
        d.rating as number,
        d.day as string,
        d.createdAt as number,
        key,
      );
    },
  },
  game_rounds: {
    allKeys: 'SELECT sync_id AS key FROM game_rounds',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM game_rounds WHERE sync_id = ?', key);
      if (!r) return null;
      return {
        time: r.created_at as number,
        data: {
          sessionId: r.session_id,
          gameId: r.game_id,
          roundId: r.round_id,
          lessonId: r.lesson_id ?? null,
          correct: r.correct === 1,
          daily: r.daily === 1,
          day: r.day,
          createdAt: r.created_at,
        },
      };
    },
    async write(db, key, d) {
      if (!d) return;
      await db.runAsync(
        `INSERT OR IGNORE INTO game_rounds (session_id, game_id, round_id, lesson_id, correct, daily, day, created_at, sync_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        d.sessionId as string,
        d.gameId as string,
        d.roundId as string,
        d.lessonId as string | null,
        b(d.correct),
        b(d.daily),
        d.day as string,
        d.createdAt as number,
        key,
      );
    },
  },
  daily_challenges: {
    allKeys: 'SELECT day AS key FROM daily_challenges',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM daily_challenges WHERE day = ?', key);
      if (!r) return null;
      return { time: r.completed_at as number, data: { day: r.day, gameId: r.game_id, correct: r.correct, total: r.total, completedAt: r.completed_at } };
    },
    async write(db, _key, d) {
      if (!d) return;
      await db.runAsync(
        'INSERT OR REPLACE INTO daily_challenges (day, game_id, correct, total, completed_at) VALUES (?, ?, ?, ?, ?)',
        d.day as string,
        d.gameId as string,
        d.correct as number,
        d.total as number,
        d.completedAt as number,
      );
    },
  },
  lab_attempts: {
    allKeys: 'SELECT id AS key FROM lab_attempts',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM lab_attempts WHERE id = ?', key);
      if (!r) return null;
      return {
        time: r.completed_at as number,
        data: {
          labId: r.lab_id,
          lessonId: r.lesson_id ?? null,
          day: r.day,
          startedAt: r.started_at,
          completedAt: r.completed_at,
          passed: r.passed === 1,
          stars: r.stars,
          runs: r.runs,
          controls: JSON.parse(r.controls as string) as string[],
        },
      };
    },
    async write(db, key, d) {
      if (!d) return;
      await db.runAsync(
        `INSERT OR IGNORE INTO lab_attempts (id, lab_id, lesson_id, day, started_at, completed_at, passed, stars, runs, controls) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        key,
        d.labId as string,
        d.lessonId as string | null,
        d.day as string,
        d.startedAt as number,
        d.completedAt as number,
        b(d.passed),
        d.stars as number,
        d.runs as number,
        JSON.stringify(d.controls),
      );
    },
  },
  interview_answers: {
    allKeys: 'SELECT sync_id AS key FROM interview_answers',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM interview_answers WHERE sync_id = ?', key);
      if (!r) return null;
      return {
        time: r.created_at as number,
        data: {
          questionId: r.question_id,
          lessonId: r.lesson_id ?? null,
          topic: r.topic,
          mode: r.mode,
          sessionId: r.session_id ?? null,
          answer: r.answer,
          coverage: r.coverage,
          selfRating: r.self_rating ?? null,
          day: r.day,
          createdAt: r.created_at,
        },
      };
    },
    async write(db, key, d) {
      if (!d) return;
      await db.runAsync(
        `INSERT INTO interview_answers (question_id, lesson_id, topic, mode, session_id, answer, coverage, self_rating, day, created_at, sync_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(sync_id) DO UPDATE SET self_rating = excluded.self_rating`,
        d.questionId as string,
        d.lessonId as string | null,
        d.topic as string,
        d.mode as string,
        d.sessionId as string | null,
        d.answer as string,
        d.coverage as number,
        d.selfRating as number | null,
        d.day as string,
        d.createdAt as number,
        key,
      );
    },
  },
  mock_sessions: {
    allKeys: 'SELECT id AS key FROM mock_sessions',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM mock_sessions WHERE id = ?', key);
      if (!r) return null;
      return {
        time: r.completed_at as number,
        data: {
          roleId: r.role_id,
          minutes: r.minutes,
          questions: r.questions,
          answered: r.answered,
          score: r.score,
          byTopic: JSON.parse(r.by_topic as string),
          day: r.day,
          startedAt: r.started_at,
          completedAt: r.completed_at,
        },
      };
    },
    async write(db, key, d) {
      if (!d) return;
      await db.runAsync(
        `INSERT OR IGNORE INTO mock_sessions (id, role_id, minutes, questions, answered, score, by_topic, day, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        key,
        d.roleId as string,
        d.minutes as number,
        d.questions as number,
        d.answered as number,
        d.score as number,
        JSON.stringify(d.byTopic),
        d.day as string,
        d.startedAt as number,
        d.completedAt as number,
      );
    },
  },
  interview_bookmarks: {
    allKeys: 'SELECT question_id AS key FROM interview_bookmarks',
    async read(db, key) {
      const r = await db.getFirstAsync<Data>('SELECT * FROM interview_bookmarks WHERE question_id = ?', key);
      if (!r) return null;
      return { time: r.created_at as number, data: { questionId: r.question_id, createdAt: r.created_at } };
    },
    async write(db, key, d) {
      if (!d) {
        await db.runAsync('DELETE FROM interview_bookmarks WHERE question_id = ?', key);
        return;
      }
      await db.runAsync('INSERT OR REPLACE INTO interview_bookmarks (question_id, created_at) VALUES (?, ?)', key, d.createdAt as number);
    },
  },
  profile: {
    allKeys: "SELECT 'profile' AS key FROM kv WHERE key = 'settings'",
    async read(db) {
      const r = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = 'settings'");
      if (!r) return null;
      const s = JSON.parse(r.value) as Data;
      const data = Object.fromEntries(PROFILE_FIELDS.map((f) => [f, s[f]]));
      if (PROFILE_FIELDS.some((f) => data[f] === undefined)) return null; // defaults only, nothing to sync yet
      return { time: 0, data };
    },
    async write(db, _key, d) {
      if (!d) return;
      const r = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = 'settings'");
      const current = r ? (JSON.parse(r.value) as Data) : {};
      const next = { ...current, ...Object.fromEntries(PROFILE_FIELDS.map((f) => [f, d[f]])) };
      await db.runAsync(
        "INSERT INTO kv (key, value) VALUES ('settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        JSON.stringify(next),
      );
    },
  },
};
