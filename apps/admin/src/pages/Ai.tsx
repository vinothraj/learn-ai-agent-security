import { contentPack } from '@laas/content';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Card, Empty, ErrorNote, Field, fmtDate, inputCls, Stat } from '../components/ui';
import { api, atLeast, type Role } from '../lib/api';
import { go } from '../lib/router';

interface Usage {
  provider: string;
  model: string;
  enabled: boolean;
  today: { tokens: number; requests: number; budget: number };
  byTask: { task: string; requests: number; tokens: number }[];
}
interface Question {
  id?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
interface Suggestion {
  id: string;
  kind: 'quiz' | 'news_pack';
  lesson_id: string;
  payload: { questions?: Question[]; flashcards?: { front: string; back: string }[]; articleTitle?: string; articleUrl?: string };
  status: 'pending' | 'approved' | 'rejected';
  provider: string;
  model: string;
  created_at: string;
  reviewed_at: string | null;
  note: string | null;
  applied_version: string | null;
  applied_at: string | null;
}

/** Approved drafts are collected into one content draft per session, then reviewed and published. */
const TARGET_KEY = 'ai-target-draft';
const readTarget = () => {
  try {
    return sessionStorage.getItem(TARGET_KEY) ?? '';
  } catch {
    return '';
  }
};

const lessonTitle = new Map(contentPack.lessons.map((l) => [l.id, l.title]));
const TABS = ['pending', 'approved', 'rejected'] as const;

function SuggestionCard({ s, role }: { s: Suggestion; role: Role }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const review = useMutation({
    mutationFn: (action: 'approve' | 'reject') => api(`/v1/admin/ai/suggestions/${s.id}/review`, { method: 'POST', body: { action, note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  });
  const apply = useMutation({
    mutationFn: () => {
      const target = readTarget();
      return api<{ versionId: string; added: { quiz: number; flashcards: number }; skipped: string[] }>(`/v1/admin/ai/suggestions/${s.id}/apply`, {
        method: 'POST',
        body: target ? { versionId: target } : {},
      });
    },
    onSuccess: (r) => {
      try {
        sessionStorage.setItem(TARGET_KEY, r.versionId);
      } catch {
        // Without storage each apply starts its own draft; still correct.
      }
      qc.invalidateQueries({ queryKey: ['ai-suggestions'] });
      qc.invalidateQueries({ queryKey: ['content'] });
    },
  });
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warn">AI-generated</Badge>
        <Badge tone="info">{lessonTitle.get(s.lesson_id) ?? s.lesson_id}</Badge>
        {s.kind === 'news_pack' ? <Badge tone="muted">From news</Badge> : null}
        <span className="text-xs text-muted">
          {s.provider} · {s.model} · {fmtDate(s.created_at)}
        </span>
      </div>
      {s.payload.articleTitle ? (
        <p className="mt-2 text-sm">
          Source:{' '}
          <a className="text-accent hover:underline" href={s.payload.articleUrl} target="_blank" rel="noopener noreferrer">
            {s.payload.articleTitle}
          </a>{' '}
          <span className="text-xs text-muted">(check the facts against it)</span>
        </p>
      ) : null}
      <ol className="mt-3 space-y-4">
        {(s.payload.questions ?? []).map((q, qi) => (
          <li key={q.id ?? qi}>
            <p className="font-semibold">{q.prompt}</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {q.options.map((o, i) => (
                <li key={i} className={i === q.correctIndex ? 'text-ok' : 'text-muted'}>
                  {i === q.correctIndex ? '✓' : '·'} {o}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted">{q.explanation}</p>
          </li>
        ))}
      </ol>
      {s.payload.flashcards?.length ? (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Flashcards</div>
          <ul className="mt-1 space-y-1 text-sm">
            {s.payload.flashcards.map((c, i) => (
              <li key={i}>
                <span className="font-semibold">{c.front}</span> <span className="text-muted">→ {c.back}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        {s.status === 'pending' && atLeast(role, 'admin') ? (
          <>
            <input className={`${inputCls} max-w-sm`} placeholder="Review note (audited)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button disabled={review.isPending} onClick={() => review.mutate('approve')}>
              Approve
            </Button>
            <Button kind="secondary" disabled={review.isPending} onClick={() => review.mutate('reject')}>
              Reject
            </Button>
          </>
        ) : s.note ? (
          <p className="text-sm text-muted">Note: {s.note}</p>
        ) : null}
        {s.status === 'approved' && !s.applied_at && atLeast(role, 'editor') ? (
          <Button disabled={apply.isPending} onClick={() => apply.mutate()}>
            {apply.isPending ? 'Adding…' : 'Add to content draft'}
          </Button>
        ) : null}
        {s.applied_version ? (
          <Button kind="ghost" onClick={() => go(`content/${s.applied_version}`)}>
            Added to a draft → review and submit
          </Button>
        ) : null}
      </div>
      {apply.data?.skipped.length ? <p className="mt-2 text-xs text-warn">Skipped: {apply.data.skipped.join('; ')}</p> : null}
      <ErrorNote error={review.error ?? apply.error} />
    </Card>
  );
}

export function AiPage({ role }: { role: Role }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>('pending');
  const [lessonId, setLessonId] = useState(contentPack.lessons[0]?.id ?? '');
  const [count, setCount] = useState(2);
  const usage = useQuery({ queryKey: ['ai-usage'], queryFn: () => api<Usage>('/v1/admin/ai/usage'), enabled: atLeast(role, 'admin') });
  const list = useQuery({ queryKey: ['ai-suggestions', tab], queryFn: () => api<{ suggestions: Suggestion[] }>(`/v1/admin/ai/suggestions?status=${tab}`) });
  const gen = useMutation({
    mutationFn: () => api('/v1/admin/ai/quiz', { method: 'POST', body: { lessonId, count } }),
    onSuccess: () => {
      setTab('pending');
      qc.invalidateQueries({ queryKey: ['ai-suggestions'] });
      qc.invalidateQueries({ queryKey: ['ai-usage'] });
    },
  });
  const weekly = useMutation({
    mutationFn: () => api<{ considered: number; created: number; skipped: { reason: string }[]; disabled?: string }>('/v1/admin/jobs/news-drafts', { method: 'POST' }),
    onSuccess: () => {
      setTab('pending');
      qc.invalidateQueries({ queryKey: ['ai-suggestions'] });
      qc.invalidateQueries({ queryKey: ['ai-usage'] });
    },
  });
  const u = usage.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">AI drafts</h1>
        <p className="text-sm text-muted">Optional. AI output is never published automatically: every draft waits for an admin who did not request it.</p>
      </header>

      {u ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Provider" value={u.provider === 'none' ? 'Not configured' : u.provider} hint={u.provider === 'none' ? 'Set AI_PROVIDER on the server' : `${u.model} · ${u.enabled ? 'enabled' : 'flag off'}`} />
          <Stat
            label="Tokens today"
            value={u.today.tokens.toLocaleString()}
            hint={`of ${u.today.budget.toLocaleString()} daily budget`}
            tone={u.today.tokens >= u.today.budget ? 'bad' : u.today.tokens > u.today.budget * 0.8 ? 'warn' : undefined}
          />
          <Stat label="Requests today" value={u.today.requests} hint={u.byTask.map((t) => `${t.task}: ${t.requests}`).join(' · ') || 'None yet'} />
        </div>
      ) : null}

      <Card title="Weekly drafts from news">
        <p className="text-sm text-muted">
          Turns the last 7 days of published news into a quiz question and flashcards for the linked lesson. Runs automatically every Monday through the
          “Content jobs” workflow; run it now if you like. Approve what is accurate, then <strong>Add to content draft</strong>, review the draft and submit it.
        </p>
        {atLeast(role, 'admin') ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button kind="secondary" disabled={weekly.isPending} onClick={() => weekly.mutate()}>
              {weekly.isPending ? 'Drafting…' : "Draft from this week's news"}
            </Button>
            {weekly.data ? (
              <span className="text-sm">
                {weekly.data.disabled
                  ? `Not run: ${weekly.data.disabled}.`
                  : `${weekly.data.created} new drafts from ${weekly.data.considered} articles${weekly.data.skipped.length ? `, ${weekly.data.skipped.length} skipped` : ''}.`}
              </span>
            ) : null}
          </div>
        ) : null}
        <ErrorNote error={weekly.error} />
      </Card>

      <Card title="Draft quiz questions">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
          <Field label="Lesson">
            <select className={inputCls} value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              {contentPack.lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Questions">
            <select className={inputCls} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 2, 3].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Button disabled={gen.isPending || !lessonId} onClick={() => gen.mutate()}>
            {gen.isPending ? 'Drafting…' : 'Draft with AI'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">Questions use only the lesson text. Approved drafts are copied into a content version by an editor.</p>
        <ErrorNote error={gen.error} />
      </Card>

      <div className="flex gap-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${tab === t ? 'bg-accent/15 text-accent' : 'text-muted hover:text-ink'}`}>
            {t}
          </button>
        ))}
      </div>
      <ErrorNote error={list.error} />
      {list.data?.suggestions.length === 0 ? <Empty>No {tab} drafts.</Empty> : null}
      <div className="space-y-4">
        {list.data?.suggestions.map((s) => (
          <SuggestionCard key={s.id} s={s} role={role} />
        ))}
      </div>
    </div>
  );
}
