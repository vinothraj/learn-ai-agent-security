import { createHash } from 'node:crypto';
import { MAX_PULL, mergeRecord, sameRecord, type SyncEnvelope, type SyncRequest, type SyncResponse } from '@laas/shared';
import type { Identity, Role } from './auth';
import type { Db } from './db';

export interface UserRow {
  id: string;
  email: string | null;
  display_name: string;
  role: Role;
  org_id: string | null;
  created_at: string;
  last_seen_at: string;
}

/** Pseudonymous id for audit entries that must outlive a deleted account. */
export const pseudonym = (id: string) => `anon:${createHash('sha256').update(id).digest('hex').slice(0, 16)}`;

export async function audit(
  db: Db,
  actorId: string | null,
  action: string,
  target?: { type: string; id: string },
  meta: Record<string, unknown> = {},
) {
  await db.query('INSERT INTO audit_logs (actor_id, action, target_type, target_id, meta) VALUES ($1, $2, $3, $4, $5)', [
    actorId,
    action,
    target?.type ?? null,
    target?.id ?? null,
    JSON.stringify(meta),
  ]);
}

/** Creates the user on first sign-in, refreshes email/last-seen, and applies bootstrap super-admins. */
export async function upsertUser(db: Db, identity: Identity, superAdminEmails: readonly string[]): Promise<UserRow> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (id, email) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email), last_seen_at = now()
     RETURNING id, email, display_name, role, org_id, created_at, last_seen_at`,
    [identity.id, identity.email],
  );
  let user = rows[0]!;
  const bootstrap = identity.email && superAdminEmails.map((e) => e.toLowerCase()).includes(identity.email);
  if (bootstrap && user.role !== 'super_admin') {
    await db.query(`UPDATE users SET role = 'super_admin', updated_at = now() WHERE id = $1`, [user.id]);
    await audit(db, null, 'role.bootstrap', { type: 'user', id: user.id }, { role: 'super_admin' });
    user = { ...user, role: 'super_admin' };
  }
  return user;
}

const toNumber = (v: unknown) => Number(typeof v === 'bigint' ? v.toString() : v);

interface StoredRow {
  collection: string;
  record_key: string;
  data: Record<string, unknown>;
  updated_at: unknown;
  deleted: boolean;
  server_seq: unknown;
}

const toEnvelope = (r: StoredRow): SyncEnvelope => ({
  collection: r.collection as SyncEnvelope['collection'],
  key: r.record_key,
  updatedAt: toNumber(r.updated_at),
  ...(r.deleted ? { deleted: true } : {}),
  data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
});

/**
 * Push-then-pull in one round trip. Incoming changes are merged with the shared merge rules
 * inside a transaction; only records that actually changed get a new server sequence number.
 */
export async function applySync(db: Db, userId: string, req: SyncRequest): Promise<SyncResponse> {
  await db.transaction(async (tx) => {
    for (const change of req.changes) {
      const { rows } = await tx.query<StoredRow>(
        `SELECT collection, record_key, data, updated_at, deleted, server_seq FROM sync_records
         WHERE user_id = $1 AND collection = $2 AND record_key = $3 FOR UPDATE`,
        [userId, change.collection, change.key],
      );
      const existing = rows[0] ? toEnvelope(rows[0]) : null;
      const incoming: SyncEnvelope = { ...change, data: change.deleted ? (existing?.data ?? {}) : change.data };
      const merged = mergeRecord(existing, incoming);
      if (existing && sameRecord(merged, existing)) continue;
      await tx.query(
        `INSERT INTO sync_records (user_id, collection, record_key, data, updated_at, deleted)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, collection, record_key) DO UPDATE
           SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, deleted = EXCLUDED.deleted, server_seq = nextval('sync_seq')`,
        [userId, merged.collection, merged.key, JSON.stringify(merged.data), merged.updatedAt, !!merged.deleted],
      );
    }
  });

  const { rows } = await db.query<StoredRow>(
    `SELECT collection, record_key, data, updated_at, deleted, server_seq FROM sync_records
     WHERE user_id = $1 AND server_seq > $2 ORDER BY server_seq ASC LIMIT $3`,
    [userId, req.cursor, MAX_PULL + 1],
  );
  const hasMore = rows.length > MAX_PULL;
  const page = rows.slice(0, MAX_PULL);
  return {
    cursor: page.length ? toNumber(page[page.length - 1]!.server_seq) : req.cursor,
    changes: page.map(toEnvelope),
    hasMore,
  };
}

export async function exportUserData(db: Db, userId: string) {
  const user = (await db.query<UserRow>('SELECT id, email, display_name, role, org_id, created_at, last_seen_at FROM users WHERE id = $1', [userId])).rows[0];
  const records = (
    await db.query<StoredRow>(
      'SELECT collection, record_key, data, updated_at, deleted, server_seq FROM sync_records WHERE user_id = $1 ORDER BY collection, record_key',
      [userId],
    )
  ).rows.map(toEnvelope);
  return { exportedAt: new Date().toISOString(), user, records };
}
