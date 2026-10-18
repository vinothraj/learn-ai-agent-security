import { describe, expect, it } from 'vitest';
import {
  buildMock,
  conceptCovered,
  InterviewItem,
  mockXp,
  scoreAnswer,
  scoreMock,
  significantWords,
  stem,
  type InterviewItem as Item,
  type InterviewRole,
} from './index';

const open = (id: string, topic: string, type: Item['type'] = 'concept', roles: string[] = []): Item => ({
  id,
  type,
  topic,
  level: 'beginner',
  roles,
  question: 'How would you secure a RAG chatbot against data leaks?',
  modelAnswer: 'Filter retrieval by the user permissions, isolate tenants and keep secrets out of the context window.',
  reasoning: 'Access control must be enforced where data is selected.',
  followUps: [],
  rubric: [
    { concept: 'Filter retrieval by user permissions', keywords: ['access control', 'permission', 'acl'] },
    { concept: 'Tenant isolation', keywords: ['tenant', 'namespace'] },
    { concept: 'Keep secrets out of the context', keywords: ['secret'], weight: 2 },
  ],
  evidence: 'established',
});

describe('stemming and concept matching', () => {
  it('normalises common suffixes', () => {
    expect(stem('validation')).toBe(stem('validate'));
    expect(stem('permissions')).toBe(stem('permission'));
    expect(stem('logging')).toBe(stem('logs'));
    expect(stem('validated')).toBe('validat');
    expect(stem('namespaces')).toBe(stem('namespace'));
    expect(stem('API')).toBe('api');
  });
  it('derives significant words without stop words', () => {
    expect(significantWords('Keep secrets out of the context')).toEqual(['keep', 'secret', 'out', 'context']);
  });
  it('matches keyword phrases anywhere in the answer', () => {
    const stems = new Set(['we', 'enforc', 'acces', 'control'].map(stem));
    expect(conceptCovered({ concept: 'x', keywords: ['access control'] }, new Set(['access', 'control'].map(stem)))).toBe(true);
    expect(conceptCovered({ concept: 'x', keywords: ['access control'] }, new Set(['access'].map(stem)))).toBe(false);
    expect(stems.size).toBeGreaterThan(0);
  });
  it('treats 4+ character keywords as prefixes', () => {
    const answer = new Set(['authorization', 'hallucinated', 'urls'].map(stem));
    expect(conceptCovered({ concept: 'x', keywords: ['authoriz'] }, answer)).toBe(true);
    expect(conceptCovered({ concept: 'x', keywords: ['hallucinat'] }, answer)).toBe(true);
    expect(conceptCovered({ concept: 'x', keywords: ['url'] }, answer)).toBe(true);
    expect(conceptCovered({ concept: 'x', keywords: ['ur'] }, answer)).toBe(false); // short terms must be exact
  });
  it('falls back to 60% of the concept words when no keywords are given', () => {
    const p = { concept: 'Short-lived scoped credentials' };
    // 4 significant words (short, lived, scoped, credentials) -> needs 3
    expect(conceptCovered(p, new Set(['short', 'scoped', 'credentials'].map(stem)))).toBe(true);
    expect(conceptCovered(p, new Set(['scoped', 'credentials'].map(stem)))).toBe(false);
  });
});

describe('scoreAnswer', () => {
  const item = open('q1', 'access-data');
  it('weights rubric points and lists covered and missed concepts', () => {
    const s = scoreAnswer(item, 'I would enforce access control on retrieval with ACL filters and keep each tenant in its own namespace.');
    expect(s.coverage).toBe(50); // 1 + 1 of 4 weight
    expect(s.covered).toEqual(['Filter retrieval by user permissions', 'Tenant isolation']);
    expect(s.missed).toEqual(['Keep secrets out of the context']);
  });
  it('flags short and skipped answers honestly', () => {
    expect(scoreAnswer(item, 'Use secrets management.').notes[0]).toMatch(/Very short/);
    expect(scoreAnswer(item, '')).toMatchObject({ coverage: 0, notes: ['Skipped'] });
  });
  it('scores MCQs as right or wrong', () => {
    const mcq: Item = { ...open('m', 'testing', 'mcq'), rubric: [], mcq: { options: ['a', 'b', 'c'], correctIndex: 2 } };
    expect(InterviewItem.safeParse(mcq).success).toBe(true);
    expect(scoreAnswer(mcq, 2).coverage).toBe(100);
    expect(scoreAnswer(mcq, 0).coverage).toBe(0);
    // A skipped MCQ must not count as answered in a mock scorecard.
    const skipped = scoreAnswer(mcq, null);
    expect(skipped.notes).toEqual(['Skipped']);
    expect(scoreMock([{ item: mcq, score: skipped }, { item: open('x', 'testing'), score: scoreAnswer(open('x', 'testing'), null) }]).answered).toBe(0);
  });
  it('rejects malformed items', () => {
    expect(InterviewItem.safeParse({ ...open('bad', 'testing', 'mcq') }).success).toBe(false); // mcq without options
    expect(InterviewItem.safeParse({ ...open('bad', 'testing'), rubric: [{ concept: 'only one' }] }).success).toBe(false);
  });
});

describe('mock interviews', () => {
  const role: InterviewRole = {
    id: 'tester',
    title: 'AI Security Tester',
    summary: 'Tests AI apps for vulnerabilities.',
    focusSkills: ['testing', 'prompt-injection'],
    weeks: [],
  };
  const items = [
    open('t1', 'testing'),
    open('t2', 'testing', 'scenario'),
    open('p1', 'prompt-injection'),
    open('p2', 'prompt-injection'),
    open('a1', 'access-data'), // not a focus skill and no role tag -> but roles [] means everyone
    open('o1', 'output-safety', 'concept', ['other-role']), // excluded
  ];

  it('selects role-relevant questions, weak topics first, deterministically', () => {
    const m = buildMock(items, role, 3, ['prompt-injection'], 'seed-1');
    expect(m).toHaveLength(3);
    expect(m[0]!.topic).toBe('prompt-injection');
    expect(m.map((i) => i.id)).not.toContain('o1');
    expect(buildMock(items, role, 3, ['prompt-injection'], 'seed-1')).toEqual(m);
    expect(m.some((i) => i.type === 'scenario' || i.type === 'troubleshooting')).toBe(true);
  });

  it('never returns more questions than exist', () => {
    expect(buildMock(items, role, 50, [], 's')).toHaveLength(5);
  });

  it('builds a scorecard where unanswered questions count as zero', () => {
    const s = (coverage: number) => ({ coverage, covered: [], missed: [], wordCount: 40, notes: [] });
    const card = scoreMock([
      { item: items[0]!, score: s(90) },
      { item: items[1]!, score: s(70) },
      { item: items[2]!, score: s(40) },
      { item: items[3]!, score: null },
    ]);
    expect(card).toMatchObject({ overall: 50, answered: 3, total: 4, weakTopics: ['prompt-injection'], strongTopics: ['testing'] });
    expect(card.byTopic).toEqual([
      { topic: 'prompt-injection', score: 20, count: 2 },
      { topic: 'testing', score: 80, count: 2 },
    ]);
    expect(mockXp(card)).toBe(30);
    expect(mockXp({ ...card, answered: 0 })).toBe(0);
  });
});
