import { contentPack } from '@laas/content';
import { describe, expect, it } from 'vitest';
import { appendToPack, bumpVersion, packIssues, parseCsv, parseImport } from './index';

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, commas, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n\n1,\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['1', ''],
    ]);
  });
  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('front,back\n"line1\nline2",ok')).toEqual([
      ['front', 'back'],
      ['line1\nline2', 'ok'],
    ]);
  });
});

describe('parseImport', () => {
  it('validates flashcard CSV rows and reports row numbers', () => {
    const csv = 'lessonId,front,back\nb-prompt-injection,What is LLM01?,Prompt injection in the OWASP list.\nnot-a-lesson,Front text,Back text\nb-prompt-injection,x,y';
    const r = parseImport('flashcards', 'csv', csv, contentPack);
    expect(r.flashcards).toHaveLength(1);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3]);
    expect(r.errors[0]!.message).toMatch(/unknown lesson/);
  });

  it('reads quiz CSV with a 1-based correct column', () => {
    const csv = 'lessonId,prompt,option1,option2,option3,correct,explanation\nb-prompt-injection,Which is a defence against injection?,Least privilege for tools,Longer prompts,Bigger model,1,Limit what a manipulated model can do.';
    const r = parseImport('quiz', 'csv', csv, contentPack);
    expect(r.errors).toEqual([]);
    expect(r.quiz[0]).toMatchObject({ correctIndex: 0, options: ['Least privilege for tools', 'Longer prompts', 'Bigger model'] });
  });

  it('rejects CSV for interview items and oversized imports', () => {
    expect(parseImport('interview', 'csv', 'a,b', contentPack).errors[0]!.message).toMatch(/JSON/);
    const many = JSON.stringify(Array.from({ length: 501 }, () => ({})));
    expect(parseImport('flashcards', 'json', many, contentPack).errors[0]!.message).toMatch(/limit is 500/);
  });
});

describe('appendToPack', () => {
  it('adds items with collision-free ids and keeps the pack valid', () => {
    const lesson = contentPack.lessons.find((l) => l.quiz.length < 5)!;
    const r = appendToPack(
      contentPack,
      {
        flashcards: [{ lessonId: lesson.id, front: 'A brand new question?', back: 'A brand new answer.' }],
        quiz: [{ lessonId: lesson.id, prompt: 'A new multiple choice question?', options: ['Right', 'Wrong'], correctIndex: 0, explanation: 'Because it is right.' }],
      },
      'imp20261019',
    );
    expect(r.added).toEqual({ flashcards: 1, quiz: 1, interview: 0 });
    expect(r.pack.flashcards.at(-1)!.id).toBe(`${lesson.id}-imp20261019-1`);
    expect(packIssues(r.pack)).toEqual([]);
    expect(contentPack.flashcards.length).toBe(r.pack.flashcards.length - 1); // original untouched
  });

  it('skips duplicates and respects the 5-question limit', () => {
    const existing = contentPack.flashcards[0]!;
    const full = contentPack.lessons[0]!;
    const extra = Array.from({ length: 6 }, (_, i) => ({ lessonId: full.id, prompt: `Extra question number ${i + 1}?`, options: ['a', 'b'], correctIndex: 0, explanation: 'Explanation text.' }));
    const r = appendToPack(contentPack, { flashcards: [{ lessonId: existing.lessonId, front: existing.front, back: 'Different back.' }], quiz: extra }, 't');
    expect(r.added.flashcards).toBe(0);
    expect(r.added.quiz).toBe(5 - full.quiz.length);
    expect(r.skipped.some((s) => /already has 5/.test(s))).toBe(true);
  });

  it('bumps versions', () => {
    expect(bumpVersion('2026.10.4')).toBe('2026.10.5');
    expect(bumpVersion('beta')).toBe('beta.1');
  });
});
