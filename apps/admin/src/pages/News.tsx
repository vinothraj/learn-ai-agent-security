import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Card, Empty, ErrorNote, fmtDate, inputCls } from '../components/ui';
import { api } from '../lib/api';

interface Article {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
  categoryLabel: string;
  sourceExcerpt: string;
  interpretation: { summary: string; defense: string; origin: string };
  vulnIds: string[];
  verification: string;
  highImpact: boolean;
  reviewReason: string | null;
}

const TABS = ['pending', 'published', 'rejected'] as const;

function ReviewCard({ a, status }: { a: Article; status: (typeof TABS)[number] }) {
  const qc = useQueryClient();
  const [summary, setSummary] = useState('');
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: (action: 'publish' | 'reject') =>
      api(`/v1/admin/news/${a.id}`, { method: 'PATCH', body: { action, ...(summary.trim() ? { summary: summary.trim() } : {}), ...(reason.trim() ? { reason: reason.trim() } : {}) } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news'] }),
  });
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{a.categoryLabel}</Badge>
        {a.highImpact ? <Badge tone="bad">High impact</Badge> : null}
        <Badge tone={a.verification === 'source_verified' ? 'ok' : 'warn'}>{a.verification === 'source_verified' ? 'Verified source' : 'Unverified'}</Badge>
        {a.vulnIds.map((v) => (
          <Badge key={v} tone="warn">
            {v}
          </Badge>
        ))}
      </div>
      <h3 className="mt-2 text-lg font-bold">{a.title}</h3>
      <p className="text-xs text-muted">
        {a.publisher} · {fmtDate(a.publishedAt)} ·{' '}
        <a className="text-accent hover:underline" href={a.url} target="_blank" rel="noopener noreferrer">
          Open original
        </a>
      </p>
      {a.reviewReason ? <p className="mt-2 text-sm text-warn">Needs review: {a.reviewReason}</p> : null}
      <blockquote className="mt-3 border-l-2 border-line pl-3 text-sm text-muted">{a.sourceExcerpt}</blockquote>
      <p className="mt-3 text-sm">
        <span className="font-semibold text-accent">Interpretation ({a.interpretation.origin}):</span> {a.interpretation.summary}
      </p>
      {status === 'pending' ? (
        <div className="mt-4 space-y-2">
          <textarea className={inputCls} rows={2} placeholder="Optional editor summary after verifying the source (replaces the template text)" value={summary} onChange={(e) => setSummary(e.target.value)} />
          <input className={inputCls} placeholder="Reason (stored in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button disabled={m.isPending} onClick={() => m.mutate('publish')}>
              Verify &amp; publish
            </Button>
            <Button kind="secondary" disabled={m.isPending} onClick={() => m.mutate('reject')}>
              Reject
            </Button>
          </div>
          <ErrorNote error={m.error} />
        </div>
      ) : status === 'published' ? (
        <div className="mt-3">
          <Button kind="secondary" disabled={m.isPending} onClick={() => m.mutate('reject')}>
            Unpublish
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function NewsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('pending');
  const q = useQuery({ queryKey: ['news', tab], queryFn: () => api<{ articles: Article[] }>(`/v1/admin/news?status=${tab}`) });
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">News review</h1>
        <p className="text-sm text-muted">Verify high-impact claims against the original before publishing. Official, non-high-impact items publish automatically.</p>
      </header>
      <div className="flex gap-2" role="tablist">
        {TABS.map((t) => (
          <Button key={t} role="tab" aria-selected={tab === t} kind={tab === t ? 'primary' : 'secondary'} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>
      <ErrorNote error={q.error} />
      {q.data?.articles.length === 0 ? <Empty>Nothing here.</Empty> : null}
      <div className="space-y-4">
        {q.data?.articles.map((a) => (
          <ReviewCard key={a.id} a={a} status={tab} />
        ))}
      </div>
    </div>
  );
}
