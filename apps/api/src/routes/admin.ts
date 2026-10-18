import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ROLES, roleRank, type Role } from '../auth';
import type { Db } from '../db';
import { HttpError, parse, requireAuth, requireRole } from '../http';
import { audit, type UserRow } from '../services';

/** CSV cell with quoting, and a leading quote on =,+,-,@ so spreadsheets never evaluate it as a formula. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const Page = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).default(0) });
const RoleChange = z.strictObject({ role: z.enum(ROLES) });
const IdParam = z.object({ id: z.uuid() });

export async function adminRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /** Aggregate numbers only; no individual learner behaviour. */
  app.get('/v1/admin/stats', { preHandler: requireRole('admin') }, async () => {
    const { rows } = await db.query<{ total: unknown; active7: unknown; new7: unknown }>(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE last_seen_at > now() - interval '7 days') AS active7,
              count(*) FILTER (WHERE created_at > now() - interval '7 days') AS new7
       FROM users`,
    );
    const r = rows[0]!;
    return { users: Number(r.total), activeLast7Days: Number(r.active7), newLast7Days: Number(r.new7) };
  });

  /** User directory (contains emails): admin+, and every access is audit-logged. */
  app.get('/v1/admin/users', { preHandler: requireRole('admin') }, async (req) => {
    const auth = requireAuth(req);
    const q = parse(Page, req.query);
    const { rows } = await db.query<UserRow>(
      `SELECT id, email, display_name, role, org_id, created_at, last_seen_at FROM users
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [q.limit, q.offset],
    );
    await audit(db, auth.id, 'users.list', undefined, { limit: q.limit, offset: q.offset });
    return { users: rows, limit: q.limit, offset: q.offset };
  });

  /**
   * Role changes: admins may grant/revoke learner and editor; only super-admins may grant or
   * revoke admin and super_admin. Nobody can change their own role.
   */
  app.patch('/v1/admin/users/:id/role', { preHandler: requireRole('admin') }, async (req) => {
    const auth = requireAuth(req);
    const { id } = parse(IdParam, req.params);
    const { role } = parse(RoleChange, req.body);
    if (id === auth.id) throw new HttpError(403, 'You cannot change your own role');
    const target = (await db.query<{ role: Role }>('SELECT role FROM users WHERE id = $1', [id])).rows[0];
    if (!target) throw new HttpError(404, 'User not found');
    const privileged = (r: Role) => roleRank(r) >= roleRank('admin');
    if ((privileged(role) || privileged(target.role)) && auth.role !== 'super_admin') {
      throw new HttpError(403, 'Only super-admins can grant or revoke admin roles');
    }
    await db.transaction(async (tx) => {
      await tx.query('UPDATE users SET role = $2, updated_at = now() WHERE id = $1', [id, role]);
      await audit(tx, auth.id, 'role.changed', { type: 'user', id }, { from: target.role, to: role });
    });
    return { id, role };
  });

  /** One call for the admin dashboard: aggregate counts only. */
  app.get('/v1/admin/overview', { preHandler: requireRole('admin') }, async () => {
    const one = async <T>(sql: string) => (await db.query<T>(sql)).rows[0]!;
    const users = await one<{ total: unknown; active7: unknown; new7: unknown }>(
      `SELECT count(*) AS total, count(*) FILTER (WHERE last_seen_at > now() - interval '7 days') AS active7,
              count(*) FILTER (WHERE created_at > now() - interval '7 days') AS new7 FROM users`,
    );
    const news = await one<{ pending: unknown; published7: unknown }>(
      `SELECT count(*) FILTER (WHERE review_status = 'pending') AS pending,
              count(*) FILTER (WHERE review_status = 'published' AND created_at > now() - interval '7 days') AS published7 FROM news_articles`,
    );
    const sources = await one<{ failing: unknown; enabled: unknown; last_run: string | null }>(
      `SELECT count(*) FILTER (WHERE enabled AND last_status = 'error') AS failing, count(*) FILTER (WHERE enabled) AS enabled,
              (SELECT max(started_at) FROM ingestion_runs) AS last_run FROM news_sources`,
    );
    const content = await one<{ published: string | null; drafts: unknown; review: unknown }>(
      `SELECT (SELECT label FROM content_versions WHERE status = 'published') AS published,
              count(*) FILTER (WHERE status = 'draft') AS drafts, count(*) FILTER (WHERE status = 'in_review') AS review FROM content_versions`,
    );
    return {
      users: { total: Number(users.total), activeLast7Days: Number(users.active7), newLast7Days: Number(users.new7) },
      news: { pendingReview: Number(news.pending), publishedLast7Days: Number(news.published7) },
      ingestion: { failingSources: Number(sources.failing), enabledSources: Number(sources.enabled), lastRunAt: sources.last_run },
      content: { publishedLabel: content.published, drafts: Number(content.drafts), inReview: Number(content.review) },
    };
  });

  app.get('/v1/admin/flags', { preHandler: requireRole('admin') }, async () => ({
    flags: (await db.query('SELECT key, enabled, description FROM feature_flags ORDER BY key')).rows,
  }));

  app.patch('/v1/admin/flags/:key', { preHandler: requireRole('super_admin') }, async (req) => {
    const auth = requireAuth(req);
    const { key } = parse(z.object({ key: z.string().regex(/^[a-z_]{2,40}$/) }), req.params);
    const { enabled } = parse(z.strictObject({ enabled: z.boolean() }), req.body);
    const { rows } = await db.query<{ key: string }>('UPDATE feature_flags SET enabled = $2 WHERE key = $1 RETURNING key', [key, enabled]);
    if (!rows.length) throw new HttpError(404, 'Unknown flag');
    await audit(db, auth.id, 'flag.changed', { type: 'flag', id: key }, { enabled });
    return { key, enabled };
  });

  /** CSV export of the user directory (super-admin, audited). Cells are neutralised against formula injection. */
  app.get('/v1/admin/users/export.csv', { preHandler: requireRole('super_admin') }, async (req, reply) => {
    const auth = requireAuth(req);
    const { rows } = await db.query<UserRow>('SELECT id, email, display_name, role, created_at, last_seen_at FROM users ORDER BY created_at');
    await audit(db, auth.id, 'users.exported', undefined, { count: rows.length });
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="users.csv"');
    const header = ['id', 'email', 'display_name', 'role', 'created_at', 'last_seen_at'];
    return [header.join(','), ...rows.map((r) => header.map((h) => csvCell((r as unknown as Record<string, unknown>)[h])).join(','))].join('\r\n');
  });

  app.get('/v1/admin/audit', { preHandler: requireRole('super_admin') }, async (req) => {
    const q = parse(Page, req.query);
    const { rows } = await db.query('SELECT id, actor_id, action, target_type, target_id, meta, created_at FROM audit_logs ORDER BY id DESC LIMIT $1 OFFSET $2', [
      q.limit,
      q.offset,
    ]);
    return { entries: rows.map((r) => ({ ...r, id: Number(r.id) })) };
  });
}
