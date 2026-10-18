import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Card, ErrorNote, Field, fmtDate, inputCls, statusTone } from '../components/ui';
import { api } from '../lib/api';

interface Source {
  id: string;
  name: string;
  feed_url: string;
  publisher: string;
  allowed_domains: string[];
  trust: string;
  enabled: boolean;
  fetch_interval_minutes: number;
  last_fetched_at: string | null;
  last_status: string | null;
  last_error: string | null;
}
interface Run {
  id: number;
  source: string;
  started_at: string;
  status: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  rejected: number;
  error: string | null;
}

function AddSource() {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', feedUrl: '', publisher: '', domains: '', trust: 'community', requireAiRelevance: true });
  const m = useMutation({
    mutationFn: () =>
      api('/v1/admin/news-sources', {
        method: 'POST',
        body: { name: f.name, feedUrl: f.feedUrl, publisher: f.publisher, allowedDomains: f.domains.split(',').map((d) => d.trim()).filter(Boolean), trust: f.trust, requireAiRelevance: f.requireAiRelevance },
      }),
    onSuccess: () => {
      setF({ name: '', feedUrl: '', publisher: '', domains: '', trust: 'community', requireAiRelevance: true });
      qc.invalidateQueries({ queryKey: ['sources'] });
    },
  });
  return (
    <Card title="Add a source">
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}>
        <Field label="Name">
          <input className={inputCls} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Publisher">
          <input className={inputCls} required value={f.publisher} onChange={(e) => setF({ ...f, publisher: e.target.value })} />
        </Field>
        <Field label="Feed URL (https RSS or Atom)" hint="Only add feeds you are permitted to use; respect each site's terms.">
          <input className={inputCls} type="url" required pattern="https://.*" value={f.feedUrl} onChange={(e) => setF({ ...f, feedUrl: e.target.value })} />
        </Field>
        <Field label="Allowed article domains" hint="Comma-separated. Items linking elsewhere are rejected.">
          <input className={inputCls} required value={f.domains} onChange={(e) => setF({ ...f, domains: e.target.value })} />
        </Field>
        <Field label="Trust" hint="Only official sources can auto-publish (and never high-impact items).">
          <select className={inputCls} value={f.trust} onChange={(e) => setF({ ...f, trust: e.target.value })}>
            <option value="official">official</option>
            <option value="community">community</option>
            <option value="research">research</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={f.requireAiRelevance} onChange={(e) => setF({ ...f, requireAiRelevance: e.target.checked })} />
          Keep only AI-related items
        </label>
        <div className="md:col-span-2">
          <ErrorNote error={m.error} />
          <Button type="submit" disabled={m.isPending} className="mt-2">
            Add source
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function SourcesPage() {
  const qc = useQueryClient();
  const sources = useQuery({ queryKey: ['sources'], queryFn: () => api<{ sources: Source[] }>('/v1/admin/news-sources') });
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => api<{ runs: Run[] }>('/v1/admin/ingestion-runs') });
  const toggle = useMutation({
    mutationFn: (s: Source) => api(`/v1/admin/news-sources/${s.id}`, { method: 'PATCH', body: { enabled: !s.enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }),
  });
  const run = useMutation({
    mutationFn: (s: Source) => api(`/v1/admin/news-sources/${s.id}/run`, { method: 'POST' }),
    onSettled: () => qc.invalidateQueries(),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Sources &amp; ingestion</h1>
        <p className="text-sm text-muted">Feeds are fetched over HTTPS with size, time and rate limits. Article text is treated as untrusted data.</p>
      </header>
      <Card title="Sources">
        <ErrorNote error={sources.error ?? toggle.error ?? run.error} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Trust</th>
                <th className="py-2 pr-4">Every</th>
                <th className="py-2 pr-4">Last run</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {sources.data?.sources.map((s) => (
                <tr key={s.id} className="border-t border-line align-top">
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{s.name}</div>
                    <div className="max-w-xs truncate text-xs text-muted">{s.feed_url}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={s.trust === 'official' ? 'ok' : 'muted'}>{s.trust}</Badge>
                  </td>
                  <td className="py-3 pr-4">{Math.round(s.fetch_interval_minutes / 60)} h</td>
                  <td className="py-3 pr-4 text-xs">{fmtDate(s.last_fetched_at)}</td>
                  <td className="py-3 pr-4">
                    {s.enabled ? <Badge tone={statusTone(s.last_status ?? '')}>{s.last_status ?? 'never'}</Badge> : <Badge>disabled</Badge>}
                    {s.last_error ? <div className="mt-1 max-w-xs text-xs text-bad">{s.last_error}</div> : null}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <Button kind="ghost" disabled={run.isPending} onClick={() => run.mutate(s)}>
                      Run now
                    </Button>
                    <Button kind="ghost" onClick={() => toggle.mutate(s)}>
                      {s.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <AddSource />
      <Card title="Recent runs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Fetched</th>
                <th className="py-2 pr-4">New</th>
                <th className="py-2 pr-4">Dupes</th>
                <th className="py-2">Rejected</th>
              </tr>
            </thead>
            <tbody>
              {runs.data?.runs.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2 pr-4 text-xs">{fmtDate(r.started_at)}</td>
                  <td className="py-2 pr-4">{r.source}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    {r.error ? <span className="ml-2 text-xs text-bad">{r.error}</span> : null}
                  </td>
                  <td className="py-2 pr-4">{r.fetched}</td>
                  <td className="py-2 pr-4">{r.inserted}</td>
                  <td className="py-2 pr-4">{r.duplicates}</td>
                  <td className="py-2">{r.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
