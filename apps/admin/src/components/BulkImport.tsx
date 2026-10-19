import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { go } from '../lib/router';
import { Badge, Button, Card, ErrorNote, Field, inputCls } from './ui';

type Kind = 'flashcards' | 'quiz' | 'interview';
type Format = 'csv' | 'json';

interface ImportResult {
  errors: { row: number; message: string }[];
  added: { flashcards: number; quiz: number; interview: number };
  skipped: string[];
  versionId: string | null;
  dryRun: boolean;
  created?: boolean;
}

const TEMPLATES: Record<Kind, { format: Format; text: string; help: string }> = {
  flashcards: {
    format: 'csv',
    text: 'lessonId,front,back\nb-prompt-injection,Is a system prompt a security boundary?,"No. Enforce rules in code, not in the prompt."\n',
    help: 'Columns: lessonId, front, back. Up to 500 rows.',
  },
  quiz: {
    format: 'csv',
    text: 'lessonId,prompt,option1,option2,option3,option4,correct,explanation\nc-excessive-agency,Which control limits excessive autonomy?,Human approval for irreversible actions,Longer prompts,A bigger model,Caching,1,A person stays accountable for high-impact actions.\n',
    help: 'Columns: lessonId, prompt, option1–option5, correct (1-based), explanation. A lesson holds at most 5 questions.',
  },
  interview: {
    format: 'json',
    text: JSON.stringify(
      [
        {
          id: 'iq-example-new',
          type: 'concept',
          topic: 'prompt-injection',
          level: 'beginner',
          roles: [],
          question: 'Why is a system prompt not a security control?',
          modelAnswer: 'System prompts can be extracted or overridden by prompt injection, so secrets and authorization rules must live in server-side code. The prompt guides behaviour but enforcement happens in deterministic checks.',
          reasoning: 'Tests whether the candidate separates guidance from enforcement.',
          followUps: ['Where would you put a refund limit?'],
          rubric: [
            { concept: 'Prompts can be extracted', keywords: ['extract', 'leak'] },
            { concept: 'Prompt injection overrides', keywords: ['prompt injection', 'override'] },
            { concept: 'Enforce in server-side code', keywords: ['server side', 'deterministic', 'code'] },
          ],
          evidence: 'established',
        },
      ],
      null,
      2,
    ),
    help: 'A JSON array of interview items (same fields as the content editor). The model answer must cover 80% of its rubric.',
  },
};

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

/** Bulk-add flashcards, quiz questions or interview items to a content draft (validated row by row). */
export function BulkImport({ drafts }: { drafts: { id: string; label: string }[] }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>('flashcards');
  const [format, setFormat] = useState<Format>('csv');
  const [data, setData] = useState('');
  const [versionId, setVersionId] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const run = useMutation({
    mutationFn: (dryRun: boolean) =>
      api<ImportResult>('/v1/admin/content/import', { method: 'POST', body: { kind, format, data, dryRun, ...(versionId ? { versionId } : {}) } }),
    onSuccess: (r) => {
      setResult(r);
      if (r.versionId) qc.invalidateQueries({ queryKey: ['content'] });
    },
  });

  const pickKind = (k: Kind) => {
    setKind(k);
    setFormat(TEMPLATES[k].format);
    setResult(null);
  };
  const onFile = async (f: File) => {
    setData(await f.text());
    setFormat(f.name.toLowerCase().endsWith('.json') ? 'json' : 'csv');
    setResult(null);
  };
  const t = TEMPLATES[kind];

  return (
    <Card title="Bulk import" actions={<Badge tone="info">Creates or updates a draft</Badge>}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="What">
          <select className={inputCls} value={kind} onChange={(e) => pickKind(e.target.value as Kind)}>
            <option value="flashcards">Flashcards</option>
            <option value="quiz">Quiz questions</option>
            <option value="interview">Interview questions</option>
          </select>
        </Field>
        <Field label="Format">
          <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value as Format)} disabled={kind === 'interview'}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </Field>
        <Field label="Into">
          <select className={inputCls} value={versionId} onChange={(e) => setVersionId(e.target.value)}>
            <option value="">A new draft (from the published pack)</option>
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                Draft: {d.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted">
        {t.help}{' '}
        <button className="text-accent hover:underline" onClick={() => download(`${kind}-template.${t.format}`, t.text)}>
          Download a template
        </button>
      </p>
      <textarea
        className={`${inputCls} mt-2 font-mono text-xs`}
        rows={8}
        placeholder="Paste CSV or JSON here, or choose a file"
        value={data}
        onChange={(e) => {
          setData(e.target.value);
          setResult(null);
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="file" accept=".csv,.json,text/csv,application/json" className="text-sm" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <span className="flex-1" />
        <Button kind="secondary" disabled={!data || run.isPending} onClick={() => run.mutate(true)}>
          Check
        </Button>
        <Button disabled={!data || run.isPending} onClick={() => run.mutate(false)}>
          Import
        </Button>
      </div>
      <ErrorNote error={run.error} />
      {result ? (
        <div className="mt-4 space-y-2 text-sm">
          {result.errors.length ? (
            <div role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-3">
              <p className="font-semibold text-bad">
                {result.errors.length} row{result.errors.length === 1 ? '' : 's'} need fixing. Nothing was imported.
              </p>
              <ul className="mt-1 max-h-48 list-disc overflow-auto pl-5 text-xs">
                {result.errors.map((e, i) => (
                  <li key={i}>{e.row ? `Row ${e.row}: ${e.message}` : e.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>
              {result.dryRun ? 'Ready to import: ' : 'Imported: '}
              <strong>{result.added.flashcards}</strong> flashcards, <strong>{result.added.quiz}</strong> quiz questions, <strong>{result.added.interview}</strong> interview items.
            </p>
          )}
          {result.skipped.length ? (
            <details>
              <summary className="cursor-pointer text-muted">{result.skipped.length} skipped (duplicates or limits)</summary>
              <ul className="list-disc pl-5 text-xs text-muted">
                {result.skipped.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {result.versionId ? (
            <Button kind="ghost" onClick={() => go(`content/${result.versionId}`)}>
              Open the draft to review and submit →
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
