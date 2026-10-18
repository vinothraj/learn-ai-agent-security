import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ROLES, roleRank, type Role } from '../auth';
import type { Db } from '../db';
import { HttpError, parse, requireAuth, requireRole } from '../http';
import { audit, type UserRow } from '../services';

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

  app.get('/v1/admin/audit', { preHandler: requireRole('super_admin') }, async (req) => {
    const q = parse(Page, req.query);
    const { rows } = await db.query('SELECT id, actor_id, action, target_type, target_id, meta, created_at FROM audit_logs ORDER BY id DESC LIMIT $1 OFFSET $2', [
      q.limit,
      q.offset,
    ]);
    return { entries: rows.map((r) => ({ ...r, id: Number(r.id) })) };
  });
}
