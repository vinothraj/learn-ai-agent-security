import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

/**
 * Minimal database interface over node-postgres (production) and PGlite (development/tests).
 * Every query uses $1-style parameters; string-built SQL with user input is not allowed.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
  /** Runs multiple statements without parameters (migrations only). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export function pgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 10 });
  const wrap = (client: pg.PoolClient | pg.Pool): Db => ({
    query: async <T>(sql: string, params: unknown[] = []) => ({ rows: (await client.query(sql, params)).rows as T[] }),
    transaction: async (fn) => {
      const conn = await pool.connect();
      try {
        await conn.query('BEGIN');
        const r = await fn(wrap(conn));
        await conn.query('COMMIT');
        return r;
      } catch (e) {
        await conn.query('ROLLBACK');
        throw e;
      } finally {
        conn.release();
      }
    },
    exec: async (sql) => {
      await client.query(sql);
    },
    close: () => pool.end(),
  });
  return wrap(pool);
}

export async function pgliteDb(dir: string): Promise<Db> {
  const db = dir === 'memory' ? new PGlite() : new PGlite(dir);
  await db.waitReady;
  type Q = { query: PGlite['query']; exec: PGlite['exec'] };
  const wrap = (q: Q, isRoot: boolean): Db => ({
    query: async <T>(sql: string, params: unknown[] = []) => ({ rows: (await q.query<T>(sql, params)).rows }),
    // Nested transactions reuse the open one (Postgres has no true nesting without savepoints).
    transaction: (fn) => (isRoot ? db.transaction((tx) => fn(wrap(tx, false))) : fn(wrap(q, false))),
    exec: async (sql) => {
      await q.exec(sql);
    },
    close: () => db.close(),
  });
  return wrap(db, true);
}
