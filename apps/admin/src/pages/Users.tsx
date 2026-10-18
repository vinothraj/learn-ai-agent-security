import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Me } from '../App';
import { Badge, Button, Card, ErrorNote, fmtDate, inputCls } from '../components/ui';
import { api, atLeast, download, type Role } from '../lib/api';

interface UserRow {
  id: string;
  email: string | null;
  display_name: string;
  role: Role;
  created_at: string;
  last_seen_at: string;
}

const ROLES: Role[] = ['learner', 'editor', 'admin', 'super_admin'];
const PAGE = 50;

export function UsersPage({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const q = useQuery({ queryKey: ['users', offset], queryFn: () => api<{ users: UserRow[] }>(`/v1/admin/users?limit=${PAGE}&offset=${offset}`) });
  const change = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api(`/v1/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const exportCsv = useMutation({ mutationFn: () => download('/v1/admin/users/export.csv', 'users.csv') });
  const superAdmin = me.role === 'super_admin';
  const canAssign = (target: Role, to: Role) => superAdmin || (!atLeast(target, 'admin') && !atLeast(to, 'admin'));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Users &amp; roles</h1>
          <p className="text-sm text-muted">Viewing this list is recorded in the audit log. Only super-admins can grant or revoke admin roles.</p>
        </div>
        {superAdmin ? (
          <Button kind="secondary" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
            Export CSV
          </Button>
        ) : null}
      </header>
      <ErrorNote error={q.error ?? change.error ?? exportCsv.error} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Joined</th>
                <th className="py-2 pr-4">Last seen</th>
                <th className="py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{u.display_name || '—'}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="py-3 pr-4 text-xs">{fmtDate(u.created_at)}</td>
                  <td className="py-3 pr-4 text-xs">{fmtDate(u.last_seen_at)}</td>
                  <td className="py-3">
                    {u.id === me.id ? (
                      <Badge tone="info">{u.role} (you)</Badge>
                    ) : (
                      <select
                        aria-label={`Role for ${u.email ?? u.id}`}
                        className={`${inputCls} w-40`}
                        value={u.role}
                        disabled={change.isPending}
                        onChange={(e) => change.mutate({ id: u.id, role: e.target.value as Role })}>
                        {ROLES.map((r) => (
                          <option key={r} value={r} disabled={!canAssign(u.role, r)}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-2">
          <Button kind="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            Previous
          </Button>
          <Button kind="secondary" disabled={(q.data?.users.length ?? 0) < PAGE} onClick={() => setOffset(offset + PAGE)}>
            Next
          </Button>
        </div>
      </Card>
    </div>
  );
}
