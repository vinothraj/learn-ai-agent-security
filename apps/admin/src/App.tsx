import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { Button } from './components/ui';
import { api, atLeast, auth, getSession, type Role } from './lib/api';
import { go, useRoute } from './lib/router';
import { AuditPage } from './pages/Audit';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { NewsPage } from './pages/News';
import { SettingsPage } from './pages/Settings';
import { SourcesPage } from './pages/Sources';
import { UsersPage } from './pages/Users';

// The CMS pages bundle the full content pack and validator; load them only when needed.
const ContentPage = lazy(() => import('./pages/Content').then((m) => ({ default: m.ContentPage })));
const ContentEditorPage = lazy(() => import('./pages/ContentEditor').then((m) => ({ default: m.ContentEditorPage })));

export interface Me {
  id: string;
  email: string | null;
  role: Role;
  displayName: string;
}

const NAV: { path: string; label: string; min: Role }[] = [
  { path: '', label: 'Dashboard', min: 'admin' },
  { path: 'content', label: 'Content', min: 'editor' },
  { path: 'news', label: 'News review', min: 'admin' },
  { path: 'sources', label: 'Sources & ingestion', min: 'admin' },
  { path: 'users', label: 'Users & roles', min: 'admin' },
  { path: 'audit', label: 'Audit log', min: 'super_admin' },
  { path: 'settings', label: 'Feature flags', min: 'admin' },
];

export function App() {
  const [, setTick] = useState(0);
  const qc = useQueryClient();
  const signedIn = !!getSession();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/v1/me'), enabled: signedIn });
  const route = useRoute();
  const page = route[0] ?? '';

  if (!signedIn) return <LoginPage onSignedIn={() => setTick((t) => t + 1)} />;
  if (me.isLoading) return <div className="p-10 text-muted">Loading…</div>;
  if (me.error || !me.data) {
    return (
      <div className="p-10">
        <p className="text-bad">Could not load your profile. Your session may have expired.</p>
        <Button className="mt-4" onClick={() => (auth.signOut(), setTick((t) => t + 1))}>
          Sign in again
        </Button>
      </div>
    );
  }
  const role = me.data.role;
  if (!atLeast(role, 'editor')) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">No admin access</h1>
        <p className="mt-2 text-muted">{me.data.email} is a learner account. Ask a super-admin to grant you a role.</p>
        <Button className="mt-6" kind="secondary" onClick={() => (auth.signOut(), qc.clear(), setTick((t) => t + 1))}>
          Sign out
        </Button>
      </div>
    );
  }

  const allowed = NAV.filter((n) => atLeast(role, n.min));
  const current = allowed.find((n) => n.path === page) ?? allowed[0]!;
  if (current.path !== page && page !== 'content') go(current.path);

  const body = (() => {
    switch (page === 'content' && route[1] ? 'editor' : current.path) {
      case '':
        return <DashboardPage />;
      case 'content':
        return <ContentPage role={role} />;
      case 'editor':
        return <ContentEditorPage id={route[1]!} role={role} me={me.data} />;
      case 'news':
        return <NewsPage />;
      case 'sources':
        return <SourcesPage />;
      case 'users':
        return <UsersPage me={me.data} />;
      case 'audit':
        return <AuditPage />;
      case 'settings':
        return <SettingsPage role={role} />;
      default:
        return null;
    }
  })();

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface p-5 md:block">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-widest text-accent">Admin</div>
          <div className="text-lg font-extrabold leading-tight">Learn AI &amp; Agent Security</div>
        </div>
        <nav className="space-y-1" aria-label="Main">
          {allowed.map((n) => (
            <a
              key={n.path}
              href={`#/${n.path}`}
              aria-current={n.path === current.path ? 'page' : undefined}
              className={`block rounded-lg px-3 py-2 text-sm font-medium ${n.path === current.path ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="mt-10 border-t border-line pt-4 text-xs text-muted">
          <div className="truncate">{me.data.email}</div>
          <div className="mt-0.5 font-semibold text-ink">{role.replace('_', ' ')}</div>
          <button className="mt-3 text-accent hover:underline" onClick={() => (auth.signOut(), qc.clear(), setTick((t) => t + 1))}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-10">
        <nav className="mb-6 flex gap-2 overflow-x-auto md:hidden" aria-label="Main">
          {allowed.map((n) => (
            <a key={n.path} href={`#/${n.path}`} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${n.path === current.path ? 'bg-accent/15 text-accent' : 'text-muted'}`}>
              {n.label}
            </a>
          ))}
        </nav>
        <Suspense fallback={<p className="text-muted">Loading…</p>}>{body}</Suspense>
      </main>
    </div>
  );
}
