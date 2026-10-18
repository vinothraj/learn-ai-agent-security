import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Card, ErrorNote } from '../components/ui';
import { api, type Role } from '../lib/api';

interface Flag {
  key: string;
  enabled: boolean;
  description: string;
}

export function SettingsPage({ role }: { role: Role }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['flags'], queryFn: () => api<{ flags: Flag[] }>('/v1/admin/flags') });
  const m = useMutation({
    mutationFn: (f: Flag) => api(`/v1/admin/flags/${f.key}`, { method: 'PATCH', body: { enabled: !f.enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flags'] }),
  });
  const canEdit = role === 'super_admin';
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Feature flags</h1>
        <p className="text-sm text-muted">Apps read these from /v1/config. {canEdit ? 'Changes are audit-logged.' : 'Only super-admins can change flags.'}</p>
      </header>
      <ErrorNote error={q.error ?? m.error} />
      <Card>
        <ul className="divide-y divide-line">
          {q.data?.flags.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="font-mono text-sm">{f.key}</div>
                <div className="text-xs text-muted">{f.description}</div>
              </div>
              {canEdit ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" role="switch" checked={f.enabled} disabled={m.isPending} onChange={() => m.mutate(f)} aria-label={f.key} />
                  {f.enabled ? 'On' : 'Off'}
                </label>
              ) : (
                <Badge tone={f.enabled ? 'ok' : 'muted'}>{f.enabled ? 'On' : 'Off'}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
