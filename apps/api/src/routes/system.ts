import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { mintDevToken, ROLES } from '../auth';
import type { AiService } from '../ai/service';
import type { Config } from '../config';
import type { Db } from '../db';
import { parse } from '../http';

const DevTokenBody = z.strictObject({
  sub: z.uuid(),
  email: z.email(),
  role: z.enum(ROLES).optional(),
});

export async function systemRoutes(app: FastifyInstance, { db, config, ai }: { db: Db; config: Config; ai: AiService }) {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_req, reply) => {
    try {
      await db.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  /** Public, cacheable client configuration (no secrets). */
  app.get('/v1/config', async (_req, reply) => {
    const { rows } = await db.query<{ key: string; enabled: boolean }>('SELECT key, enabled FROM feature_flags ORDER BY key');
    reply.header('Cache-Control', 'public, max-age=300');
    const flags = Object.fromEntries(rows.map((r) => [r.key, r.enabled]));
    // AI features are offered only when the flag is on AND a provider is configured on the server.
    return { authMode: config.AUTH_MODE, flags, features: { ai: !!flags.ai && ai.providerName !== 'none' } };
  });

  // Local development only: mint tokens so the app and tests run without an auth provider.
  if (config.AUTH_MODE === 'dev' && config.NODE_ENV !== 'production') {
    app.post('/dev/token', async (req) => {
      const body = parse(DevTokenBody, req.body);
      if (body.role) {
        await db.query(`INSERT INTO users (id, email, role) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role`, [
          body.sub,
          body.email.toLowerCase(),
          body.role,
        ]);
      }
      return { accessToken: await mintDevToken(config, body.sub, body.email.toLowerCase()), expiresIn: 3600 };
    });
  }
}
