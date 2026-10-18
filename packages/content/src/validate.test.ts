import { packIssues } from '@laas/shared';
import { describe, expect, it } from 'vitest';
import { contentPack } from './index';

describe('content pack', () => {
  it('passes every integrity rule (schema, references, labs, rubrics, role plans)', () => {
    expect(packIssues(contentPack)).toEqual([]);
  });

  it('ships the launch inventory', () => {
    expect(contentPack.labs).toHaveLength(10);
    expect(new Set(contentPack.labs.map((l) => l.category)).size).toBe(10);
    expect(contentPack.games).toHaveLength(7);
    expect(contentPack.skills).toHaveLength(6);
    expect(contentPack.interview.roles).toHaveLength(7);
  });

  it('keeps unreviewed content clearly flagged', () => {
    // Seed content is written with AI assistance and must be human-reviewed before it is marked published.
    for (const l of contentPack.lessons) expect(['needs_review', 'reviewed', 'published']).toContain(l.status);
  });

  it('reports concrete problems for a broken pack', () => {
    const broken = structuredClone(contentPack);
    broken.lessons[0]!.prerequisites = ['does-not-exist'];
    broken.flashcards = broken.flashcards.filter((c) => c.lessonId !== broken.lessons[1]!.id);
    broken.interview.items[0]!.rubric = [{ concept: 'quantum entanglement' }, { concept: 'blockchain consensus' }, { concept: 'origami folding' }];
    const issues = packIssues(broken);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('prerequisite does-not-exist'),
        `lesson ${broken.lessons[1]!.id}: needs at least 3 flashcards`,
        expect.stringMatching(/model answer covers only 0%/),
      ]),
    );
    expect(packIssues({ version: 1 })[0]).toMatch(/^schema:/);
  });
});

describe('over-the-air content updates', () => {
  it('applies a pack in place and compares versions numerically', async () => {
    const { applyContentPack, compareVersions, lessonById, contentPack: live } = await import('./index');
    const original = structuredClone(live);
    const next = structuredClone(original);
    next.version = '2026.10.99';
    next.lessons[0]!.title = 'Updated over the air';
    applyContentPack(next);
    expect(lessonById.get(next.lessons[0]!.id)!.title).toBe('Updated over the air');
    expect(live.version).toBe('2026.10.99');
    applyContentPack(original);
    expect(lessonById.get(original.lessons[0]!.id)!.title).toBe(original.lessons[0]!.title);
    expect(compareVersions('2026.10.10', '2026.10.9')).toBe(1);
    expect(compareVersions('2026.10.3', '2026.10.3')).toBe(0);
    expect(compareVersions('2026.9.40', '2026.10.1')).toBe(-1);
  });
});
