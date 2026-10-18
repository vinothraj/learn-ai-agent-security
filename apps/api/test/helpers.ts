import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import type { Role } from '../src/auth';
import { loadConfig } from '../src/config';
import { pgDb, pgliteDb, type Db } from '../src/db';
import { migrate } from '../src/db/migrations';
import type { AIProvider } from '../src/ai/providers';
import type { PushSender } from '../src/push';

export interface TestCtx {
  app: FastifyInstance;
  db: Db;
  /** Creates a user with a role and returns an Authorization header for them. */
  login: (role?: Role, email?: string) => Promise<{ id: string; headers: { authorization: string } }>;
}

/**
 * In-memory PGlite by default. Set TEST_DATABASE_URL to run against real Postgres; the schema is
 * wiped first, so the database name must contain "test" as a guard against pointing at real data.
 */
async function testDb(): Promise<Db> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return pgliteDb('memory');
  const name = new URL(url).pathname.slice(1);
  if (!name.includes('test')) throw new Error(`Refusing to reset database "${name}": name must contain "test"`);
  const db = pgDb(url);
  await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  return db;
}

export async function setup(env: Record<string, string> = {}, push: PushSender | null = null, ai?: AIProvider): Promise<TestCtx> {
  const config = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'dev', PGLITE_DIR: 'memory', ...env });
  const db = await testDb();
  await migrate(db);
  const app = await buildApp({ config, db, push, ai });
  const login = async (role: Role = 'learner', email = `${randomUUID().slice(0, 8)}@example.test`) => {
    const id = randomUUID();
    const res = await app.inject({ method: 'POST', url: '/dev/token', payload: { sub: id, email, role } });
    const { accessToken } = res.json() as { accessToken: string };
    return { id, headers: { authorization: `Bearer ${accessToken}` } };
  };
  return { app, db, login };
}
