import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Ordered, append-only migrations. Never edit a released migration; add a new one.
 * PRAGMA user_version tracks how many have been applied.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lesson_progress (
    lesson_id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
    step INTEGER NOT NULL DEFAULT 0,
    best_score INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    completed_day TEXT
  );

  CREATE TABLE IF NOT EXISTS question_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('lesson', 'quick_quiz')),
    correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
    day TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_responses_day ON question_responses(day);
  CREATE INDEX IF NOT EXISTS idx_responses_question ON question_responses(question_id);

  CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    day TEXT NOT NULL,
    activity TEXT NOT NULL,
    content_id TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    active_seconds INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_day ON study_sessions(day);

  CREATE TABLE IF NOT EXISTS xp_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (reason, ref)
  );
  CREATE INDEX IF NOT EXISTS idx_xp_day ON xp_ledger(day);
  `,
];

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync(`PRAGMA journal_mode = 'wal'; PRAGMA foreign_keys = ON;`);
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version]!;
    const target = version + 1;
    // Schema change and version bump commit together, so a crash can't half-apply a migration.
    // Runs before any other query (SQLiteProvider onInit), so a non-exclusive transaction is safe
    // and also works in the web preview, which lacks exclusive transactions.
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${target}`);
    });
    version = target;
  }
}
