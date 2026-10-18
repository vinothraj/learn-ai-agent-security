import type { EngagementReport, Rate } from '@laas/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Empty, ErrorNote, Stat } from '../components/ui';
import { api } from '../lib/api';

const SUPPRESSED = 'Hidden: fewer than 5 learners';
const n = (v: number | null | undefined) => (v === null || v === undefined ? '<5' : v.toLocaleString());
const p = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);
const rateHint = (r: Rate, what: string) => (r.value === null ? SUPPRESSED : `${r.numerator} of ${r.denominator} ${what}`);

/** Heat colour for a retention or funnel percentage. */
const heat = (v: number | null) => (v === null ? undefined : { backgroundColor: `color-mix(in oklab, var(--color-accent) ${Math.round(15 + v * 0.7)}%, transparent)` });

function ActiveChart({ series }: { series: EngagementReport['active']['series'] }) {
  const max = Math.max(5, ...series.map((s) => s.users ?? 0));
  return (
    <div>
      <div className="flex h-40 items-end gap-[3px]" role="img" aria-label="Daily active learners">
        {series.map((s) => (
          <div key={s.day} className="group relative flex-1" title={`${s.day}: ${s.users === null ? 'fewer than 5' : s.users} learners`}>
            <div
              className={s.users === null ? 'rounded-t bg-line' : 'rounded-t bg-accent'}
              style={{ height: `${s.users === null ? 4 : Math.max(4, (s.users / max) * 160)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{series[0]?.day}</span>
        <span>{series[series.length - 1]?.day}</span>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['analytics', days], queryFn: () => api<EngagementReport>(`/v1/admin/analytics?days=${days}`), refetchInterval: 5 * 60_000 });
  if (q.error) return <ErrorNote error={q.error} />;
  const r = q.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Engagement</h1>
          <p className="text-sm text-muted">
            From learners who opted in to usage statistics. Figures covering fewer than {r?.minCohort ?? 5} learners are hidden.
            {r ? ` ${r.window.from} to ${r.window.to}.` : ''}
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Time window">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${days === d ? 'bg-accent/15 text-accent' : 'text-muted hover:text-ink'}`}>
              {d} days
            </button>
          ))}
        </div>
      </header>

      {!r ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="DAU (today)" value={n(r.active.dau)} hint="Learners with study time today" />
            <Stat label="WAU" value={n(r.active.wau)} hint="Rolling 7 days" />
            <Stat label="MAU" value={n(r.active.mau)} hint="Rolling 30 days" />
            <Stat label="Learning minutes" value={n(r.minutes.total)} hint={r.minutes.perActiveUser === null ? SUPPRESSED : `${r.minutes.perActiveUser} per active learner`} />
          </div>

          <Card title="Daily active learners">
            <ActiveChart series={r.active.series} />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Lesson completion" value={p(r.lessonCompletion.value)} hint={rateHint(r.lessonCompletion, 'starts completed within 7 days')} />
            <Stat label="Quiz average" value={p(r.quizAverage.value)} hint={r.quizAverage.attempts === null ? SUPPRESSED : `First attempts: ${r.quizAverage.attempts}`} />
            <Stat label="Lab completion" value={p(r.labCompletion.value)} hint={rateHint(r.labCompletion, 'labs reached a result')} />
            <Stat
              label="Push tap rate"
              value={p(r.notifications.push.value)}
              hint={r.notifications.push.value === null ? SUPPRESSED : `${r.notifications.push.numerator} taps of ${r.notifications.push.denominator} delivered`}
            />
          </div>

          <Card title="Retention by first-active week">
            {r.retention.length === 0 ? (
              <Empty>No new learners in this window.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-2 pr-4">Week of</th>
                      <th className="py-2 pr-4">Learners</th>
                      <th className="py-2 pr-4">Day 1</th>
                      <th className="py-2 pr-4">Day 7</th>
                      <th className="py-2 pr-4">Day 30</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.retention.map((c) => (
                      <tr key={c.cohort} className="border-t border-line">
                        <td className="py-2 pr-4 font-mono text-xs">{c.cohort}</td>
                        <td className="py-2 pr-4">{n(c.size)}</td>
                        {[c.d1, c.d7, c.d30].map((v, i) => (
                          <td key={i} className="py-1 pr-2">
                            <span className="block rounded px-2 py-1 text-center" style={heat(v)}>
                              {p(v)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted">“—” means hidden (small cohort) or not observable yet.</p>
              </div>
            )}
          </Card>

          <Card title="Roadmap drop-off">
            <p className="mb-4 text-xs text-muted">Of learners who started a roadmap’s first lesson, the share who started each later lesson.</p>
            <div className="space-y-5">
              {r.roadmapDropoff.map((rm) => (
                <div key={rm.roadmapId}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold">{rm.title}</h3>
                    <span className="text-xs text-muted">{rm.starters === null ? SUPPRESSED : `${rm.starters} starters`}</span>
                  </div>
                  {rm.starters !== null ? (
                    <ol className="space-y-1">
                      {rm.steps.map((s, i) => (
                        <li key={s.lessonId} className="flex items-center gap-3 text-sm">
                          <span className="w-6 text-right text-xs text-muted">{i + 1}</span>
                          <span className="w-64 truncate" title={s.title}>
                            {s.title}
                          </span>
                          <span className="h-2 flex-1 rounded-full bg-surface-2">
                            <span className="block h-2 rounded-full bg-accent" style={{ width: `${s.reached ?? 0}%` }} />
                          </span>
                          <span className="w-14 text-right tabular-nums">{p(s.reached)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Content freshness">
            <div className="grid gap-4 sm:grid-cols-2">
              <Stat
                label="Lessons reviewed recently"
                value={`${r.freshness.lessons.pct}%`}
                hint={`${r.freshness.lessons.reviewed} of ${r.freshness.lessons.total} lessons expert-reviewed in the last ${r.freshness.reviewWindowDays} days (pack: ${r.freshness.packLabel})`}
                tone={r.freshness.lessons.pct < 50 ? 'warn' : undefined}
              />
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Ingestion success by source</div>
                <ul className="space-y-1 text-sm">
                  {r.freshness.sources.map((s) => (
                    <li key={s.name} className="flex justify-between gap-3">
                      <span className="truncate">{s.name}</span>
                      <span className={s.successRate !== null && s.successRate < 80 ? 'text-bad' : 'text-muted'}>
                        {s.runs === 0 ? 'no runs' : `${p(s.successRate)} of ${s.runs}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
          <p className="text-xs text-muted">
            Local notification taps (opted-in devices): {n(r.notifications.localTaps)}. Definitions follow MASTER_PROMPT §16; days are the learner’s local day.
          </p>
        </>
      )}
    </div>
  );
}
