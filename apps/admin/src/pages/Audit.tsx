import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, ErrorNote, fmtDate } from '../components/ui';
import { api } from '../lib/api';

interface Entry {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export function AuditPage() {
  const [offset, setOffset] = useState(0);
  const q = useQuery({ queryKey: ['audit', offset], queryFn: () => api<{ entries: Entry[] }>(`/v1/admin/audit?limit=100&offset=${offset}`) });
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Audit log</h1>
        <p className="text-sm text-muted">Append-only: the database rejects edits and deletions. Deleted accounts appear as pseudonymous ids.</p>
      </header>
      <ErrorNote error={q.error} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Actor</th>
                <th className="py-2 pr-4">Target</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.entries.map((e) => (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="py-2 pr-4 text-xs whitespace-nowrap">{fmtDate(e.created_at)}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{e.action}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted">{e.actor_id ? e.actor_id.slice(0, 13) : 'system'}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted">{e.target_type ? `${e.target_type}:${(e.target_id ?? '').slice(0, 13)}` : '—'}</td>
                  <td className="py-2 font-mono text-xs text-muted">{Object.keys(e.meta ?? {}).length ? JSON.stringify(e.meta).slice(0, 160) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-2">
          <Button kind="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>
            Newer
          </Button>
          <Button kind="secondary" disabled={(q.data?.entries.length ?? 0) < 100} onClick={() => setOffset(offset + 100)}>
            Older
          </Button>
        </div>
      </Card>
    </div>
  );
}
