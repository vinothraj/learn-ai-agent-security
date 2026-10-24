import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SyncEnvelope } from '@laas/shared';
import { loadConfig } from '../src/config';
import { setup, type TestCtx } from './helpers';

let t: TestCtx;
beforeAll(async () => {
  t = await setup({ SUPER_ADMIN_EMAILS: 'boss@example.test' });
});
afterAll(async () => {
  await t.app.close();
  await t.db.close();
});

const progress = (lessonId: string, status: 'in_progress' | 'completed', updatedAt: number, extra: Record<string, unknown> = {}): SyncEnvelope => ({
  collection: 'lesson_progress',
  key: lessonId,
  updatedAt,
  data: {
    lessonId,
    status,
    step: status === 'completed' ? 0 : 3,
    bestScore: status === 'completed' ? 67 : null,
    attempts: status === 'completed' ? 1 : 0,
    startedAt: 1000,
    updatedAt,
    completedAt: status === 'completed' ? updatedAt : null,
    completedDay: status === 'completed' ? '2026-10-18' : null,
    ...extra,
  },
});

describe('system and auth', () => {
  it('serves health, readiness and public config without auth', async () => {
    expect((await t.app.inject('/health')).json()).toEqual({ status: 'ok' });
    expect((await t.app.inject('/ready')).statusCode).toBe(200);
    const cfg = (await t.app.inject('/v1/config')).json();
    expect(cfg).toMatchObject({ authMode: 'dev', flags: { sync: true, community: false } });
  });

  it('rejects missing, malformed, forged and wrong-audience tokens', async () => {
    expect((await t.app.inject('/v1/me')).statusCode).toBe(401);
    expect((await t.app.inject({ url: '/v1/me', headers: { authorization: 'Bearer nope' } })).statusCode).toBe(401);
    const forged = await new SignJWT({ email: 'x@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('00000000-0000-4000-8000-000000000001')
      .setIssuer('laas-dev')
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-completely-different-secret-value-123456'));
    expect((await t.app.inject({ url: '/v1/me', headers: { authorization: `Bearer ${forged}` } })).statusCode).toBe(401);
    const wrongAud = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('00000000-0000-4000-8000-000000000002')
      .setIssuer('laas-dev')
      .setAudience('someone-else')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(loadConfig({ NODE_ENV: 'test' }).DEV_JWT_SECRET));
    expect((await t.app.inject({ url: '/v1/me', headers: { authorization: `Bearer ${wrongAud}` } })).statusCode).toBe(401);
  });

  it('creates the user on first request and returns the profile', async () => {
    const u = await t.login();
    const me = (await t.app.inject({ url: '/v1/me', headers: u.headers })).json();
    expect(me).toMatchObject({ id: u.id, role: 'learner', displayName: '' });
    const upd = await t.app.inject({ method: 'PATCH', url: '/v1/me', headers: u.headers, payload: { displayName: '  Vinoth  ' } });
    expect(upd.statusCode).toBe(200);
    expect((await t.app.inject({ url: '/v1/me', headers: u.headers })).json().displayName).toBe('Vinoth');
    const bad = await t.app.inject({ method: 'PATCH', url: '/v1/me', headers: u.headers, payload: { displayName: 'x', role: 'admin' } });
    expect(bad.statusCode).toBe(400);
  });

  it('promotes bootstrap super-admin emails on sign-in', async () => {
    const boss = await t.login('learner', 'boss@example.test');
    expect((await t.app.inject({ url: '/v1/me', headers: boss.headers })).json().role).toBe('super_admin');
  });
});

describe('RBAC matrix', () => {
  const cases: [string, string, Record<string, number>][] = [
    ['GET', '/v1/admin/stats', { learner: 403, editor: 403, admin: 200, super_admin: 200 }],
    ['GET', '/v1/admin/users', { learner: 403, editor: 403, admin: 200, super_admin: 200 }],
    ['GET', '/v1/admin/audit', { learner: 403, editor: 403, admin: 403, super_admin: 200 }],
  ];
  for (const [method, url, expected] of cases) {
    for (const [role, status] of Object.entries(expected)) {
      it(`${role} ${method} ${url} -> ${status}`, async () => {
        const u = await t.login(role as never);
        expect((await t.app.inject({ method: method as 'GET', url, headers: u.headers })).statusCode).toBe(status);
      });
    }
  }

  it('enforces role-change rules and audits them', async () => {
    const admin = await t.login('admin');
    const sa = await t.login('super_admin');
    const target = await t.login('learner');
    const change = (who: typeof admin, id: string, role: string) =>
      t.app.inject({ method: 'PATCH', url: `/v1/admin/users/${id}/role`, headers: who.headers, payload: { role } });

    expect((await change(admin, target.id, 'editor')).statusCode).toBe(200);
    expect((await change(admin, target.id, 'admin')).statusCode).toBe(403); // admins cannot grant admin
    expect((await change(sa, target.id, 'admin')).statusCode).toBe(200);
    expect((await change(admin, target.id, 'learner')).statusCode).toBe(403); // or revoke it
    expect((await change(sa, sa.id, 'learner')).statusCode).toBe(403); // never your own role
    expect((await change(sa, '00000000-0000-4000-8000-0000000000ff', 'editor')).statusCode).toBe(404);
    expect((await change(sa, target.id, 'god')).statusCode).toBe(400);

    const audit = (await t.app.inject({ url: '/v1/admin/audit?limit=100', headers: sa.headers })).json().entries as { action: string; target_id: string }[];
    expect(audit.filter((e) => e.action === 'role.changed' && e.target_id === target.id)).toHaveLength(2);
  });

  it('keeps the audit log append-only at the database level', async () => {
    await expect(t.db.query('DELETE FROM audit_logs')).rejects.toThrow(/append-only/);
    await expect(t.db.query(`UPDATE audit_logs SET action = 'x'`)).rejects.toThrow(/append-only/);
  });
});

describe('sync', () => {
  it('syncs progress between two devices and keeps completion sticky', async () => {
    const u = await t.login();
    const sync = (cursor: number, changes: SyncEnvelope[]) => t.app.inject({ method: 'POST', url: '/v1/sync', headers: u.headers, payload: { cursor, changes } });

    // Device A completes a lesson.
    const a1 = (await sync(0, [progress('b-prompt-injection', 'completed', 5000)])).json();
    expect(a1.changes).toHaveLength(1);
    // Device B, never synced, pushes a stale in-progress copy with a later clock.
    const b1 = (await sync(0, [progress('b-prompt-injection', 'in_progress', 9000)])).json();
    const merged = b1.changes.find((c: SyncEnvelope) => c.key === 'b-prompt-injection');
    expect(merged.data).toMatchObject({ status: 'completed', bestScore: 67 });
    // Device A pulls with its cursor: it sees the merged record, which is still completed.
    const a2 = (await sync(a1.cursor, [])).json();
    expect(a2.changes.every((c: SyncEnvelope) => c.data.status === 'completed')).toBe(true);
    // Nothing new after that.
    expect((await sync(a2.cursor, [])).json().changes).toHaveLength(0);
  });

  it('does not bump the cursor for no-op pushes and isolates users', async () => {
    const u = await t.login();
    const other = await t.login();
    const xp: SyncEnvelope = { collection: 'xp_ledger', key: 'lesson_complete:x', updatedAt: 1, data: { day: '2026-10-18', amount: 50, reason: 'lesson_complete', ref: 'x', createdAt: 1 } };
    const first = (await t.app.inject({ method: 'POST', url: '/v1/sync', headers: u.headers, payload: { cursor: 0, changes: [xp] } })).json();
    const again = (await t.app.inject({ method: 'POST', url: '/v1/sync', headers: u.headers, payload: { cursor: first.cursor, changes: [{ ...xp, data: { ...xp.data, amount: 999 } }] } })).json();
    expect(again.changes).toHaveLength(0); // immutable log: nothing changed, nothing to pull
    const otherPull = (await t.app.inject({ method: 'POST', url: '/v1/sync', headers: other.headers, payload: { cursor: 0, changes: [] } })).json();
    expect(otherPull.changes).toHaveLength(0);
  });

  it('merges duplicate keys within one batch like sequential pushes', async () => {
    const u = await t.login();
    const sync = (cursor: number, changes: SyncEnvelope[]) => t.app.inject({ method: 'POST', url: '/v1/sync', headers: u.headers, payload: { cursor, changes } });
    const r = (
      await sync(0, [progress('a-trust-boundaries', 'in_progress', 1000), progress('a-trust-boundaries', 'completed', 2000), progress('a-trust-boundaries', 'in_progress', 3000)])
    ).json();
    const rows = r.changes.filter((c: SyncEnvelope) => c.key === 'a-trust-boundaries');
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toMatchObject({ status: 'completed', bestScore: 67 }); // completion stays sticky
    // Re-sending the same batch is a no-op: nothing new to pull.
    expect((await sync(r.cursor, [progress('a-trust-boundaries', 'completed', 2000)])).json().changes).toHaveLength(0);
  });

  it('rejects invalid payloads and oversized batches', async () => {
    const u = await t.login();
    const post = (payload: unknown) => t.app.inject({ method: 'POST', url: '/v1/sync', headers: u.headers, payload: payload as object });
    expect((await post({ cursor: 0, changes: [{ collection: 'users', key: 'x', updatedAt: 1, data: {} }] })).statusCode).toBe(400);
    expect((await post({ cursor: 0, changes: [{ ...progress('x', 'completed', 1), data: { injected: true } }] })).statusCode).toBe(400);
    expect((await post({ cursor: -1, changes: [] })).statusCode).toBe(400);
    const many = Array.from({ length: 501 }, (_, i) => progress(`l-${i}`, 'in_progress', 1));
    expect((await post({ cursor: 0, changes: many })).statusCode).toBe(400);
  });

  it('paginates large pulls', async () => {
    const u = await t.login();
    const batch = (from: number) =>
      Array.from({ length: 500 }, (_, i) => ({
        collection: 'card_reviews',
        key: `dev:${from + i}`,
        updatedAt: 1,
        data: { cardId: 'c', lessonId: 'l', rating: 3, day: '2026-10-18', createdAt: from + i },
      }));
    for (const from of [0, 500, 1000]) await t.app.inject({ method: 'POST', url: '/v1/sync', headers: u.headers, payload: { cursor: 0, changes: batch(from) } });
    const p1 = (await t.app.inject({ method: 'POST', url: '/v1/sync', headers: u.headers, payload: { cursor: 0, changes: [] } })).json();
    expect(p1.changes).toHaveLength(1000);
    expect(p1.hasMore).toBe(true);
    const p2 = (await t.app.inject({ method: 'POST', url: '/v1/sync', headers: u.headers, payload: { cursor: p1.cursor, changes: [] } })).json();
    expect(p2.changes).toHaveLength(500);
    expect(p2.hasMore).toBe(false);
  });
});

describe('account lifecycle', () => {
  it('exports and then deletes all personal data', async () => {
    const u = await t.login('learner', 'leaving@example.test');
    await t.app.inject({ method: 'POST', url: '/v1/sync', headers: u.headers, payload: { cursor: 0, changes: [progress('a-trust-boundaries', 'completed', 1)] } });
    const exp = await t.app.inject({ url: '/v1/me/export', headers: u.headers });
    expect(exp.headers['content-disposition']).toContain('attachment');
    expect(exp.json()).toMatchObject({ user: { email: 'leaving@example.test' }, records: [{ key: 'a-trust-boundaries' }] });

    const del = await t.app.inject({ method: 'DELETE', url: '/v1/me', headers: u.headers });
    expect(del.json()).toEqual({ deleted: true, authAccountDeleted: false });
    const left = await t.db.query('SELECT count(*)::int AS n FROM sync_records WHERE user_id = $1', [u.id]);
    expect(left.rows[0]).toEqual({ n: 0 });
    const users = await t.db.query('SELECT count(*)::int AS n FROM users WHERE id = $1', [u.id]);
    expect(users.rows[0]).toEqual({ n: 0 });
    const audit = await t.db.query<{ actor_id: string }>(`SELECT actor_id FROM audit_logs WHERE action = 'account.deleted'`);
    expect(audit.rows.some((r) => r.actor_id.startsWith('anon:') && !r.actor_id.includes(u.id))).toBe(true);
  });
});

describe('configuration safety', () => {
  it('refuses unsafe production settings', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/AUTH_MODE must be "supabase"/);
    expect(() => loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'supabase', SUPABASE_URL: 'https://x.supabase.co' })).toThrow(/DATABASE_URL/);
    const prod = { NODE_ENV: 'production', AUTH_MODE: 'supabase', SUPABASE_URL: 'https://x.supabase.co', DATABASE_URL: 'postgres://x', CORS_ORIGINS: 'https://app.example' };
    expect(() => loadConfig(prod)).toThrow(/ANALYTICS_SALT/);
    expect(() => loadConfig({ ...prod, ANALYTICS_SALT: 'a-real-random-secret-of-at-least-32-chars' })).not.toThrow();
  });

  it('does not expose the dev token endpoint in supabase mode', async () => {
    const s = await setup({ AUTH_MODE: 'supabase', SUPABASE_URL: 'https://example.supabase.co' });
    const res = await s.app.inject({ method: 'POST', url: '/dev/token', payload: { sub: '00000000-0000-4000-8000-000000000003', email: 'a@b.co' } });
    expect(res.statusCode).toBe(404);
    await s.app.close();
    await s.db.close();
  });

  it('sets security headers and blocks unknown browser origins', async () => {
    const res = await t.app.inject({ url: '/health', headers: { origin: 'https://evil.example' } });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    const ok = await t.app.inject({ url: '/health', headers: { origin: 'http://localhost:8081' } });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:8081');
  });
});

describe('database TLS options', () => {
  it('encrypts by default in production and verifies only with a CA', async () => {
    const { sslOptions } = await import('../src/db');
    const prod = loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'supabase', SUPABASE_URL: 'https://x.supabase.co', DATABASE_URL: 'postgres://x', CORS_ORIGINS: 'https://a.example', ANALYTICS_SALT: 'a-real-random-secret-of-at-least-32-chars' });
    expect(prod.DATABASE_SSL).toBe('require');
    expect(loadConfig({ NODE_ENV: 'test' }).DATABASE_SSL).toBe('off');
    expect(sslOptions({ mode: 'require' })).toEqual({ rejectUnauthorized: false });
    expect(sslOptions({ mode: 'verify', ca: 'PEM' })).toEqual({ rejectUnauthorized: true, ca: 'PEM' });
    expect(() => sslOptions({ mode: 'verify' })).toThrow(/DATABASE_CA_CERT/);
    expect(sslOptions({ mode: 'off' })).toBeUndefined();
  });
});
