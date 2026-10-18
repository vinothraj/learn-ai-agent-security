import { SyncRequest } from '@laas/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db';
import { parse, requireAuth } from '../http';
import { applySync } from '../services';

export async function syncRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.post(
    '/v1/sync',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req) => {
      const auth = requireAuth(req);
      const body = parse(SyncRequest, req.body);
      return applySync(db, auth.id, body);
    },
  );
}
