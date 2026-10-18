import type { ButtonHTMLAttributes, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Button({
  kind = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
        kind === 'primary' && 'bg-accent text-accent-ink hover:brightness-110',
        kind === 'secondary' && 'border border-line bg-surface-2 text-ink hover:border-accent/60',
        kind === 'danger' && 'bg-bad text-white hover:brightness-110',
        kind === 'ghost' && 'text-accent hover:underline',
        className,
      )}
    />
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-surface p-5', className)}>
      {title || actions ? (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-base font-bold">{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

const BADGE: Record<string, string> = {
  ok: 'bg-ok/15 text-ok border-ok/30',
  warn: 'bg-warn/15 text-warn border-warn/30',
  bad: 'bg-bad/15 text-bad border-bad/30',
  info: 'bg-accent/15 text-accent border-accent/30',
  muted: 'bg-surface-2 text-muted border-line',
};

export function Badge({ tone = 'muted', children }: { tone?: keyof typeof BADGE; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold', BADGE[tone])}>{children}</span>;
}

export const statusTone = (s: string): keyof typeof BADGE =>
  ({ published: 'ok', ok: 'ok', in_review: 'info', pending: 'warn', draft: 'muted', rejected: 'bad', error: 'bad', archived: 'muted', not_modified: 'muted' })[s] ?? 'muted';

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'bad' | 'warn' }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={cx('mt-1 text-3xl font-extrabold', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls = 'w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-accent';

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error as { message?: string; details?: unknown };
  return (
    <div role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
      {e.message ?? 'Something went wrong'}
      {Array.isArray(e.details) ? (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {e.details.slice(0, 8).map((d, i) => (
            <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');
