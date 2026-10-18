import { describe, expect, it } from 'vitest';
import { parseSnapshot, widgetLines } from './snapshot';

const base = { streak: 4, todayMinutes: 6, goalMinutes: 10, dueCards: 0, nextLesson: 'MCP security essentials', day: '2026-10-18' };

describe('widget lines', () => {
  it('invites a first lesson when there is no data', () => {
    expect(widgetLines(null, '2026-10-18').headline).toBe('Start your first lesson');
  });
  it('shows streak, progress and next step', () => {
    expect(widgetLines(base, '2026-10-18')).toEqual({ headline: '4-day streak · 6/10 min', detail: 'Next: MCP security essentials', action: 'aisec:///' });
    expect(widgetLines({ ...base, dueCards: 3 }, '2026-10-18')).toMatchObject({ detail: '3 flashcards ready to review', action: 'aisec:///review' });
    expect(widgetLines({ ...base, todayMinutes: 12 }, '2026-10-18').detail).toBe('Goal reached. Nice work today!');
  });
  it('does not carry yesterday’s minutes into today', () => {
    expect(widgetLines(base, '2026-10-19').headline).toBe('4-day streak · 0/10 min');
  });
  it('rejects malformed snapshots', () => {
    expect(parseSnapshot('{oops')).toBeNull();
    expect(parseSnapshot(JSON.stringify({ day: 1 }))).toBeNull();
    expect(parseSnapshot(JSON.stringify(base))).toEqual(base);
  });
});
