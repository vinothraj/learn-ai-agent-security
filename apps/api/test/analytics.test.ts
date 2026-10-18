import { contentPack } from '@laas/content';
import { addDays, startOfWeek, type AnalyticsEvent, type EngagementReport } from '@laas/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers';

let t: TestCtx;
beforeAll(async () => {
  t = await setup();
});
afterAll(async () => {
  await t.app.close();
  await t.db.close();
});

const T = new Date().toISOString().slice(0, 10);
const d = (n: number) => addDays(T, n);
const roadmap = contentPack.roadmaps.find((r) => r.lessonIds.length >= 2)!;
const [L0, L1] = roadmap.lessonIds as [string, string];
const LAB = contentPack.labs[0]!.id;

const active = (day: string, seconds: number): AnalyticsEvent => ({ key: `ad:${day}`, type: 'active_day', subject: '', value: seconds, day });
const ev = (type: AnalyticsEvent['type'], prefix: string, subject: string, day: string, value: number | null = null): AnalyticsEvent => ({
  key: `${prefix}:${subject}`,
  type,
  subject,
  value,
  day,
});

async function report(headers: { authorization: string }) {
  const res = await t.app.inject({ url: '/v1/admin/analytics?days=30', headers });
  expect(res.statusCode).toBe(200);
  return res.json() as EngagementReport;
}

describe('analytics (seeded dataset)', () => {
  const users: { id: string; headers: { authorization: string } }[] = [];
  const send = (i: number, events: AnalyticsEvent[]) => t.app.inject({ method: 'POST', url: '/v1/events', headers: users[i]!.headers, payload: { events } });

  it('accepts only valid, minimal events', async () => {
    const u = await t.login();
    const bad = (e: object) => t.app.inject({ method: 'POST', url: '/v1/events', headers: u.headers, payload: { events: [e] } });
    expect((await bad({ ...active(T, 10), subject: 'Free text here' })).statusCode).toBe(400);
    expect((await bad({ ...active(T, 10), type: 'page_view' })).statusCode).toBe(400);
    expect((await bad({ ...active(T, 10), email: 'a@b.co' })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'POST', url: '/v1/events', payload: { events: [] } })).statusCode).toBe(401);
    // Days far outside the server clock are dropped, not stored.
    expect((await t.app.inject({ method: 'POST', url: '/v1/events', headers: u.headers, payload: { events: [active('2001-01-01', 10)] } })).json()).toEqual({ accepted: 0 });
    // Events are stored under a pseudonymous id, never the user id.
    await t.app.inject({ method: 'POST', url: '/v1/events', headers: u.headers, payload: { events: [active(d(-40), 5)] } });
    const ids = (await t.db.query<{ user_hash: string }>('SELECT DISTINCT user_hash FROM analytics_events')).rows.map((r) => r.user_hash);
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toContain(u.id);
    expect(ids[0]).toMatch(/^[0-9a-f]{32}$/);
  });

  it('computes every §16 metric exactly', async () => {
    for (let i = 0; i < 7; i++) users.push(await t.login());
    // Six learners first active 10 days ago; five come back the next day, three a week later; one today.
    for (let i = 0; i < 6; i++) {
      const events: AnalyticsEvent[] = [active(d(-10), 600), ev('lesson_started', 'ls', L0, d(-10))];
      if (i < 5) events.push(active(d(-9), 600));
      if (i < 3) events.push(active(d(-3), 600), ev('lesson_started', 'ls', L1, d(-3)));
      if (i === 0) events.push(active(T, 300));
      if (i < 4) events.push(ev('lesson_completed', 'lc', L0, d(-9)));
      if (i === 4) events.push(ev('lesson_completed', 'lc', L0, T)); // 10 days later: outside the 7-day window
      if (i < 5) events.push(ev('quiz_first_attempt', 'qf', L0, d(-9), [100, 80, 60, 40, 20][i]!), ev('lab_started', 'lb', LAB, d(-8)));
      if (i < 4) events.push(ev('lab_result', 'lr', LAB, d(-8), i % 2));
      expect((await send(i, events)).json()).toEqual({ accepted: events.length });
    }
    // A seventh learner forms a cohort of one, which must be suppressed.
    await send(6, [active(d(-2), 900)]);
    // Re-sending is idempotent; a larger active_day total replaces the smaller one.
    await send(0, [active(d(-10), 600), ev('lesson_completed', 'lc', L0, d(-9))]);
    await send(0, [active(T, 120)]); // smaller total for today: ignored

    const admin = await t.login('admin');
    const r = await report(admin.headers);

    expect(r.window).toEqual({ from: d(-29), to: T, days: 30 });
    expect(r.active.mau).toBe(7);
    expect(r.active.wau).toBeNull(); // 3 learners in the last 7 days (< 5)
    expect(r.active.dau).toBeNull();
    expect(r.active.series.find((s) => s.day === d(-10))!.users).toBe(6);
    expect(r.active.series.find((s) => s.day === d(-9))!.users).toBe(5);
    expect(r.active.series.find((s) => s.day === d(-3))!.users).toBeNull();

    // (6×600 + 5×600 + 3×600 + 300 + 900) s = 9600 s = 160 min over 7 learners.
    expect(r.minutes).toEqual({ total: 160, perActiveUser: 22.9 });
    // 9 starts (6 of L0, 3 of L1); 4 completions within 7 days (the 5th came 10 days later).
    expect(r.lessonCompletion).toEqual({ value: 44.4, numerator: 4, denominator: 9 });
    expect(r.quizAverage).toEqual({ value: 60, attempts: 5 });
    expect(r.labCompletion).toEqual({ value: 80, numerator: 4, denominator: 5 });

    // Weekly cohorts start on Monday; d30 is not observable yet for anyone.
    const c10 = r.retention.find((c) => c.cohort === startOfWeek(d(-10)))!;
    expect(c10).toEqual({ cohort: startOfWeek(d(-10)), size: 6, d1: 83.3, d7: 50, d30: null });
    expect(r.retention.find((c) => c.cohort === startOfWeek(d(-2)))).toEqual({ cohort: startOfWeek(d(-2)), size: null, d1: null, d7: null, d30: null });

    const drop = r.roadmapDropoff.find((x) => x.roadmapId === roadmap.id)!;
    expect(drop.starters).toBe(6);
    expect(drop.steps[0]!.reached).toBe(100);
    expect(drop.steps[1]!.reached).toBe(50);
    expect(r.roadmapDropoff.filter((x) => x.roadmapId !== roadmap.id).every((x) => x.starters === null)).toBe(true);

    expect(r.notifications).toEqual({ push: { value: null, numerator: null, denominator: null }, localTaps: null });
    expect(r.freshness.lessons.total).toBe(contentPack.lessons.length);
    expect(r.freshness.packLabel).toBe('bundled');
    expect(r.minCohort).toBe(5);
  });

  it('is admin-only, and withdrawing consent deletes shared events', async () => {
    expect((await t.app.inject({ url: '/v1/admin/analytics', headers: users[0]!.headers })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'DELETE', url: '/v1/me/analytics', headers: users[5]!.headers })).json()).toEqual({ deleted: 2 });
    const admin = await t.login('admin');
    const r = await report(admin.headers);
    expect(r.retention.find((c) => c.cohort === startOfWeek(d(-10)))!.size).toBe(5);
  });

  it('removes analytics with the account and includes them in the export', async () => {
    const exp = (await t.app.inject({ url: '/v1/me/export', headers: users[6]!.headers })).json() as { analytics: unknown[] };
    expect(exp.analytics).toEqual([{ key: `ad:${d(-2)}`, type: 'active_day', subject: '', value: 900, day: d(-2) }]);
    await t.app.inject({ method: 'DELETE', url: '/v1/me', headers: users[6]!.headers });
    const admin = await t.login('admin');
    expect((await report(admin.headers)).retention.find((c) => c.cohort === startOfWeek(d(-2)))).toBeUndefined();
  });
});
