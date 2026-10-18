import { describe, expect, it } from 'vitest';
import { mergeRecord, SyncRequest, type SyncEnvelope } from './index';

const lp = (data: Partial<Record<string, unknown>>, updatedAt: number): SyncEnvelope => ({
  collection: 'lesson_progress',
  key: 'b-prompt-injection',
  updatedAt,
  data: {
    lessonId: 'b-prompt-injection',
    status: 'in_progress',
    step: 2,
    bestScore: null,
    attempts: 0,
    startedAt: 1000,
    updatedAt,
    completedAt: null,
    completedDay: null,
    ...data,
  },
});

describe('sync merge', () => {
  it('keeps "completed" even when a stale in-progress copy arrives later', () => {
    const done = lp({ status: 'completed', step: 0, bestScore: 67, attempts: 1, completedAt: 5000, completedDay: '2026-10-18' }, 5000);
    const stale = lp({ step: 4, startedAt: 900 }, 9000);
    for (const m of [mergeRecord(done, stale), mergeRecord(stale, done)]) {
      expect(m.data).toMatchObject({ status: 'completed', step: 0, bestScore: 67, attempts: 1, startedAt: 900, completedAt: 5000 });
    }
  });

  it('takes the max best score and attempts across devices', () => {
    const a = lp({ status: 'completed', bestScore: 50, attempts: 2, completedAt: 3000, completedDay: '2026-10-17' }, 3000);
    const b = lp({ status: 'completed', bestScore: 100, attempts: 1, completedAt: 4000, completedDay: '2026-10-18' }, 4000);
    expect(mergeRecord(a, b).data).toMatchObject({ bestScore: 100, attempts: 2, completedAt: 3000, completedDay: '2026-10-17' });
  });

  it('treats logs as immutable and ignores tombstones for them', () => {
    const r: SyncEnvelope = { collection: 'xp_ledger', key: 'lesson_complete:x', updatedAt: 1, data: { day: '2026-10-18', amount: 50, reason: 'lesson_complete', ref: 'x', createdAt: 1 } };
    expect(mergeRecord(r, { ...r, updatedAt: 9, data: { ...r.data, amount: 999 } })).toBe(r);
    expect(mergeRecord(r, { ...r, deleted: true, updatedAt: 9 })).toBe(r);
  });

  it('lets study sessions grow and keeps the earliest daily challenge', () => {
    const s: SyncEnvelope = { collection: 'study_sessions', key: 's1', updatedAt: 1, data: { day: '2026-10-18', activity: 'lesson', contentId: null, startedAt: 0, endedAt: 60_000, activeSeconds: 60 } };
    expect(mergeRecord(s, { ...s, updatedAt: 2, data: { ...s.data, endedAt: 90_000, activeSeconds: 85 } }).data).toMatchObject({ activeSeconds: 85, endedAt: 90_000 });
    expect(mergeRecord({ ...s, data: { ...s.data, activeSeconds: 85 } }, { ...s, data: { ...s.data, activeSeconds: 10 } }).data.activeSeconds).toBe(85);
    const d = (completedAt: number, correct: number): SyncEnvelope => ({ collection: 'daily_challenges', key: '2026-10-18', updatedAt: completedAt, data: { day: '2026-10-18', gameId: 'g', correct, total: 5, completedAt } });
    expect(mergeRecord(d(200, 5), d(100, 2)).data.correct).toBe(2);
  });

  it('adds a later self-rating to an interview answer without changing its score', () => {
    const base: SyncEnvelope = {
      collection: 'interview_answers',
      key: 'dev1:7',
      updatedAt: 1,
      data: { questionId: 'q', lessonId: null, topic: 't', mode: 'practice', sessionId: null, answer: 'x', coverage: 40, selfRating: null, day: '2026-10-18', createdAt: 1 },
    };
    const rated = mergeRecord(base, { ...base, updatedAt: 5, data: { ...base.data, coverage: 100, selfRating: 3 } });
    expect(rated.data).toMatchObject({ coverage: 40, selfRating: 3 });
  });

  it('applies last-write-wins with deletes for bookmarks', () => {
    const b: SyncEnvelope = { collection: 'interview_bookmarks', key: 'q1', updatedAt: 10, data: { questionId: 'q1', createdAt: 10 } };
    expect(mergeRecord(b, { ...b, updatedAt: 20, deleted: true }).deleted).toBe(true);
    expect(mergeRecord({ ...b, updatedAt: 30 }, { ...b, updatedAt: 20, deleted: true }).deleted).toBeUndefined();
  });
});

describe('sync request validation', () => {
  it('validates payloads strictly per collection', () => {
    const ok = SyncRequest.safeParse({ cursor: 0, changes: [lp({}, 1)] });
    expect(ok.success).toBe(true);
    const extra = SyncRequest.safeParse({ cursor: 0, changes: [{ ...lp({}, 1), data: { ...lp({}, 1).data, isAdmin: true } }] });
    expect(extra.success).toBe(false);
    const unknown = SyncRequest.safeParse({ cursor: 0, changes: [{ collection: 'users', key: 'x', updatedAt: 1, data: {} }] });
    expect(unknown.success).toBe(false);
    const huge = SyncRequest.safeParse({
      cursor: 0,
      changes: [{ collection: 'interview_bookmarks', key: 'q', updatedAt: 1, data: { questionId: 'q'.repeat(500), createdAt: 1 } }],
    });
    expect(huge.success).toBe(false);
  });
});

describe('record comparison', () => {
  it('ignores key order (Postgres jsonb reorders keys) but not values', async () => {
    const { sameRecord } = await import('./index');
    const a: SyncEnvelope = { collection: 'profile', key: 'profile', updatedAt: 1, data: { displayName: 'A', goalMinutes: 10, focusRoadmapId: 'x', targetRole: 'r', gamification: true } };
    const reordered: SyncEnvelope = { ...a, updatedAt: 99, data: { gamification: true, targetRole: 'r', focusRoadmapId: 'x', goalMinutes: 10, displayName: 'A' } };
    expect(sameRecord(a, reordered)).toBe(true);
    expect(sameRecord(a, { ...a, data: { ...a.data, goalMinutes: 15 } })).toBe(false);
    expect(sameRecord(a, { ...a, deleted: true })).toBe(false);
  });
});
