import { z } from 'zod';
import { InterviewItem } from './interview';
import type { ContentPack } from './pack';

/**
 * Bulk content operations shared by the API (import, applying approved AI drafts) and tests.
 * They only ADD items to a copy of a pack; the result still has to pass packIssues() and the
 * normal draft → review → publish workflow.
 */

// ---- CSV (RFC 4180: quoted fields, doubled quotes, CRLF or LF, optional BOM) ----

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** Header row → objects with trimmed values; header names are case-insensitive. */
export function csvObjects(text: string): Record<string, string>[] {
  const [header, ...rest] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

// ---- Import rows ----

export const IMPORT_KINDS = ['flashcards', 'quiz', 'interview'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];
export const MAX_IMPORT_ROWS = 500;

const lessonRef = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lessonId must be a lesson id');
export const NewFlashcard = z.strictObject({ lessonId: lessonRef, front: z.string().trim().min(5).max(300), back: z.string().trim().min(5).max(600) });
export const NewQuizQuestion = z
  .strictObject({
    lessonId: lessonRef,
    prompt: z.string().trim().min(10).max(300),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(5),
    correctIndex: z.number().int().min(0),
    explanation: z.string().trim().min(10).max(500),
  })
  .refine((q) => q.correctIndex < q.options.length, { message: 'correctIndex out of range' });
export type NewFlashcard = z.infer<typeof NewFlashcard>;
export type NewQuizQuestion = z.infer<typeof NewQuizQuestion>;

export interface ImportRowError {
  row: number;
  message: string;
}
export interface ParsedImport {
  flashcards: NewFlashcard[];
  quiz: NewQuizQuestion[];
  interview: InterviewItem[];
  errors: ImportRowError[];
}

const zodMessage = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`).join('; ');

/** CSV quiz rows use option1..option5 and a 1-based "correct" column. */
function quizFromCsv(r: Record<string, string>): unknown {
  const options = [1, 2, 3, 4, 5].map((n) => r[`option${n}`] ?? '').filter(Boolean);
  const correct = Number(r.correct);
  return { lessonId: r.lessonid ?? '', prompt: r.prompt ?? '', options, correctIndex: Number.isInteger(correct) ? correct - 1 : -1, explanation: r.explanation ?? '' };
}

/**
 * Parses and validates an import. CSV is supported for flashcards (lessonId,front,back) and quiz
 * (lessonId,prompt,option1..option5,correct,explanation); JSON (an array of objects) for every kind.
 * Row numbers in errors are 1-based data rows (the CSV header is not counted).
 */
export function parseImport(kind: ImportKind, format: 'csv' | 'json', data: string, pack: ContentPack): ParsedImport {
  const out: ParsedImport = { flashcards: [], quiz: [], interview: [], errors: [] };
  let rows: unknown[];
  try {
    if (format === 'json') {
      const parsed = JSON.parse(data) as unknown;
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array of objects');
      rows = parsed;
    } else {
      if (kind === 'interview') throw new Error('Interview items need JSON (rubrics do not fit in CSV)');
      const objs = csvObjects(data);
      rows = kind === 'quiz' ? objs.map(quizFromCsv) : objs.map((r) => ({ lessonId: r.lessonid ?? '', front: r.front ?? '', back: r.back ?? '' }));
    }
  } catch (e) {
    out.errors.push({ row: 0, message: e instanceof Error ? e.message : 'Could not parse the file' });
    return out;
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    out.errors.push({ row: 0, message: `Too many rows (${rows.length}); the limit is ${MAX_IMPORT_ROWS} per import` });
    return out;
  }
  const lessons = new Set(pack.lessons.map((l) => l.id));
  rows.forEach((raw, i) => {
    const row = i + 1;
    if (kind === 'flashcards') {
      const r = NewFlashcard.safeParse(raw);
      if (!r.success) return out.errors.push({ row, message: zodMessage(r.error) });
      if (!lessons.has(r.data.lessonId)) return out.errors.push({ row, message: `unknown lesson ${r.data.lessonId}` });
      out.flashcards.push(r.data);
    } else if (kind === 'quiz') {
      const r = NewQuizQuestion.safeParse(raw);
      if (!r.success) return out.errors.push({ row, message: zodMessage(r.error) });
      if (!lessons.has(r.data.lessonId)) return out.errors.push({ row, message: `unknown lesson ${r.data.lessonId}` });
      out.quiz.push(r.data);
    } else {
      const r = InterviewItem.safeParse(raw);
      if (!r.success) return out.errors.push({ row, message: zodMessage(r.error) });
      if (r.data.lessonId && !lessons.has(r.data.lessonId)) return out.errors.push({ row, message: `unknown lesson ${r.data.lessonId}` });
      out.interview.push(r.data);
    }
  });
  return out;
}

// ---- Append to a pack ----

export const MAX_QUIZ_PER_LESSON = 5;

export interface AppendResult {
  pack: ContentPack;
  added: { flashcards: number; quiz: number; interview: number };
  skipped: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Returns a copy of `pack` with new items appended. New ids are `<lesson>-<tag>-<n>` so they never
 * collide with authored ones. Exact duplicates (same text) are skipped, and a lesson's quiz never
 * exceeds MAX_QUIZ_PER_LESSON questions.
 */
export function appendToPack(
  base: ContentPack,
  items: { flashcards?: NewFlashcard[]; quiz?: NewQuizQuestion[]; interview?: InterviewItem[] },
  tag: string,
): AppendResult {
  const pack = structuredClone(base);
  const added = { flashcards: 0, quiz: 0, interview: 0 };
  const skipped: string[] = [];
  const t = tag.toLowerCase().replace(/[^a-z0-9]/g, '') || 'x';

  const fronts = new Set(pack.flashcards.map((c) => `${c.lessonId}|${norm(c.front)}`));
  const usedCardIds = new Set(pack.flashcards.map((c) => c.id));
  let n = 0;
  for (const c of items.flashcards ?? []) {
    const key = `${c.lessonId}|${norm(c.front)}`;
    if (fronts.has(key)) {
      skipped.push(`flashcard "${c.front.slice(0, 50)}" already exists`);
      continue;
    }
    let id: string;
    do id = `${c.lessonId}-${t}-${++n}`;
    while (usedCardIds.has(id));
    usedCardIds.add(id);
    fronts.add(key);
    pack.flashcards.push({ id, lessonId: c.lessonId, front: c.front, back: c.back });
    added.flashcards++;
  }

  const allIds = new Set([...pack.lessons.flatMap((l) => l.quiz.map((q) => q.id)), ...pack.lessons.map((l) => l.id)]);
  let q = 0;
  for (const nq of items.quiz ?? []) {
    const lesson = pack.lessons.find((l) => l.id === nq.lessonId);
    if (!lesson) {
      skipped.push(`quiz question for unknown lesson ${nq.lessonId}`);
      continue;
    }
    if (lesson.quiz.some((x) => norm(x.prompt) === norm(nq.prompt))) {
      skipped.push(`quiz question "${nq.prompt.slice(0, 50)}" already exists`);
      continue;
    }
    if (lesson.quiz.length >= MAX_QUIZ_PER_LESSON) {
      skipped.push(`lesson ${lesson.id} already has ${MAX_QUIZ_PER_LESSON} quiz questions; "${nq.prompt.slice(0, 40)}" not added`);
      continue;
    }
    let id: string;
    do id = `${lesson.id}-${t}-q${++q}`;
    while (allIds.has(id));
    allIds.add(id);
    lesson.quiz.push({ id, prompt: nq.prompt, options: nq.options, correctIndex: nq.correctIndex, explanation: nq.explanation });
    added.quiz++;
  }

  const interviewIds = new Set(pack.interview.items.map((i) => i.id));
  for (const item of items.interview ?? []) {
    if (interviewIds.has(item.id)) {
      skipped.push(`interview item ${item.id} already exists`);
      continue;
    }
    interviewIds.add(item.id);
    pack.interview.items.push(item);
    added.interview++;
  }
  return { pack, added, skipped };
}

/** 2026.10.4 → 2026.10.5: drafts built from a pack must be newer than it for apps to apply them. */
export function bumpVersion(v: string): string {
  const parts = v.split('.');
  const last = Number(parts[parts.length - 1]);
  if (!Number.isInteger(last)) return `${v}.1`;
  parts[parts.length - 1] = String(last + 1);
  return parts.join('.');
}
