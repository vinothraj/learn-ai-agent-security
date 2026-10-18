import { contentPack } from '@laas/content';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Badge, Button, Card, Empty, ErrorNote, fmtDate, statusTone } from '../components/ui';
import { api, ApiError, type Role } from '../lib/api';
import { go } from '../lib/router';

export interface VersionRow {
  id: string;
  label: string;
  status: string;
  issues: number;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  review_note: string | null;
  published_at: string | null;
}

export function ContentPage({ role }: { role: Role }) {
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const q = useQuery({ queryKey: ['content'], queryFn: () => api<{ versions: VersionRow[] }>('/v1/admin/content') });
  const published = q.data?.versions.find((v) => v.status === 'published');

  const create = useMutation({
    mutationFn: async (source: 'bundled' | 'published' | { pack: unknown; label: string }) => {
      let pack: unknown;
      let label: string;
      if (source === 'bundled') {
        pack = contentPack;
        label = `${contentPack.version}-draft`;
      } else if (source === 'published') {
        if (!published) throw new ApiError(400, 'Nothing is published yet');
        pack = (await api<{ pack: unknown }>(`/v1/content/packs/${published.id}`)).pack;
        label = `${published.label}-next`;
      } else ({ pack, label } = source);
      return api<{ id: string; issues: string[] }>('/v1/admin/content', { method: 'POST', body: { label: label.slice(0, 40), pack } });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['content'] });
      go(`content/${r.id}`);
    },
  });

  const upload = async (f: File) => {
    try {
      const pack = JSON.parse(await f.text()) as { version?: string };
      create.mutate({ pack, label: `${pack.version ?? 'upload'}-import` });
    } catch {
      create.reset();
      alert('That file is not valid JSON.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Content</h1>
          <p className="text-sm text-muted">
            Editors draft and submit; admins review and publish (four-eyes). Apps download the published pack and fall back to bundled content if anything is invalid.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => create.mutate('bundled')} disabled={create.isPending}>
            New draft from bundled ({contentPack.version})
          </Button>
          <Button kind="secondary" onClick={() => create.mutate('published')} disabled={create.isPending || !published}>
            New draft from published
          </Button>
          <Button kind="secondary" onClick={() => file.current?.click()}>
            Import JSON…
          </Button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
      </header>
      <ErrorNote error={q.error ?? create.error} />
      <Card>
        {q.data?.versions.length === 0 ? <Empty>No versions yet. Start a draft from the bundled content.</Empty> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-4">Version</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Validation</th>
                <th className="py-2 pr-4">Updated</th>
                <th className="py-2 pr-4">Published</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {q.data?.versions.map((v) => (
                <tr key={v.id} className="border-t border-line">
                  <td className="py-3 pr-4 font-semibold">{v.label}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={statusTone(v.status)}>{v.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="py-3 pr-4">{v.issues === 0 ? <Badge tone="ok">valid</Badge> : <Badge tone="bad">{v.issues} issues</Badge>}</td>
                  <td className="py-3 pr-4 text-xs">{fmtDate(v.updated_at)}</td>
                  <td className="py-3 pr-4 text-xs">{fmtDate(v.published_at)}</td>
                  <td className="py-3 text-right">
                    <Button kind="ghost" onClick={() => go(`content/${v.id}`)}>
                      {v.status === 'draft' || v.status === 'rejected' ? 'Edit' : role === 'editor' ? 'View' : 'Review'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
