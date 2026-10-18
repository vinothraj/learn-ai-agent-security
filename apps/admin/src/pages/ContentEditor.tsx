import { compareVersions, CONTENT_VERSION as bundledVersion, fromLessons } from '@laas/content';
import { packIssues, type ContentPack, type Lesson, type QuizQuestion } from '@laas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import type { Me } from '../App';
import { Badge, Button, Card, ErrorNote, Field, inputCls, statusTone } from '../components/ui';
import { api, atLeast, type Role } from '../lib/api';
import { go } from '../lib/router';
import type { VersionRow } from './Content';

interface Detail extends VersionRow {
  pack: ContentPack;
  issueList: string[];
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const paras = (s: string) => s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

/** Keep lesson-derived interview items in sync with the lessons they come from. */
function withDerivedInterview(pack: ContentPack): ContentPack {
  const derivedIds = new Set(pack.lessons.map((l) => l.interview.id));
  return { ...pack, interview: { ...pack.interview, items: [...pack.interview.items.filter((i) => !derivedIds.has(i.id)), ...fromLessons(pack.lessons, pack.skills)] } };
}

function QuizEditor({ quiz, onChange, readOnly }: { quiz: QuizQuestion[]; onChange: (q: QuizQuestion[]) => void; readOnly: boolean }) {
  const set = (i: number, patch: Partial<QuizQuestion>) => onChange(quiz.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div className="space-y-4">
      {quiz.map((q, i) => (
        <div key={q.id} className="space-y-2 rounded-xl border border-line p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted">{q.id}</span>
            {!readOnly && quiz.length > 2 ? (
              <Button kind="ghost" onClick={() => onChange(quiz.filter((_, j) => j !== i))}>
                Remove
              </Button>
            ) : null}
          </div>
          <Field label="Question">
            <input className={inputCls} disabled={readOnly} value={q.prompt} onChange={(e) => set(i, { prompt: e.target.value })} />
          </Field>
          <Field label="Options (one per line; shuffled in the app)">
            <textarea className={inputCls} rows={4} disabled={readOnly} value={q.options.join('\n')} onChange={(e) => set(i, { options: e.target.value.split('\n') })} />
          </Field>
          <div className="grid gap-2 md:grid-cols-[180px_1fr]">
            <Field label="Correct option">
              <select className={inputCls} disabled={readOnly} value={q.correctIndex} onChange={(e) => set(i, { correctIndex: Number(e.target.value) })}>
                {q.options.map((o, k) => (
                  <option key={k} value={k}>
                    {k + 1}. {o.slice(0, 30)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Explanation">
              <input className={inputCls} disabled={readOnly} value={q.explanation} onChange={(e) => set(i, { explanation: e.target.value })} />
            </Field>
          </div>
        </div>
      ))}
      {!readOnly && quiz.length < 5 ? (
        <Button
          kind="secondary"
          onClick={() => onChange([...quiz, { id: `${quiz[0]?.id.replace(/-q\d+$/, '') ?? 'q'}-q${quiz.length + 1}-${Date.now() % 10000}`, prompt: '', options: ['', ''], correctIndex: 0, explanation: '' }])}>
          Add question
        </Button>
      ) : null}
    </div>
  );
}

function LessonForm({ pack, lesson, readOnly, onPack }: { pack: ContentPack; lesson: Lesson; readOnly: boolean; onPack: (p: ContentPack) => void }) {
  const set = (patch: Partial<Lesson>) => onPack(withDerivedInterview({ ...pack, lessons: pack.lessons.map((l) => (l.id === lesson.id ? { ...l, ...patch } : l)) }));
  const cards = pack.flashcards.filter((c) => c.lessonId === lesson.id);
  const setCards = (text: string) => {
    const next = lines(text).map((line, i) => {
      const [front = '', ...rest] = line.split('|');
      return { id: `${lesson.id}-fc${i + 1}`, lessonId: lesson.id, front: front.trim(), back: rest.join('|').trim() };
    });
    onPack({ ...pack, flashcards: [...pack.flashcards.filter((c) => c.lessonId !== lesson.id), ...next] });
  };
  const skill = pack.skills.find((s) => s.lessonIds.includes(lesson.id))?.id ?? '';
  const setSkill = (id: string) =>
    onPack({ ...pack, skills: pack.skills.map((s) => ({ ...s, lessonIds: s.id === id ? [...new Set([...s.lessonIds, lesson.id])] : s.lessonIds.filter((x) => x !== lesson.id) })) });
  const ro = readOnly;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Title">
          <input className={inputCls} disabled={ro} value={lesson.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Summary">
          <input className={inputCls} disabled={ro} value={lesson.summary} onChange={(e) => set({ summary: e.target.value })} />
        </Field>
        <Field label="Level">
          <select className={inputCls} disabled={ro} value={lesson.level} onChange={(e) => set({ level: e.target.value as Lesson['level'] })}>
            {['beginner', 'intermediate', 'advanced'].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Minutes">
          <input className={inputCls} type="number" min={2} max={15} disabled={ro} value={lesson.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })} />
        </Field>
        <Field label="Review status" hint="Only mark reviewed after a subject-matter expert has checked it.">
          <select className={inputCls} disabled={ro} value={lesson.status} onChange={(e) => set({ status: e.target.value as Lesson['status'] })}>
            {['needs_review', 'reviewed', 'published', 'archived'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Evidence level">
          <select className={inputCls} disabled={ro} value={lesson.evidence} onChange={(e) => set({ evidence: e.target.value as Lesson['evidence'] })}>
            {['established', 'emerging', 'opinion'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Prerequisites (lesson ids, comma-separated)">
          <input className={inputCls} disabled={ro} value={lesson.prerequisites.join(', ')} onChange={(e) => set({ prerequisites: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
        </Field>
        <Field label="Radar skill">
          <select className={inputCls} disabled={ro} value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">(none)</option>
            {pack.skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Learning objective">
        <textarea className={inputCls} rows={2} disabled={ro} value={lesson.objective} onChange={(e) => set({ objective: e.target.value })} />
      </Field>
      <Field label="Explanation (blank line between paragraphs)">
        <textarea className={inputCls} rows={7} disabled={ro} value={lesson.explanation.join('\n\n')} onChange={(e) => set({ explanation: paras(e.target.value) })} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Example title (fictional system)">
          <input className={inputCls} disabled={ro} value={lesson.example.title} onChange={(e) => set({ example: { ...lesson.example, title: e.target.value } })} />
        </Field>
        <Field label="Risk">
          <input className={inputCls} disabled={ro} value={lesson.risk} onChange={(e) => set({ risk: e.target.value })} />
        </Field>
      </div>
      <Field label="Example">
        <textarea className={inputCls} rows={3} disabled={ro} value={lesson.example.body} onChange={(e) => set({ example: { ...lesson.example, body: e.target.value } })} />
      </Field>
      <Field label="Defensive controls (one per line)">
        <textarea className={inputCls} rows={4} disabled={ro} value={lesson.controls.join('\n')} onChange={(e) => set({ controls: lines(e.target.value) })} />
      </Field>
      <Card title="Knowledge check">
        <QuizEditor quiz={lesson.quiz} readOnly={ro} onChange={(quiz) => set({ quiz })} />
      </Card>
      <Card title="Interview question">
        <div className="space-y-3">
          <Field label="Question">
            <input className={inputCls} disabled={ro} value={lesson.interview.question} onChange={(e) => set({ interview: { ...lesson.interview, question: e.target.value } })} />
          </Field>
          <Field label="Model answer" hint="Must mention every key concept below; validation checks this automatically.">
            <textarea className={inputCls} rows={5} disabled={ro} value={lesson.interview.modelAnswer} onChange={(e) => set({ interview: { ...lesson.interview, modelAnswer: e.target.value } })} />
          </Field>
          <Field label="Key concepts (one per line, used for scoring)">
            <textarea className={inputCls} rows={4} disabled={ro} value={lesson.interview.keyConcepts.join('\n')} onChange={(e) => set({ interview: { ...lesson.interview, keyConcepts: lines(e.target.value) } })} />
          </Field>
        </div>
      </Card>
      <Field label="Flashcards (one per line: front | back)">
        <textarea className={inputCls} rows={5} disabled={ro} value={cards.map((c) => `${c.front} | ${c.back}`).join('\n')} onChange={(e) => setCards(e.target.value)} />
      </Field>
      <Field label="References (one per line: title | publisher | https URL)">
        <textarea
          className={inputCls}
          rows={3}
          disabled={ro}
          value={lesson.references.map((r) => `${r.title} | ${r.publisher} | ${r.url}`).join('\n')}
          onChange={(e) =>
            set({
              references: lines(e.target.value).map((l) => {
                const [title = '', publisher = '', url = ''] = l.split('|').map((x) => x.trim());
                return { title, publisher, url };
              }),
            })
          }
        />
      </Field>
    </div>
  );
}

function newLesson(roadmapId: string, title: string): Lesson {
  const id = slug(title);
  return {
    id,
    roadmapId,
    title,
    summary: 'One-line summary of this lesson.',
    level: 'beginner',
    minutes: 6,
    tags: ['new'],
    prerequisites: [],
    objective: 'Describe what the learner will be able to do.',
    explanation: ['Explain the concept in two or three short paragraphs.'],
    example: { title: 'Fictional: ExampleBot', body: 'Describe a realistic but fictional scenario.' },
    risk: 'Describe what goes wrong if this is ignored.',
    controls: ['First control', 'Second control'],
    quiz: [
      { id: `${id}-q1`, prompt: 'First knowledge check question?', options: ['Correct answer', 'Wrong answer'], correctIndex: 0, explanation: 'Why the answer is right.' },
      { id: `${id}-q2`, prompt: 'Second knowledge check question?', options: ['Correct answer', 'Wrong answer'], correctIndex: 0, explanation: 'Why the answer is right.' },
    ],
    interview: { id: `${id}-iq`, question: 'An interview question about this topic?', modelAnswer: 'A model answer that mentions every key concept listed below in plain words.', keyConcepts: ['first concept', 'second concept'], evidence: 'established' },
    references: [{ title: 'Reference title', publisher: 'Publisher', url: 'https://example.org/' }],
    evidence: 'established',
    status: 'needs_review',
    version: 1,
  };
}

export function ContentEditorPage({ id, role, me }: { id: string; role: Role; me: Me }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['content', id], queryFn: () => api<Detail>(`/v1/admin/content/${id}`) });
  const [draft, setDraft] = useState<ContentPack | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'lessons' | 'json'>('lessons');
  const [json, setJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const pack = draft ?? q.data?.pack ?? null;
  const deferred = useDeferredValue(pack);
  const issues = useMemo(() => (deferred ? packIssues(deferred) : []), [deferred]);
  const editable = q.data?.status === 'draft' || q.data?.status === 'rejected';
  const ownVersion = q.data?.created_by === me.id;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['content'] });
    qc.invalidateQueries({ queryKey: ['overview'] });
  };
  const save = useMutation({
    mutationFn: () => api(`/v1/admin/content/${id}`, { method: 'PUT', body: { pack } }),
    onSuccess: () => {
      setDraft(null);
      invalidate();
    },
  });
  const action = useMutation({
    mutationFn: (a: 'submit' | 'publish' | 'reject') => api(`/v1/admin/content/${id}/${a}`, { method: 'POST', body: a === 'submit' ? undefined : { note } }),
    onSuccess: invalidate,
  });

  if (q.error) return <ErrorNote error={q.error} />;
  if (!q.data || !pack) return <p className="text-muted">Loading…</p>;
  const lesson = pack.lessons.find((l) => l.id === selected) ?? null;

  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `content-${q.data!.label}.json` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button className="text-sm text-accent hover:underline" onClick={() => go('content')}>
            ← All versions
          </button>
          <h1 className="mt-1 text-2xl font-extrabold">
            {q.data.label} <Badge tone={statusTone(q.data.status)}>{q.data.status.replace('_', ' ')}</Badge>
          </h1>
          <p className="text-sm text-muted">
            Pack version <span className="font-mono">{pack.version}</span> · {pack.lessons.length} lessons · {pack.labs.length} labs · {pack.interview.items.length} interview questions
          </p>
          {q.data.review_note ? <p className="mt-1 text-sm text-warn">Review note: {q.data.review_note}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button kind="secondary" onClick={downloadJson}>
            Download JSON
          </Button>
          {editable ? (
            <>
              <Button kind="secondary" disabled={!draft || save.isPending} onClick={() => save.mutate()}>
                {draft ? 'Save draft' : 'Saved'}
              </Button>
              <Button disabled={!!draft || issues.length > 0 || action.isPending} onClick={() => action.mutate('submit')} title={issues.length ? 'Fix validation issues first' : undefined}>
                Submit for review
              </Button>
            </>
          ) : null}
        </div>
      </header>

      {q.data.status === 'in_review' && atLeast(role, 'admin') ? (
        <Card title="Review">
          <p className="text-sm text-muted">Check content accuracy and sources. Publishing makes this pack available to every app on its next launch.</p>
          <textarea className={`${inputCls} mt-3`} rows={2} placeholder="Review note (stored with the version and in the audit log)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <Button disabled={action.isPending || (ownVersion && role !== 'super_admin')} onClick={() => action.mutate('publish')}>
              Publish
            </Button>
            <Button kind="secondary" disabled={action.isPending} onClick={() => action.mutate('reject')}>
              Reject
            </Button>
          </div>
          {ownVersion && role !== 'super_admin' ? <p className="mt-2 text-xs text-warn">Four-eyes rule: another admin must publish a version you created.</p> : null}
        </Card>
      ) : null}
      <ErrorNote error={save.error ?? action.error} />

      <Card title="Pack version">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Version (YYYY.MM.N)">
            <input
              className={`${inputCls} w-48 font-mono`}
              disabled={!editable}
              value={pack.version}
              onChange={(e) => setDraft({ ...pack, version: e.target.value.trim() })}
            />
          </Field>
          {compareVersions(pack.version, bundledVersion) <= 0 ? (
            <p className="pb-2 text-sm text-warn">
              Apps ignore packs that are not newer than their bundled content ({bundledVersion}). Bump the version before publishing.
            </p>
          ) : (
            <p className="pb-2 text-sm text-ok">Newer than the bundled content ({bundledVersion}): apps will apply it on their next launch.</p>
          )}
        </div>
      </Card>

      <Card title={issues.length ? `${issues.length} validation issue${issues.length === 1 ? '' : 's'}` : 'Validation passed'}>
        {issues.length ? (
          <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-bad">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ok">All integrity rules pass: references, labs, flashcards, rubrics and role plans.</p>
        )}
      </Card>

      <div className="flex gap-2" role="tablist">
        <Button role="tab" aria-selected={tab === 'lessons'} kind={tab === 'lessons' ? 'primary' : 'secondary'} onClick={() => setTab('lessons')}>
          Lessons
        </Button>
        <Button
          role="tab"
          aria-selected={tab === 'json'}
          kind={tab === 'json' ? 'primary' : 'secondary'}
          onClick={() => {
            setJson(JSON.stringify(pack, null, 2));
            setJsonError(null);
            setTab('json');
          }}>
          Advanced (JSON)
        </Button>
      </div>

      {tab === 'lessons' ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card title="Lessons">
            <div className="space-y-4">
              {pack.roadmaps.map((r) => (
                <div key={r.id}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {r.code}. {r.title}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {r.lessonIds.map((lid) => {
                      const l = pack.lessons.find((x) => x.id === lid);
                      return (
                        <li key={lid}>
                          <button
                            className={`w-full rounded-md px-2 py-1 text-left text-sm ${selected === lid ? 'bg-accent/15 text-accent' : 'hover:bg-surface-2'}`}
                            onClick={() => setSelected(lid)}>
                            {l?.title ?? lid}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {editable ? (
                    <button
                      className="mt-1 px-2 text-xs text-accent hover:underline"
                      onClick={() => {
                        const title = prompt('New lesson title');
                        if (!title) return;
                        const l = newLesson(r.id, title);
                        if (pack.lessons.some((x) => x.id === l.id)) return alert('A lesson with that id already exists.');
                        setDraft(withDerivedInterview({ ...pack, lessons: [...pack.lessons, l], roadmaps: pack.roadmaps.map((x) => (x.id === r.id ? { ...x, lessonIds: [...x.lessonIds, l.id] } : x)) }));
                        setSelected(l.id);
                      }}>
                      + Add lesson
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
          <Card title={lesson ? lesson.title : 'Select a lesson'}>
            {lesson ? <LessonForm key={lesson.id} pack={pack} lesson={lesson} readOnly={!editable} onPack={setDraft} /> : <p className="text-sm text-muted">Choose a lesson on the left to edit it.</p>}
          </Card>
        </div>
      ) : (
        <Card title="Whole pack (labs, games, roles and more)">
          <textarea className={`${inputCls} font-mono text-xs`} rows={28} spellCheck={false} disabled={!editable} value={json} onChange={(e) => setJson(e.target.value)} />
          {jsonError ? <p className="mt-2 text-sm text-bad">{jsonError}</p> : null}
          {editable ? (
            <Button
              className="mt-3"
              onClick={() => {
                try {
                  setDraft(JSON.parse(json) as ContentPack);
                  setJsonError(null);
                } catch (e) {
                  setJsonError(`Invalid JSON: ${(e as Error).message}`);
                }
              }}>
              Apply JSON to draft
            </Button>
          ) : null}
        </Card>
      )}
    </div>
  );
}
