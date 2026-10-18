import type { SQLiteDatabase } from 'expo-sqlite';

const NOT_APPLYING = 'NOT EXISTS (SELECT 1 FROM sync_applying)';
const NOW_MS = "CAST(strftime('%s','now') AS INTEGER) * 1000";
const DEVICE = "(SELECT value FROM kv WHERE key = 'device_id')";

/** One outbox trigger per table and operation; `keyExpr` must match the serializer's key. */
function outboxTrigger(name: string, table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', collection: string, keyExpr: string, when = '') {
  return `
  CREATE TRIGGER IF NOT EXISTS trg_${name}_${op.toLowerCase()} AFTER ${op} ON ${table}
  WHEN ${NOT_APPLYING}${when ? ` AND ${when}` : ''}
  BEGIN
    INSERT INTO outbox (collection, key, changed_at) VALUES ('${collection}', ${keyExpr}, ${NOW_MS})
    ON CONFLICT(collection, key) DO UPDATE SET changed_at = excluded.changed_at;
  END;`;
}

/** Locally created log rows get a globally unique id: <device>:<kind>:<rowid>. */
function syncIdTrigger(table: string, kind: string) {
  return `
  CREATE TRIGGER IF NOT EXISTS trg_${kind}_sync_id AFTER INSERT ON ${table}
  WHEN NEW.sync_id IS NULL
  BEGIN
    UPDATE ${table} SET sync_id = ${DEVICE} || ':${kind}:' || NEW.id WHERE id = NEW.id;
  END;`;
}

const deviceKey = (kind: string) => `${DEVICE} || ':${kind}:' || NEW.id`;
const oldOr = (expr: string) => expr.replace(/NEW\./g, 'OLD.');

export const SYNC_TRIGGERS = [
  outboxTrigger('lp', 'lesson_progress', 'INSERT', 'lesson_progress', 'NEW.lesson_id'),
  outboxTrigger('lp', 'lesson_progress', 'UPDATE', 'lesson_progress', 'NEW.lesson_id'),
  syncIdTrigger('question_responses', 'qr'),
  outboxTrigger('qr', 'question_responses', 'INSERT', 'question_responses', deviceKey('qr'), 'NEW.sync_id IS NULL'),
  outboxTrigger('ss', 'study_sessions', 'INSERT', 'study_sessions', 'NEW.id'),
  outboxTrigger('ss', 'study_sessions', 'UPDATE', 'study_sessions', 'NEW.id'),
  outboxTrigger('xp', 'xp_ledger', 'INSERT', 'xp_ledger', "NEW.reason || ':' || NEW.ref"),
  outboxTrigger('fc', 'fsrs_cards', 'INSERT', 'fsrs_cards', 'NEW.card_id'),
  outboxTrigger('fc', 'fsrs_cards', 'UPDATE', 'fsrs_cards', 'NEW.card_id'),
  syncIdTrigger('card_reviews', 'cr'),
  outboxTrigger('cr', 'card_reviews', 'INSERT', 'card_reviews', deviceKey('cr'), 'NEW.sync_id IS NULL'),
  syncIdTrigger('game_rounds', 'gr'),
  outboxTrigger('gr', 'game_rounds', 'INSERT', 'game_rounds', deviceKey('gr'), 'NEW.sync_id IS NULL'),
  outboxTrigger('dc', 'daily_challenges', 'INSERT', 'daily_challenges', 'NEW.day'),
  outboxTrigger('la', 'lab_attempts', 'INSERT', 'lab_attempts', 'NEW.id'),
  outboxTrigger('la', 'lab_attempts', 'UPDATE', 'lab_attempts', 'NEW.id'),
  syncIdTrigger('interview_answers', 'ia'),
  outboxTrigger('ia', 'interview_answers', 'INSERT', 'interview_answers', deviceKey('ia'), 'NEW.sync_id IS NULL'),
  outboxTrigger('ia', 'interview_answers', 'UPDATE', 'interview_answers', 'NEW.sync_id', 'NEW.sync_id IS NOT NULL AND OLD.sync_id IS NOT NULL'),
  outboxTrigger('ms', 'mock_sessions', 'INSERT', 'mock_sessions', 'NEW.id'),
  outboxTrigger('bm', 'interview_bookmarks', 'INSERT', 'interview_bookmarks', 'NEW.question_id'),
  outboxTrigger('bm', 'interview_bookmarks', 'DELETE', 'interview_bookmarks', oldOr('NEW.question_id')),
  outboxTrigger('pf', 'kv', 'INSERT', 'profile', "'profile'", "NEW.key = 'settings'"),
  outboxTrigger('pf', 'kv', 'UPDATE', 'profile', "'profile'", "NEW.key = 'settings'"),
].join('\n');

const OPTED_IN = "EXISTS (SELECT 1 FROM kv WHERE key = 'analytics_opt_in' AND value = '1')";
const LOCAL_DAY = (ms: string) => `date(${ms} / 1000, 'unixepoch', 'localtime')`;
const ACTIVE_DAY = `INSERT INTO analytics_queue (key, type, subject, value, day)
      VALUES ('ad:' || NEW.day, 'active_day', '', (SELECT SUM(active_seconds) FROM study_sessions WHERE day = NEW.day), NEW.day)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;`;
const COMPLETED = (when: string) => `INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day)
      SELECT 'lc:' || NEW.lesson_id, 'lesson_completed', NEW.lesson_id, NULL, COALESCE(NEW.completed_day, ${LOCAL_DAY('NEW.updated_at')}) WHERE ${when}
      UNION ALL
      SELECT 'qf:' || NEW.lesson_id, 'quiz_first_attempt', NEW.lesson_id, NEW.best_score, COALESCE(NEW.completed_day, ${LOCAL_DAY('NEW.updated_at')})
      WHERE ${when} AND NEW.best_score IS NOT NULL;`;

/** Structured events only (ids and numbers, never free text); see packages/shared/src/analytics.ts. */
export const ANALYTICS_TRIGGERS = `
  CREATE TRIGGER IF NOT EXISTS trg_an_ss_insert AFTER INSERT ON study_sessions WHEN ${OPTED_IN} AND NEW.active_seconds > 0
  BEGIN
    ${ACTIVE_DAY}
  END;
  CREATE TRIGGER IF NOT EXISTS trg_an_ss_update AFTER UPDATE ON study_sessions WHEN ${OPTED_IN} AND NEW.active_seconds > 0
  BEGIN
    ${ACTIVE_DAY}
  END;
  CREATE TRIGGER IF NOT EXISTS trg_an_lab_start AFTER INSERT ON study_sessions WHEN ${OPTED_IN} AND NEW.activity = 'lab' AND NEW.content_id IS NOT NULL
  BEGIN
    INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day) VALUES ('lb:' || NEW.content_id, 'lab_started', NEW.content_id, NULL, NEW.day);
  END;
  CREATE TRIGGER IF NOT EXISTS trg_an_lp_insert AFTER INSERT ON lesson_progress WHEN ${OPTED_IN}
  BEGIN
    INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day) VALUES ('ls:' || NEW.lesson_id, 'lesson_started', NEW.lesson_id, NULL, ${LOCAL_DAY('NEW.started_at')});
    ${COMPLETED("NEW.status = 'completed'")}
  END;
  CREATE TRIGGER IF NOT EXISTS trg_an_lp_complete AFTER UPDATE ON lesson_progress WHEN ${OPTED_IN} AND NEW.status = 'completed' AND OLD.status <> 'completed'
  BEGIN
    ${COMPLETED('1')}
  END;
  CREATE TRIGGER IF NOT EXISTS trg_an_lab_result AFTER INSERT ON lab_attempts WHEN ${OPTED_IN}
  BEGIN
    INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day) VALUES ('lr:' || NEW.lab_id, 'lab_result', NEW.lab_id, NEW.passed, NEW.day);
  END;
  CREATE TRIGGER IF NOT EXISTS trg_an_notif AFTER INSERT ON notification_log WHEN ${OPTED_IN}
  BEGIN
    INSERT OR IGNORE INTO analytics_queue (key, type, subject, value, day)
      VALUES ('nt:' || NEW.id, 'notification_tap', CASE WHEN NEW.type IN ('reminder', 'recap', 'weekly') THEN NEW.type ELSE 'push' END, NULL, ${LOCAL_DAY('NEW.at')});
  END;
`;

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
  // v2 (Phase 2): spaced repetition, mini-games, daily challenge
  `
  CREATE TABLE IF NOT EXISTS fsrs_cards (
    card_id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT NOT NULL,
    due INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cards_due ON fsrs_cards(due);

  CREATE TABLE IF NOT EXISTS card_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
    day TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_day ON card_reviews(day);

  CREATE TABLE IF NOT EXISTS game_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    round_id TEXT NOT NULL,
    lesson_id TEXT,
    correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
    daily INTEGER NOT NULL DEFAULT 0 CHECK (daily IN (0, 1)),
    day TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rounds_day ON game_rounds(day);

  CREATE TABLE IF NOT EXISTS daily_challenges (
    day TEXT PRIMARY KEY NOT NULL,
    game_id TEXT NOT NULL,
    correct INTEGER NOT NULL,
    total INTEGER NOT NULL,
    completed_at INTEGER NOT NULL
  );
  `,
  // v3 (Phase 3): simulated security labs
  `
  CREATE TABLE IF NOT EXISTS lab_attempts (
    id TEXT PRIMARY KEY NOT NULL,
    lab_id TEXT NOT NULL,
    lesson_id TEXT,
    day TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER NOT NULL,
    passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
    stars INTEGER NOT NULL CHECK (stars BETWEEN 0 AND 3),
    runs INTEGER NOT NULL DEFAULT 0,
    controls TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_lab_attempts_lab ON lab_attempts(lab_id);
  CREATE INDEX IF NOT EXISTS idx_lab_attempts_day ON lab_attempts(day);
  `,
  // v4 (Phase 4): interview practice and mock interviews (answers stay on this device)
  `
  CREATE TABLE IF NOT EXISTS interview_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT NOT NULL,
    lesson_id TEXT,
    topic TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('practice', 'mock')),
    session_id TEXT,
    answer TEXT NOT NULL,
    coverage INTEGER NOT NULL CHECK (coverage BETWEEN 0 AND 100),
    self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 4),
    day TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_answers_day ON interview_answers(day);
  CREATE INDEX IF NOT EXISTS idx_answers_question ON interview_answers(question_id);

  CREATE TABLE IF NOT EXISTS mock_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    role_id TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    questions INTEGER NOT NULL,
    answered INTEGER NOT NULL,
    score INTEGER NOT NULL,
    by_topic TEXT NOT NULL,
    day TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS interview_bookmarks (
    question_id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL
  );
  `,
  // v5 (Phase 5): cloud sync. Triggers record every local change in an outbox, so screens need
  // no sync code. While remote changes are applied, a row in sync_applying suppresses them.
  `
  INSERT OR IGNORE INTO kv (key, value) VALUES ('device_id', lower(hex(randomblob(8))));

  CREATE TABLE IF NOT EXISTS outbox (
    collection TEXT NOT NULL,
    key TEXT NOT NULL,
    changed_at INTEGER NOT NULL,
    PRIMARY KEY (collection, key)
  );
  CREATE TABLE IF NOT EXISTS sync_applying (flag INTEGER PRIMARY KEY);

  ALTER TABLE question_responses ADD COLUMN sync_id TEXT;
  ALTER TABLE card_reviews ADD COLUMN sync_id TEXT;
  ALTER TABLE game_rounds ADD COLUMN sync_id TEXT;
  ALTER TABLE interview_answers ADD COLUMN sync_id TEXT;
  UPDATE question_responses SET sync_id = (SELECT value FROM kv WHERE key = 'device_id') || ':qr:' || id;
  UPDATE card_reviews SET sync_id = (SELECT value FROM kv WHERE key = 'device_id') || ':cr:' || id;
  UPDATE game_rounds SET sync_id = (SELECT value FROM kv WHERE key = 'device_id') || ':gr:' || id;
  UPDATE interview_answers SET sync_id = (SELECT value FROM kv WHERE key = 'device_id') || ':ia:' || id;
  CREATE UNIQUE INDEX IF NOT EXISTS ux_qr_sync ON question_responses(sync_id);
  CREATE UNIQUE INDEX IF NOT EXISTS ux_cr_sync ON card_reviews(sync_id);
  CREATE UNIQUE INDEX IF NOT EXISTS ux_gr_sync ON game_rounds(sync_id);
  CREATE UNIQUE INDEX IF NOT EXISTS ux_ia_sync ON interview_answers(sync_id);
  ${SYNC_TRIGGERS}
  `,
  // v6: local log of notification taps (engagement is measured from real opens, on device).
  `
  CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id TEXT NOT NULL,
    type TEXT NOT NULL,
    event TEXT NOT NULL CHECK (event IN ('tapped')),
    at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notification_log_at ON notification_log(at);
  `,
  // v7 (Phase 9): opt-in analytics queue, filled by triggers only while the learner has opted in.
  `
  CREATE TABLE IF NOT EXISTS analytics_queue (
    key TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    value INTEGER,
    day TEXT NOT NULL
  );
  ${ANALYTICS_TRIGGERS}
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
