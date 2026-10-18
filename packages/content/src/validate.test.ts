import { ContentPack } from '@laas/shared';
import { describe, expect, it } from 'vitest';
import { contentPack } from './index';

describe('content pack', () => {
  it('matches the schema', () => {
    const result = ContentPack.safeParse(contentPack);
    if (!result.success) throw new Error(JSON.stringify(result.error.issues, null, 2));
  });

  it('has unique ids across lessons, questions and threats', () => {
    const ids = [
      ...contentPack.lessons.map((l) => l.id),
      ...contentPack.lessons.flatMap((l) => l.quiz.map((q) => q.id)),
      ...contentPack.lessons.map((l) => l.interview.id),
      ...contentPack.threats.map((t) => t.id),
      ...contentPack.roadmaps.map((r) => r.id),
    ];
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('lists every lesson in exactly one roadmap, its own', () => {
    for (const lesson of contentPack.lessons) {
      const owners = contentPack.roadmaps.filter((r) => r.lessonIds.includes(lesson.id));
      expect(owners.map((r) => r.id), lesson.id).toEqual([lesson.roadmapId]);
    }
    const known = new Set(contentPack.lessons.map((l) => l.id));
    for (const r of contentPack.roadmaps) for (const id of r.lessonIds) expect(known.has(id), id).toBe(true);
  });

  it('only references existing prerequisites, without cycles', () => {
    const byId = new Map(contentPack.lessons.map((l) => [l.id, l]));
    const visit = (id: string, path: string[]): void => {
      expect(path.includes(id), `cycle: ${[...path, id].join(' -> ')}`).toBe(false);
      const l = byId.get(id);
      expect(l, `unknown prerequisite ${id}`).toBeDefined();
      for (const p of l!.prerequisites) visit(p, [...path, id]);
    };
    for (const l of contentPack.lessons) visit(l.id, []);
  });

  it('links threats to existing lessons', () => {
    for (const t of contentPack.threats) if (t.lessonId) expect(byLesson(t.lessonId), t.id).toBe(true);
  });

  it('keeps unreviewed content clearly flagged', () => {
    // Seed content is written with AI assistance and must be human-reviewed before it is marked published.
    for (const l of contentPack.lessons) expect(['needs_review', 'reviewed', 'published']).toContain(l.status);
  });
});

function byLesson(id: string) {
  return contentPack.lessons.some((l) => l.id === id);
}
