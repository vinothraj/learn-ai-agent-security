import { addDays, EventBatch } from '@laas/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analyticsId, engagementReport } from '../analytics';
import type { Config } from '../config';
import type { Db } from '../db';
import { parse, requireAuth, requireRole } from '../http';

const ReportQuery = z.object({ days: z.coerce.number().int().min(7).max(90).default(30) });

export async function analyticsRoutes(app: FastifyInstance, { db, config }: { db: Db; config: Config }) {
  /** Opt-in event upload. Idempotent per (user, key); only active_day totals are updated in place. */
  app.post('/v1/events', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const auth = requireAuth(req);
    const { events } = parse(EventBatch, req.body);
    const flag = (await db.query<{ enabled: boolean }>(`SELECT enabled FROM feature_flags WHERE key = 'analytics'`)).rows[0];
    if (!flag?.enabled || !events.length) return { accepted: 0 };
    // Reject days far from the server's clock (bad device clocks would skew cohorts).
    const today = new Date().toISOString().slice(0, 10);
    const valid = events.filter((e) => e.day >= addDays(today, -400) && e.day <= addDays(today, 1));
    const user = analyticsId(config.ANALYTICS_SALT, auth.id);
    await db.transaction(async (tx) => {
      for (const e of valid) {
        await tx.query(
          `INSERT INTO analytics_events (user_hash, key, type, subject, value, day) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_hash, key) DO UPDATE SET value = GREATEST(analytics_events.value, EXCLUDED.value)
             WHERE analytics_events.type = 'active_day'`,
          [user, e.key, e.type, e.subject, e.value, e.day],
        );
      }
    });
    return { accepted: valid.length };
  });

  /** Withdrawing consent removes everything already shared. */
  app.delete('/v1/me/analytics', async (req) => {
    const auth = requireAuth(req);
    const { rows } = await db.query('DELETE FROM analytics_events WHERE user_hash = $1 RETURNING key', [analyticsId(config.ANALYTICS_SALT, auth.id)]);
    return { deleted: rows.length };
  });

  app.get('/v1/admin/analytics', { preHandler: requireRole('admin') }, async (req) => {
    const { days } = parse(ReportQuery, req.query);
    return engagementReport(db, { days });
  });
}
