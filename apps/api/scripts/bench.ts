/**
 * Repeatable in-process benchmark of the hot API paths against embedded PGlite.
 * Run: npx tsx scripts/bench.ts   (numbers are a floor: production Postgres is faster than PGlite)
 */
import { randomUUID } from 'node:crypto';
import { addDays } from '@laas/shared';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { pgliteDb } from '../src/db';
import { migrate } from '../src/db/migrations';

const config = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'dev', PGLITE_DIR: 'memory', RATE_LIMIT_PER_MINUTE: '100000' });
const db = await pgliteDb('memory');
await migrate(db);
const app = await buildApp({ config, db, push: null });

async function token(role = 'learner') {
  const res = await app.inject({ method: 'POST', url: '/dev/token', payload: { sub: randomUUID(), email: `${randomUUID().slice(0, 8)}@example.test`, role } });
  return { authorization: `Bearer ${(res.json() as { accessToken: string }).accessToken}` };
}

async function time(label: string, runs: number, fn: () => Promise<{ statusCode: number }>) {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    const r = await fn();
    samples.push(performance.now() - t);
    if (r.statusCode >= 400) throw new Error(`${label}: HTTP ${r.statusCode}`);
  }
  samples.sort((a, b) => a - b);
  const p = (q: number) => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))]!.toFixed(1);
  console.log(`${label.padEnd(44)} p50 ${p(0.5).padStart(7)} ms   p95 ${p(0.95).padStart(7)} ms   (n=${runs})`);
}

const today = new Date().toISOString().slice(0, 10);
const now = Date.now();

// ---- Sync: 500-change push (the maximum batch), then incremental pulls ----
const learner = await token();
const changes = Array.from({ length: 500 }, (_, i) => ({
  collection: 'question_responses',
  key: `bench:qr:${i}`,
  updatedAt: now,
  data: { questionId: `q-${i % 40}`, lessonId: 'b-prompt-injection', source: 'lesson', correct: i % 3 !== 0, day: today, createdAt: now - i },
}));
let round = 0;
await time('POST /v1/sync (500 new changes)', 10, () =>
  app.inject({ method: 'POST', url: '/v1/sync', headers: learner, payload: { cursor: 0, changes: changes.map((c) => ({ ...c, key: `${c.key}:${round++}` })) } }),
);
await time('POST /v1/sync (no changes, full pull)', 30, () => app.inject({ method: 'POST', url: '/v1/sync', headers: learner, payload: { cursor: 0, changes: [] } }));

// ---- Public reads ----
await time('GET /v1/config', 100, () => app.inject('/v1/config'));
await time('GET /v1/news', 100, () => app.inject('/v1/news'));
await time('GET /v1/content/manifest', 100, () => app.inject('/v1/content/manifest'));

// ---- Tutor (deterministic path) ----
await time('POST /v1/ai/tutor (AI off, lesson answer)', 15, () =>
  app.inject({ method: 'POST', url: '/v1/ai/tutor', headers: learner, payload: { question: 'How do I defend an agent against MCP tool poisoning?' } }),
);

// ---- Analytics: 1,000 opted-in learners × ~20 events over 30 days ----
const values: unknown[] = [];
const rows: string[] = [];
let n = 0;
for (let u = 0; u < 1000; u++) {
  const user = `bench${u}`.padEnd(32, '0');
  const first = -(u % 29);
  for (let d = 0; d < 12; d++) {
    if ((u + d) % 3 === 0) continue;
    const day = addDays(today, Math.min(0, first + d));
    rows.push(`($${++n}, $${++n}, 'active_day', '', $${++n}, $${++n})`);
    values.push(user, `ad:${day}`, 300 + ((u * 7 + d) % 900), day);
  }
  for (const [k, lesson] of ['c-excessive-agency', 'c-mcp-security', 'c-human-approval'].entries()) {
    if (u % (k + 2) === 1) continue;
    const day = addDays(today, Math.min(0, first + k));
    rows.push(`($${++n}, $${++n}, 'lesson_started', $${++n}, NULL, $${++n})`);
    values.push(user, `ls:${lesson}`, lesson, day);
  }
  if (rows.length > 3000) {
    await db.query(`INSERT INTO analytics_events (user_hash, key, type, subject, value, day) VALUES ${rows.join(',')} ON CONFLICT DO NOTHING`, values);
    rows.length = 0;
    values.length = 0;
    n = 0;
  }
}
if (rows.length) await db.query(`INSERT INTO analytics_events (user_hash, key, type, subject, value, day) VALUES ${rows.join(',')} ON CONFLICT DO NOTHING`, values);
const count = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM analytics_events')).rows[0]!.n;
const admin = await token('admin');
await time(`GET /v1/admin/analytics?days=30 (${count} events)`, 10, () => app.inject({ url: '/v1/admin/analytics?days=30', headers: admin }));

await app.close();
await db.close();
