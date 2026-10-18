import { createHmac } from 'node:crypto';
import { contentPack as bundledPack } from '@laas/content';
import { addDays, MIN_COHORT, rate, userCount, type ContentPack, type EngagementReport } from '@laas/shared';
import type { Db } from './db';

/** Pseudonymous analytics id: stable per user, not reversible without the server secret. */
export const analyticsId = (salt: string, userId: string) => createHmac('sha256', salt).update(userId).digest('hex').slice(0, 32);

const REVIEW_WINDOW_DAYS = 180;
const utcDay = (d: Date) => d.toISOString().slice(0, 10);
const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);

/**
 * Computes the §16 metrics over [today - days + 1, today] directly in SQL (indexed by type and day).
 * Every user-level figure goes through `userCount` / `rate`, which suppress cohorts under MIN_COHORT.
 * Days are the learner's local calendar day, as reported by the app.
 */
export async function engagementReport(db: Db, { days, now = new Date() }: { days: number; now?: Date }): Promise<EngagementReport> {
  const to = utcDay(now);
  const from = addDays(to, -(days - 1));
  const q = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

  // ---- Active users ----
  const daily = await q<{ day: string; n: number }>(
    `SELECT day::text AS day, count(DISTINCT user_hash)::int AS n FROM analytics_events
     WHERE type = 'active_day' AND value > 0 AND day BETWEEN $1 AND $2 GROUP BY day`,
    [from, to],
  );
  const byDay = new Map(daily.map((r) => [r.day, r.n]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i);
    return { day, users: userCount(byDay.get(day) ?? 0) };
  });
  const distinctSince = async (start: string) =>
    (await q<{ n: number }>(`SELECT count(DISTINCT user_hash)::int AS n FROM analytics_events WHERE type = 'active_day' AND value > 0 AND day BETWEEN $1 AND $2`, [start, to]))[0]!.n;

  // ---- Minutes ----
  const mins = (
    await q<{ seconds: string | null; users: number }>(
      `SELECT sum(value)::text AS seconds, count(DISTINCT user_hash)::int AS users FROM analytics_events
       WHERE type = 'active_day' AND value > 0 AND day BETWEEN $1 AND $2`,
      [from, to],
    )
  )[0]!;
  const totalMinutes = Math.floor(Number(mins.seconds ?? 0) / 60);

  // ---- Lesson completion (completed within 7 days of starting) ----
  const lc = (
    await q<{ started: number; completed: number; users: number }>(
      `SELECT count(*)::int AS started, count(c.key)::int AS completed, count(DISTINCT s.user_hash)::int AS users
       FROM analytics_events s
       LEFT JOIN analytics_events c ON c.user_hash = s.user_hash AND c.type = 'lesson_completed' AND c.subject = s.subject
         AND c.day BETWEEN s.day AND s.day + 7
       WHERE s.type = 'lesson_started' AND s.day BETWEEN $1 AND $2`,
      [from, to],
    )
  )[0]!;

  // ---- Quiz average (first attempt) ----
  const quiz = (
    await q<{ avg: string | null; n: number; users: number }>(
      `SELECT avg(value)::text AS avg, count(*)::int AS n, count(DISTINCT user_hash)::int AS users FROM analytics_events
       WHERE type = 'quiz_first_attempt' AND day BETWEEN $1 AND $2`,
      [from, to],
    )
  )[0]!;

  // ---- Lab completion (reached a pass/fail result) ----
  const lab = (
    await q<{ started: number; finished: number; users: number }>(
      `SELECT count(*)::int AS started, count(r.key)::int AS finished, count(DISTINCT s.user_hash)::int AS users
       FROM analytics_events s
       LEFT JOIN analytics_events r ON r.user_hash = s.user_hash AND r.type = 'lab_result' AND r.subject = s.subject AND r.day >= s.day
       WHERE s.type = 'lab_started' AND s.day BETWEEN $1 AND $2`,
      [from, to],
    )
  )[0]!;

  // ---- Retention: weekly cohorts (Monday start) of learners first active in the window.
  // Dn = % of the cohort's learners for whom day N has passed who were active exactly N days after their first day.
  const cohorts = await q<{ cohort: string; size: number; e1: number; d1: number; e7: number; d7: number; e30: number; d30: number }>(
    `WITH active AS (SELECT DISTINCT user_hash, day FROM analytics_events WHERE type = 'active_day' AND value > 0),
          firsts AS (SELECT user_hash, min(day) AS first FROM active GROUP BY user_hash),
          marked AS (
            SELECT f.first, (f.first - ((extract(isodow FROM f.first)::int) - 1)) AS week,
              EXISTS (SELECT 1 FROM active a WHERE a.user_hash = f.user_hash AND a.day = f.first + 1) AS r1,
              EXISTS (SELECT 1 FROM active a WHERE a.user_hash = f.user_hash AND a.day = f.first + 7) AS r7,
              EXISTS (SELECT 1 FROM active a WHERE a.user_hash = f.user_hash AND a.day = f.first + 30) AS r30
            FROM firsts f WHERE f.first BETWEEN $1 AND $2)
     SELECT week::text AS cohort, count(*)::int AS size,
       count(*) FILTER (WHERE first + 1 <= $2::date)::int AS e1, count(*) FILTER (WHERE first + 1 <= $2::date AND r1)::int AS d1,
       count(*) FILTER (WHERE first + 7 <= $2::date)::int AS e7, count(*) FILTER (WHERE first + 7 <= $2::date AND r7)::int AS d7,
       count(*) FILTER (WHERE first + 30 <= $2::date)::int AS e30, count(*) FILTER (WHERE first + 30 <= $2::date AND r30)::int AS d30
     FROM marked GROUP BY week ORDER BY week`,
    [from, to],
  );
  const retention = cohorts.map((c) => ({
    cohort: c.cohort,
    size: userCount(c.size),
    d1: rate(c.d1, c.e1).value,
    d7: rate(c.d7, c.e7).value,
    d30: rate(c.d30, c.e30).value,
  }));

  // ---- Content in use: the published pack, else the bundled one ----
  const published = (await q<{ label: string; pack: ContentPack }>(`SELECT label, pack FROM content_versions WHERE status = 'published'`))[0];
  const pack = published?.pack ?? bundledPack;

  // ---- Roadmap drop-off: of users who started lesson 1, % who started each later lesson ----
  const starts = await q<{ user_hash: string; subject: string }>(
    `SELECT DISTINCT user_hash, subject FROM analytics_events WHERE type = 'lesson_started' AND day BETWEEN $1 AND $2`,
    [from, to],
  );
  const startedBy = new Map<string, Set<string>>();
  for (const s of starts) startedBy.set(s.subject, (startedBy.get(s.subject) ?? new Set()).add(s.user_hash));
  const lessonTitle = new Map(pack.lessons.map((l) => [l.id, l.title]));
  const roadmapDropoff = pack.roadmaps
    .filter((r) => r.lessonIds.length > 0)
    .map((r) => {
      const starters = startedBy.get(r.lessonIds[0]!) ?? new Set<string>();
      const enough = starters.size >= MIN_COHORT;
      return {
        roadmapId: r.id,
        title: r.title,
        starters: userCount(starters.size),
        steps: r.lessonIds.map((id) => {
          const reached = [...(startedBy.get(id) ?? [])].filter((u) => starters.has(u)).length;
          return { lessonId: id, title: lessonTitle.get(id) ?? id, reached: enough ? pct(reached, starters.size) : null };
        }),
      };
    });

  // ---- Notifications: server push tap rate; local taps are counted on opt-in devices ----
  const push = (
    await q<{ sent: number; tapped: number; users: number }>(
      `SELECT count(*) FILTER (WHERE status = 'sent')::int AS sent, count(*) FILTER (WHERE status = 'sent' AND tapped_at IS NOT NULL)::int AS tapped,
              count(DISTINCT user_id) FILTER (WHERE status = 'sent')::int AS users
       FROM notifications WHERE created_at >= $1::date AND created_at < $2::date + 1`,
      [from, to],
    )
  )[0]!;
  const taps = (
    await q<{ n: number; users: number }>(
      `SELECT count(*)::int AS n, count(DISTINCT user_hash)::int AS users FROM analytics_events WHERE type = 'notification_tap' AND day BETWEEN $1 AND $2`,
      [from, to],
    )
  )[0]!;

  // ---- Freshness ----
  const cutoff = addDays(to, -REVIEW_WINDOW_DAYS);
  const reviewed = pack.lessons.filter((l) => l.reviewedOn && l.reviewedOn >= cutoff).length;
  const sources = await q<{ name: string; runs: number; ok: number }>(
    `SELECT s.name, count(r.id)::int AS runs, count(r.id) FILTER (WHERE r.status IN ('ok', 'not_modified'))::int AS ok
     FROM news_sources s LEFT JOIN ingestion_runs r ON r.source_id = s.id AND r.started_at >= $1::date AND r.status <> 'running'
     WHERE s.enabled GROUP BY s.name ORDER BY s.name`,
    [from],
  );

  return {
    window: { from, to, days },
    minCohort: MIN_COHORT,
    active: { dau: userCount(byDay.get(to) ?? 0), wau: userCount(await distinctSince(addDays(to, -6))), mau: userCount(await distinctSince(addDays(to, -29))), series },
    minutes: {
      total: mins.users >= MIN_COHORT ? totalMinutes : null,
      perActiveUser: mins.users >= MIN_COHORT ? Math.round((totalMinutes / mins.users) * 10) / 10 : null,
    },
    lessonCompletion: rate(lc.completed, lc.started, lc.users),
    quizAverage: quiz.users >= MIN_COHORT ? { value: Math.round(Number(quiz.avg) * 10) / 10, attempts: quiz.n } : { value: null, attempts: null },
    labCompletion: rate(lab.finished, lab.started, lab.users),
    retention,
    roadmapDropoff,
    notifications: { push: rate(push.tapped, push.sent, push.users), localTaps: taps.users >= MIN_COHORT ? taps.n : null },
    freshness: {
      lessons: { reviewed, total: pack.lessons.length, pct: pct(reviewed, pack.lessons.length) ?? 0 },
      reviewWindowDays: REVIEW_WINDOW_DAYS,
      packLabel: published?.label ?? 'bundled',
      sources: sources.map((s) => ({ ...s, successRate: pct(s.ok, s.runs) })),
    },
  };
}
