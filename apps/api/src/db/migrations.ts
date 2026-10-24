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
  {
    id: '002_news',
    sql: `
      CREATE TABLE news_sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        feed_url text NOT NULL UNIQUE CHECK (feed_url LIKE 'https://%'),
        publisher text NOT NULL,
        allowed_domains text[] NOT NULL CHECK (cardinality(allowed_domains) > 0),
        trust text NOT NULL CHECK (trust IN ('official', 'community', 'research')),
        -- Broad feeds (e.g. government advisories) only keep AI-related items.
        require_ai_relevance boolean NOT NULL DEFAULT true,
        enabled boolean NOT NULL DEFAULT true,
        fetch_interval_minutes integer NOT NULL DEFAULT 360 CHECK (fetch_interval_minutes BETWEEN 30 AND 10080),
        max_items_per_run integer NOT NULL DEFAULT 30 CHECK (max_items_per_run BETWEEN 1 AND 200),
        last_fetched_at timestamptz,
        last_status text,
        last_error text,
        etag text,
        last_modified text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE news_articles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id uuid NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
        title text NOT NULL,
        url text NOT NULL,
        canonical_url text NOT NULL UNIQUE,
        publisher text NOT NULL,
        published_at timestamptz,
        retrieved_at timestamptz NOT NULL DEFAULT now(),
        last_checked_at timestamptz NOT NULL DEFAULT now(),
        category text NOT NULL,
        tags text[] NOT NULL DEFAULT '{}',
        excerpt text NOT NULL DEFAULT '',
        summary text NOT NULL,
        summary_origin text NOT NULL DEFAULT 'template' CHECK (summary_origin IN ('template', 'ai', 'editor')),
        defense text NOT NULL,
        vuln_ids text[] NOT NULL DEFAULT '{}',
        verification text NOT NULL CHECK (verification IN ('source_verified', 'unverified')),
        high_impact boolean NOT NULL DEFAULT false,
        review_status text NOT NULL CHECK (review_status IN ('pending', 'published', 'rejected')),
        review_reason text,
        lesson_id text,
        lab_id text,
        interview_id text,
        fingerprint text NOT NULL,
        reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_news_published ON news_articles(review_status, published_at DESC);
      CREATE INDEX idx_news_created ON news_articles(created_at DESC);

      CREATE TABLE ingestion_runs (
        id bigserial PRIMARY KEY,
        source_id uuid REFERENCES news_sources(id) ON DELETE CASCADE,
        started_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz,
        status text NOT NULL CHECK (status IN ('running', 'ok', 'not_modified', 'error')),
        fetched integer NOT NULL DEFAULT 0,
        inserted integer NOT NULL DEFAULT 0,
        duplicates integer NOT NULL DEFAULT 0,
        rejected integer NOT NULL DEFAULT 0,
        error text
      );
      CREATE INDEX idx_runs_started ON ingestion_runs(started_at DESC);

      INSERT INTO news_sources (name, feed_url, publisher, allowed_domains, trust, require_ai_relevance, fetch_interval_minutes) VALUES
        ('OWASP GenAI Security Project', 'https://genai.owasp.org/feed/', 'OWASP', '{genai.owasp.org}', 'official', false, 720),
        ('CISA advisories', 'https://www.cisa.gov/cybersecurity-advisories/all.xml', 'CISA', '{cisa.gov}', 'official', true, 360),
        ('NIST news', 'https://www.nist.gov/news-events/news/rss.xml', 'NIST', '{nist.gov}', 'official', true, 720),
        ('UK NCSC', 'https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml', 'UK NCSC', '{ncsc.gov.uk}', 'official', true, 720),
        ('Google Security Blog', 'https://feeds.feedburner.com/GoogleOnlineSecurityBlog', 'Google', '{security.googleblog.com,googleblog.com}', 'official', true, 720),
        ('GitHub Security Blog', 'https://github.blog/security/feed/', 'GitHub', '{github.blog}', 'official', true, 720),
        ('arXiv cs.CR (metadata)', 'https://rss.arxiv.org/rss/cs.CR', 'arXiv', '{arxiv.org}', 'research', true, 1440);

      INSERT INTO feature_flags (key, enabled, description) VALUES ('news_ingestion', true, 'Background feed ingestion')
        ON CONFLICT (key) DO NOTHING;
      UPDATE feature_flags SET enabled = true WHERE key = 'news';
    `,
  },
  {
    id: '003_content_versions',
    sql: `
      -- Versioned content packs: draft -> in_review -> published (one at a time) -> archived.
      CREATE TABLE content_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        label text NOT NULL CHECK (length(label) BETWEEN 1 AND 40),
        pack jsonb NOT NULL,
        checksum text NOT NULL,
        issues integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'published', 'archived', 'rejected')),
        notes text NOT NULL DEFAULT '',
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        submitted_at timestamptz,
        reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at timestamptz,
        review_note text,
        published_at timestamptz
      );
      CREATE UNIQUE INDEX ux_content_one_published ON content_versions(status) WHERE status = 'published';
      CREATE INDEX idx_content_created ON content_versions(created_at DESC);
    `,
  },
  {
    id: '004_push',
    sql: `
      CREATE TABLE devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expo_token text NOT NULL UNIQUE,
        platform text NOT NULL CHECK (platform IN ('android', 'ios')),
        topics text[] NOT NULL DEFAULT '{}',
        timezone text NOT NULL DEFAULT 'UTC',
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_devices_user ON devices(user_id);

      -- One row per user per logical notification: the unique dedupe key prevents duplicates.
      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type text NOT NULL CHECK (type IN ('advisory', 'content')),
        dedupe_key text NOT NULL UNIQUE,
        title text NOT NULL,
        body text NOT NULL,
        url text NOT NULL DEFAULT '/',
        status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'error', 'skipped')),
        error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        sent_at timestamptz,
        tapped_at timestamptz
      );
      CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

      INSERT INTO feature_flags (key, enabled, description) VALUES ('push', true, 'Server push for advisories and new content')
        ON CONFLICT (key) DO NOTHING;
    `,
  },
  {
    id: '005_analytics',
    sql: `
      -- Opt-in engagement events keyed by a pseudonymous id (HMAC of the user id), never the user id.
      CREATE TABLE analytics_events (
        user_hash text NOT NULL,
        key text NOT NULL,
        type text NOT NULL,
        subject text NOT NULL DEFAULT '',
        value integer,
        day date NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_hash, key)
      );
      CREATE INDEX idx_analytics_type_day ON analytics_events(type, day);
      INSERT INTO feature_flags (key, enabled, description) VALUES ('analytics', true, 'Opt-in aggregate engagement analytics')
        ON CONFLICT (key) DO NOTHING;
    `,
  },
  {
    id: '006_ai',
    sql: `
      -- Token and request accounting for budgets and per-user limits (user_id NULL = admin/system tasks).
      CREATE TABLE ai_usage (
        day date NOT NULL,
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        user_key text GENERATED ALWAYS AS (COALESCE(user_id::text, '')) STORED,
        task text NOT NULL,
        requests integer NOT NULL DEFAULT 0,
        input_tokens bigint NOT NULL DEFAULT 0,
        output_tokens bigint NOT NULL DEFAULT 0,
        UNIQUE (day, user_key, task)
      );
      CREATE TABLE ai_cache (
        key text PRIMARY KEY,
        task text NOT NULL,
        output jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX idx_ai_cache_expires ON ai_cache(expires_at);
      -- AI-generated drafts never publish themselves: they wait here for a human decision.
      CREATE TABLE ai_suggestions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        kind text NOT NULL CHECK (kind IN ('quiz')),
        lesson_id text NOT NULL,
        payload jsonb NOT NULL,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        provider text NOT NULL,
        model text NOT NULL,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at timestamptz,
        note text
      );
      CREATE INDEX idx_ai_suggestions_status ON ai_suggestions(status, created_at DESC);
      UPDATE feature_flags SET description = 'Optional AI features (needs AI_PROVIDER on the server)' WHERE key = 'ai';
    `,
  },
  {
    id: '007_content_jobs',
    sql: `
      -- Weekly news-based drafts and one-click "apply to a content draft".
      ALTER TABLE ai_suggestions DROP CONSTRAINT ai_suggestions_kind_check;
      ALTER TABLE ai_suggestions ADD CONSTRAINT ai_suggestions_kind_check CHECK (kind IN ('quiz', 'news_pack'));
      ALTER TABLE ai_suggestions ADD COLUMN source_ref text;
      ALTER TABLE ai_suggestions ADD COLUMN applied_version uuid REFERENCES content_versions(id) ON DELETE SET NULL;
      ALTER TABLE ai_suggestions ADD COLUMN applied_at timestamptz;
      CREATE UNIQUE INDEX ux_ai_suggestions_source ON ai_suggestions(kind, source_ref) WHERE source_ref IS NOT NULL;
      INSERT INTO feature_flags (key, enabled, description) VALUES ('weekly_drafts', true, 'Weekly AI drafts from published news (needs AI)')
        ON CONFLICT (key) DO NOTHING;
    `,
  },
  {
    id: '008_row_level_security',
    sql: `
      -- Supabase publishes the public schema through its REST API to anyone with the (public) app key.
      -- The API server is the only intended client: enable RLS with no policies so REST and Realtime
      -- see nothing, while the API (table owner) is unaffected. Harmless on plain Postgres and PGlite.
      ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE sync_records ENABLE ROW LEVEL SECURITY;
      ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
      ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;
      ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
      ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
      ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
      ALTER FUNCTION audit_logs_immutable() SET search_path = '';
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
