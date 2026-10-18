import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Config } from '../config';
import type { Db } from '../db';
import { parse, requireAuth } from '../http';
import { audit, exportUserData, pseudonym } from '../services';

export const UpdateMe = z.strictObject({ displayName: z.string().trim().max(40) });

/** Deletes the Supabase auth user with the server-only service key (best effort, logged). */
async function deleteAuthUser(config: Config, userId: string): Promise<boolean> {
  if (config.AUTH_MODE !== 'supabase' || !config.SUPABASE_SERVICE_ROLE_KEY || !config.SUPABASE_URL) return false;
  const res = await fetch(`${config.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { apikey: config.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  return res.ok;
}

export async function accountRoutes(app: FastifyInstance, { db, config }: { db: Db; config: Config }) {
  app.get('/v1/me', async (req) => {
    const auth = requireAuth(req);
    const { rows } = await db.query<{ display_name: string; created_at: string }>('SELECT display_name, created_at FROM users WHERE id = $1', [auth.id]);
    return { id: auth.id, email: auth.email, role: auth.role, orgId: auth.orgId, displayName: rows[0]?.display_name ?? '', createdAt: rows[0]?.created_at };
  });

  app.patch('/v1/me', async (req) => {
    const auth = requireAuth(req);
    const body = parse(UpdateMe, req.body);
    await db.query('UPDATE users SET display_name = $2, updated_at = now() WHERE id = $1', [auth.id, body.displayName]);
    return { ok: true };
  });

  /** Data portability (GDPR art. 20 / DPDP): everything we store about the user, as JSON. */
  app.get('/v1/me/export', async (req, reply) => {
    const auth = requireAuth(req);
    reply.header('Content-Disposition', 'attachment; filename="learn-ai-security-export.json"');
    return exportUserData(db, auth.id);
  });

  /** Account deletion (Google Play requirement): removes the profile and all synced progress. */
  app.delete('/v1/me', async (req) => {
    const auth = requireAuth(req);
    await db.transaction(async (tx) => {
      await audit(tx, pseudonym(auth.id), 'account.deleted', { type: 'user', id: pseudonym(auth.id) });
      await tx.query('DELETE FROM users WHERE id = $1', [auth.id]); // cascades to sync_records
    });
    let authAccountDeleted = false;
    try {
      authAccountDeleted = await deleteAuthUser(config, auth.id);
    } catch (e) {
      req.log.error({ err: e }, 'auth user deletion failed');
    }
    return { deleted: true, authAccountDeleted };
  });
}
