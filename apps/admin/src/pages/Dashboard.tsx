import { useQuery } from '@tanstack/react-query';
import { Card, ErrorNote, fmtDate, Stat } from '../components/ui';
import { api } from '../lib/api';

interface Overview {
  users: { total: number; activeLast7Days: number; newLast7Days: number };
  news: { pendingReview: number; publishedLast7Days: number };
  ingestion: { failingSources: number; enabledSources: number; lastRunAt: string | null };
  content: { publishedLabel: string | null; drafts: number; inReview: number };
}

export function DashboardPage() {
  const q = useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/v1/admin/overview'), refetchInterval: 60_000 });
  if (q.error) return <ErrorNote error={q.error} />;
  const o = q.data;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <p className="text-sm text-muted">Aggregate figures only. Individual learner activity is not shown here.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Learners" value={o?.users.total ?? '…'} hint={o ? `${o.users.newLast7Days} new in 7 days` : undefined} />
        <Stat label="Active (7 days)" value={o?.users.activeLast7Days ?? '…'} hint="Signed-in users seen by the API" />
        <Stat label="News awaiting review" value={o?.news.pendingReview ?? '…'} tone={o && o.news.pendingReview > 0 ? 'warn' : undefined} hint={o ? `${o.news.publishedLast7Days} published in 7 days` : undefined} />
        <Stat
          label="Failing sources"
          value={o ? `${o.ingestion.failingSources}/${o.ingestion.enabledSources}` : '…'}
          tone={o && o.ingestion.failingSources > 0 ? 'bad' : undefined}
          hint={o ? `Last run ${fmtDate(o.ingestion.lastRunAt)}` : undefined}
        />
      </div>
      <Card title="Content">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Published pack" value={o?.content.publishedLabel ?? 'Bundled'} hint="What apps download over the air" />
          <Stat label="Drafts" value={o?.content.drafts ?? '…'} />
          <Stat label="In review" value={o?.content.inReview ?? '…'} tone={o && o.content.inReview > 0 ? 'warn' : undefined} />
        </div>
      </Card>
      <p className="text-sm">
        <a className="text-accent hover:underline" href="#/analytics">
          Engagement: retention, completion and drop-off →
        </a>
      </p>
    </div>
  );
}
