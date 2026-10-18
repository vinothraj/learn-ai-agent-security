import { describe, expect, it } from 'vitest';
import { atLeast } from './api';

describe('role helpers (UI only; the API enforces permissions)', () => {
  it('orders roles learner < editor < admin < super_admin', () => {
    expect(atLeast('editor', 'editor')).toBe(true);
    expect(atLeast('editor', 'admin')).toBe(false);
    expect(atLeast('super_admin', 'admin')).toBe(true);
    expect(atLeast(undefined, 'learner')).toBe(false);
  });
});
