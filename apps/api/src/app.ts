import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { createVerifier, type Verifier } from './auth';
import type { Config } from './config';
import type { Db } from './db';
import { HttpError } from './http';
import { openApiSpec } from './openapi';
import { accountRoutes } from './routes/account';
import { adminRoutes } from './routes/admin';
import { newsRoutes } from './routes/news';
import { syncRoutes } from './routes/sync';
import { systemRoutes } from './routes/system';
import { upsertUser } from './services';

const PUBLIC_PATHS = new Set(['/health', '/ready', '/v1/config', '/v1/news', '/dev/token']);

export async function buildApp({ config, db, verifier }: { config: Config; db: Db; verifier?: Verifier }): Promise<FastifyInstance> {
  const verify = verifier ?? createVerifier(config);
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : { level: config.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] },
    bodyLimit: 1_048_576,
    trustProxy: true,
  });

  await app.register(helmet, {
    // The API serves JSON plus the docs UI; keep CSP strict except what swagger-ui needs.
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], scriptSrc: ["'self'"] },
    },
  });
  await app.register(cors, {
    origin: (origin, cb) => {
      // Native apps send no Origin header; browsers must be on the allow-list.
      if (!origin) return cb(null, true);
      const dev = config.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      cb(null, dev || config.CORS_ORIGINS.includes(origin));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.auth?.id ?? req.ip,
  });
  await app.register(swagger, { mode: 'static', specification: { document: openApiSpec as never } });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Authentication: every non-public route needs a valid bearer token.
  app.addHook('onRequest', async (req) => {
    const path = req.url.split('?')[0]!;
    if (PUBLIC_PATHS.has(path) || path.startsWith('/docs') || req.method === 'OPTIONS') return;
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required');
    let identity;
    try {
      identity = await verify(header.slice(7));
    } catch {
      throw new HttpError(401, 'Invalid or expired token');
    }
    const user = await upsertUser(db, identity, config.SUPER_ADMIN_EMAILS);
    req.auth = { id: user.id, email: user.email, role: user.role, orgId: user.org_id };
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    }
    const { statusCode: status, message } = err as { statusCode?: number; message?: string };
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: message ?? 'Bad request' });
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: 'Internal server error' });
  });

  await app.register(systemRoutes, { db, config });
  await app.register(accountRoutes, { db, config });
  await app.register(syncRoutes, { db });
  await app.register(adminRoutes, { db });
  await app.register(newsRoutes, { db });
  return app;
}
