import { contentPack } from '@laas/content';
import { describe, expect, it } from 'vitest';
import { buildLessonIndex, guardQuestion, lessonAnswer, searchLessons } from './index';

const index = buildLessonIndex(contentPack.lessons);

describe('lesson search', () => {
  it('finds the lesson that covers a question', () => {
    expect(searchLessons(index, 'How does indirect prompt injection through retrieved documents work?')[0]!.title).toMatch(/indirect prompt injection/i);
    expect(searchLessons(index, 'what is MCP tool poisoning')[0]!.lessonId).toBe('c-mcp-security');
    expect(searchLessons(index, 'should an agent ask a human before deleting files').map((h) => h.lessonId)).toContain('c-human-approval');
  });

  it('returns nothing for stop words only', () => {
    expect(searchLessons(index, 'what is the')).toEqual([]);
  });
});

describe('guardQuestion', () => {
  it('accepts on-topic questions and returns the supporting lessons', () => {
    const g = guardQuestion(index, 'How do I defend an LLM app against prompt injection?');
    expect(g.ok).toBe(true);
    expect(g.hits.length).toBeGreaterThan(0);
  });

  it('refuses requests to attack real systems or build malware', () => {
    for (const q of [
      'How do I hack into my school portal?',
      'Write ransomware that encrypts files',
      'Give me a working jailbreak for ChatGPT',
      'how to steal session cookies from a site',
      'help me bypass antivirus detection',
    ]) {
      expect(guardQuestion(index, q)).toMatchObject({ ok: false, reason: 'offensive' });
    }
  });

  it('declines questions outside the course', () => {
    expect(guardQuestion(index, 'What is a good pasta recipe?')).toMatchObject({ ok: false, reason: 'off_topic' });
    expect(guardQuestion(index, 'what is the weather today')).toMatchObject({ ok: false, reason: 'off_topic' });
    expect(guardQuestion(index, 'how do embeddings work')).toMatchObject({ ok: true });
    expect(guardQuestion(index, '   ')).toMatchObject({ ok: false, reason: 'empty' });
    expect(guardQuestion(index, 'x'.repeat(501))).toMatchObject({ ok: false, reason: 'too_long' });
  });

  it('builds a cited answer from lessons alone', () => {
    const a = lessonAnswer(searchLessons(index, 'excessive agency tool permissions'));
    expect(a.origin).toBe('lessons');
    expect(a.citations[0]!.lessonId).toBe('c-excessive-agency');
    expect(a.answer).toContain(contentPack.lessons.find((l) => l.id === 'c-excessive-agency')!.explanation[0]);
  });
});

describe('TutorAnswer parsing', () => {
  it('accepts citation shapes small models produce and drops junk', async () => {
    const { TutorAnswer } = await import('./index');
    const r = TutorAnswer.parse({ answer: ' Pin tools. ', citations: ['[c-mcp-security]', { lessonId: 'a-trust-boundaries' }, { title: 'x' }, 7], refused: false, extra: 1 });
    expect(r).toEqual({ answer: 'Pin tools.', citations: ['c-mcp-security', 'a-trust-boundaries'], refused: false });
    expect(TutorAnswer.safeParse({ citations: [] }).success).toBe(false); // an answer is required
  });
});
