import { MAX_PUSH, mergeRecord, sameRecord, SYNC_COLLECTIONS, SYNC_SCHEMAS, type SyncCollection, type SyncEnvelope, type SyncResponse } from '@laas/shared';
import type { SQLiteDatabase } from 'expo-sqlite';
import { inTransaction } from '@/db/repo';
import { ADAPTERS } from './collections';

const CURSOR_KEY = 'sync_cursor';
const LAST_SYNC_KEY = 'sync_last_at';
const MAX_ROUNDS = 20;

export type SyncTransport = (body: { cursor: number; changes: SyncEnvelope[] }) => Promise<SyncResponse>;

async function kvGet(db: SQLiteDatabase, key: string) {
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key))?.value ?? null;
}
async function kvSet(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

/** Queue every existing local record (first sign-in on this device). */
export async function enqueueAll(db: SQLiteDatabase) {
  const now = Date.now();
  for (const c of SYNC_COLLECTIONS) {
    await db.runAsync(
      `INSERT INTO outbox (collection, key, changed_at) SELECT ?, key, ? FROM (${ADAPTERS[c].allKeys}) WHERE key IS NOT NULL
       ON CONFLICT(collection, key) DO NOTHING`,
      c,
      now,
    );
  }
}

/** Builds envelopes from the outbox; invalid local rows are skipped (and logged) rather than blocking sync. */
async function collectChanges(db: SQLiteDatabase): Promise<{ changes: SyncEnvelope[]; sent: { collection: string; key: string; changedAt: number }[] }> {
  const rows = await db.getAllAsync<{ collection: SyncCollection; key: string; changed_at: number }>(
    'SELECT collection, key, changed_at FROM outbox ORDER BY changed_at ASC LIMIT ?',
    MAX_PUSH,
  );
  const changes: SyncEnvelope[] = [];
  const sent: { collection: string; key: string; changedAt: number }[] = [];
  for (const r of rows) {
    sent.push({ collection: r.collection, key: r.key, changedAt: r.changed_at });
    const adapter = ADAPTERS[r.collection];
    if (!adapter) continue;
    const local = await adapter.read(db, r.key);
    if (!local) {
      changes.push({ collection: r.collection, key: r.key, updatedAt: r.changed_at, deleted: true, data: {} });
      continue;
    }
    if (!SYNC_SCHEMAS[r.collection].safeParse(local.data).success) {
      console.warn(`sync: skipping invalid local ${r.collection}/${r.key}`);
      continue;
    }
    changes.push({ collection: r.collection, key: r.key, updatedAt: r.changed_at, data: local.data });
  }
  return { changes, sent };
}

/** Applies remote envelopes with outbox triggers suppressed. Local-only knowledge is re-queued. */
async function applyRemote(db: SQLiteDatabase, remote: SyncEnvelope[]) {
  const requeue: SyncEnvelope[] = [];
  await inTransaction(db, async () => {
    await db.runAsync('INSERT OR IGNORE INTO sync_applying (flag) VALUES (1)');
    try {
      for (const incoming of remote) {
        const adapter = ADAPTERS[incoming.collection];
        if (!adapter) continue;
        if (!incoming.deleted && !SYNC_SCHEMAS[incoming.collection].safeParse(incoming.data).success) continue;
        const pending = await db.getFirstAsync<{ changed_at: number }>('SELECT changed_at FROM outbox WHERE collection = ? AND key = ?', incoming.collection, incoming.key);
        const localRow = await adapter.read(db, incoming.key);
        const local: SyncEnvelope | null = localRow
          ? { collection: incoming.collection, key: incoming.key, updatedAt: pending?.changed_at ?? localRow.time, data: localRow.data }
          : null;
        const merged = mergeRecord(local, incoming);
        await adapter.write(db, incoming.key, merged.deleted ? null : merged.data);
        if (!sameRecord(merged, incoming)) requeue.push(merged);
      }
    } finally {
      await db.runAsync('DELETE FROM sync_applying');
    }
  });
  for (const r of requeue) {
    await db.runAsync(
      'INSERT INTO outbox (collection, key, changed_at) VALUES (?, ?, ?) ON CONFLICT(collection, key) DO UPDATE SET changed_at = excluded.changed_at',
      r.collection,
      r.key,
      Date.now(),
    );
  }
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  lastSyncAt: number;
}

/**
 * One full sync: repeatedly push up to 500 queued changes and pull remote changes until both
 * sides are drained. Outbox rows are only removed if they did not change during the request.
 */
export async function runSync(db: SQLiteDatabase, transport: SyncTransport): Promise<SyncResult> {
  let cursor = Number((await kvGet(db, CURSOR_KEY)) ?? 0);
  let pushed = 0;
  let pulled = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { changes, sent } = await collectChanges(db);
    const res = await transport({ cursor, changes });
    for (const s of sent) {
      await db.runAsync('DELETE FROM outbox WHERE collection = ? AND key = ? AND changed_at <= ?', s.collection, s.key, s.changedAt);
    }
    pushed += changes.length;
    await applyRemote(db, res.changes);
    pulled += res.changes.length;
    cursor = res.cursor;
    await kvSet(db, CURSOR_KEY, String(cursor));
    const remaining = (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox'))?.n ?? 0;
    if (!res.hasMore && remaining === 0) break;
  }
  const lastSyncAt = Date.now();
  await kvSet(db, LAST_SYNC_KEY, String(lastSyncAt));
  return { pushed, pulled, lastSyncAt };
}

export async function lastSyncAt(db: SQLiteDatabase): Promise<number | null> {
  const v = await kvGet(db, LAST_SYNC_KEY);
  return v ? Number(v) : null;
}

/** Forget sync position (after sign-out of one account and sign-in to another). */
export async function resetSyncState(db: SQLiteDatabase) {
  await db.runAsync("DELETE FROM kv WHERE key IN ('sync_cursor', 'sync_last_at')");
  await db.runAsync('DELETE FROM outbox');
}
