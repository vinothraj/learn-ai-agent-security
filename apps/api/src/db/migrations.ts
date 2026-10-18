import type { Db } from './index';

/**
 * Append-only, ordered SQL migrations. Never edit a released migration; add a new one.
 * Applied inside a transaction each, tracked in schema_migrations.
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE users (
        id uuid PRIMARY KEY,                      -- the auth provider's subject (sub)
        email text,
        display_name text NOT NULL DEFAULT '' CHECK (length(display_name) <= 40),
        role text NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'editor', 'admin', 'super_admin')),
        org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_users_org ON users(org_id);
      CREATE INDEX idx_users_last_seen ON users(last_seen_at);

      CREATE SEQUENCE sync_seq;
      CREATE TABLE sync_records (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection text NOT NULL,
        record_key text NOT NULL,
        data jsonb NOT NULL,
        updated_at bigint NOT NULL,
        deleted boolean NOT NULL DEFAULT false,
        server_seq bigint NOT NULL DEFAULT nextval('sync_seq'),
        PRIMARY KEY (user_id, collection, record_key)
      );
      CREATE INDEX idx_sync_user_seq ON sync_records(user_id, server_seq);

      -- Append-only audit trail of privileged actions.
      CREATE TABLE audit_logs (
        id bigserial PRIMARY KEY,
        actor_id text,
        action text NOT NULL,
        target_type text,
        target_id text,
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_audit_created ON audit_logs(created_at);
      CREATE FUNCTION audit_logs_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only';
      END $$;
      CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

      CREATE TABLE feature_flags (
        key text PRIMARY KEY,
        enabled boolean NOT NULL,
        description text NOT NULL DEFAULT ''
      );
      INSERT INTO feature_flags (key, enabled, description) VALUES
        ('sync', true, 'Cloud backup and cross-device sync'),
        ('news', false, 'Live security news feed (Phase 6)'),
        ('ai', false, 'Optional AI features (Phase 10)'),
        ('community', false, 'Pro community (Phase 13)');
    `,
  },
];

export async function migrate(db: Db): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map((r) => r.id));
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
    });
    applied.push(m.id);
  }
  return applied;
}
