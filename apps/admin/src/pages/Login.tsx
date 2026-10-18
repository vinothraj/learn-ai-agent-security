import { useState } from 'react';
import { Button, ErrorNote, Field, inputCls } from '../components/ui';
import { auth, env, type Role } from '../lib/api';

export function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devRole, setDevRole] = useState<Role>('super_admin');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const dev = env.authMode === 'dev';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-surface p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (dev) return run(async () => (await auth.devSignIn(email.trim(), devRole), onSignedIn()));
          if (stage === 'email') return run(async () => (await auth.requestCode(email.trim()), setStage('code')));
          return run(async () => (await auth.verify(email.trim(), code.trim()), onSignedIn()));
        }}>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-accent">Admin console</div>
          <h1 className="mt-1 text-2xl font-extrabold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Staff only. Every action is recorded in the audit log.</p>
        </div>
        {!env.apiUrl ? <ErrorNote error={{ message: 'VITE_API_URL is not configured.' }} /> : null}
        {dev ? <p className="rounded-lg border border-warn/40 bg-warn/10 p-2 text-xs text-warn">Developer mode: local test sign-in, no email is sent.</p> : null}
        <Field label="Work email">
          <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={stage === 'code'} />
        </Field>
        {dev ? (
          <Field label="Test role (developer mode only)">
            <select className={inputCls} value={devRole} onChange={(e) => setDevRole(e.target.value as Role)}>
              <option value="editor">editor</option>
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
              <option value="learner">learner</option>
            </select>
          </Field>
        ) : null}
        {stage === 'code' ? (
          <Field label="6-digit code">
            <input className={inputCls} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </Field>
        ) : null}
        <ErrorNote error={error} />
        <Button type="submit" className="w-full" disabled={busy || !email}>
          {busy ? 'Please wait…' : dev ? 'Sign in (developer mode)' : stage === 'email' ? 'Email me a code' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
