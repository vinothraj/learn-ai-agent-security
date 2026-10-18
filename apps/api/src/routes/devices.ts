import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db';
import { HttpError, parse, requireAuth } from '../http';
import { TOPICS } from '../push';

const ExpoToken = z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/, 'invalid Expo push token');
const Register = z.strictObject({
  token: ExpoToken,
  platform: z.enum(['android', 'ios']),
  topics: z.array(z.enum(TOPICS)).max(TOPICS.length),
  timezone: z.string().max(64).default('UTC'),
});

export async function deviceRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /** Register or update this device's push token and topics. A token moves to the signed-in user. */
  app.put('/v1/devices', async (req) => {
    const auth = requireAuth(req);
    const b = parse(Register, req.body);
    await db.query(
      `INSERT INTO devices (user_id, expo_token, platform, topics, timezone) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (expo_token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, topics = EXCLUDED.topics,
         timezone = EXCLUDED.timezone, last_seen_at = now()`,
      [auth.id, b.token, b.platform, [...new Set(b.topics)], b.timezone],
    );
    return { ok: true, topics: [...new Set(b.topics)] };
  });

  app.delete('/v1/devices/:token', async (req) => {
    const auth = requireAuth(req);
    const { token } = parse(z.object({ token: ExpoToken }), req.params);
    await db.query('DELETE FROM devices WHERE expo_token = $1 AND user_id = $2', [token, auth.id]);
    return { ok: true };
  });

  /** Recorded only from the OS "notification opened" event, so "tapped" means a real tap. */
  app.post('/v1/notifications/:id/tapped', async (req) => {
    const auth = requireAuth(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const { rows } = await db.query<{ id: string }>(
      'UPDATE notifications SET tapped_at = COALESCE(tapped_at, now()) WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, auth.id],
    );
    if (!rows.length) throw new HttpError(404, 'Notification not found');
    return { ok: true };
  });
}
