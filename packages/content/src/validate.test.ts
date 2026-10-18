import { ContentPack, itemsForRole, labIssues, scoreAnswer } from '@laas/shared';
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

  it('gives every lesson at least 3 flashcards that point at real lessons', () => {
    for (const l of contentPack.lessons) {
      expect(contentPack.flashcards.filter((c) => c.lessonId === l.id).length, l.id).toBeGreaterThanOrEqual(3);
    }
    for (const c of contentPack.flashcards) expect(byLesson(c.lessonId), c.id).toBe(true);
  });

  it('has 7 games with unique round ids, valid lesson links and unambiguous match pairs', () => {
    expect(contentPack.games).toHaveLength(7);
    const roundIds = contentPack.games.flatMap((g) => g.rounds.map((r) => r.id));
    expect(new Set(roundIds).size).toBe(roundIds.length);
    for (const g of contentPack.games) {
      for (const r of g.rounds) {
        if (r.lessonId) expect(byLesson(r.lessonId), r.id).toBe(true);
        if (g.kind === 'match' && 'pairs' in r) {
          const lefts = r.pairs.map((p) => p.left);
          const rights = r.pairs.map((p) => p.right);
          expect(new Set(lefts).size, r.id).toBe(lefts.length);
          expect(new Set(rights).size, r.id).toBe(rights.length);
        }
      }
    }
  });

  it('covers every lesson with at least one radar skill', () => {
    const covered = new Set(contentPack.skills.flatMap((s) => s.lessonIds));
    for (const s of contentPack.skills) for (const id of s.lessonIds) expect(byLesson(id), `${s.id}:${id}`).toBe(true);
    for (const l of contentPack.lessons) expect(covered.has(l.id), l.id).toBe(true);
    expect(contentPack.skills).toHaveLength(6);
  });

  it('only recommends supporting lessons from the supporting roadmap', () => {
    const supporting = new Set(contentPack.roadmaps.filter((r) => r.kind === 'supporting').flatMap((r) => r.lessonIds));
    for (const l of contentPack.lessons) for (const s of l.supportLessons ?? []) expect(supporting.has(s), `${l.id} -> ${s}`).toBe(true);
  });

  it('does not always put the right answer in the same slot for fixed-order (A/B) rounds', () => {
    // Other multiple-choice options are shuffled at display time; labelled A/B designs are not.
    for (const g of contentPack.games) {
      if (g.kind !== 'choice') continue;
      const fixed = g.rounds.filter((r) => r.options.every((o) => /^[A-Z]: /.test(o)));
      if (fixed.length < 4) continue;
      const counts = new Map<number, number>();
      for (const r of fixed) counts.set(r.correctIndex, (counts.get(r.correctIndex) ?? 0) + 1);
      expect(Math.max(...counts.values()) / fixed.length, g.id).toBeLessThanOrEqual(0.67);
    }
  });

  it('ships 10 internally consistent labs covering the required categories', () => {
    expect(contentPack.labs).toHaveLength(10);
    expect(new Set(contentPack.labs.map((l) => l.category)).size).toBe(10);
    for (const lab of contentPack.labs) {
      expect(labIssues(lab), lab.id).toEqual([]);
      if (lab.lessonId) expect(byLesson(lab.lessonId), lab.id).toBe(true);
    }
    const attackIds = contentPack.labs.flatMap((l) => l.attacks.map((a) => a.id));
    expect(new Set(attackIds).size).toBe(attackIds.length);
  });

  it('has a consistent interview bank and 7 role plans that only reference real content', () => {
    const { roles, items } = contentPack.interview;
    expect(roles).toHaveLength(7);
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const skills = new Set(contentPack.skills.map((s) => s.id));
    const roleIds = new Set(roles.map((r) => r.id));
    for (const i of items) {
      expect(skills.has(i.topic), `${i.id} topic`).toBe(true);
      for (const r of i.roles) expect(roleIds.has(r), `${i.id} role ${r}`).toBe(true);
      if (i.lessonId) expect(byLesson(i.lessonId), `${i.id} lesson`).toBe(true);
    }
    const labs = new Set(contentPack.labs.map((l) => l.id));
    const games = new Set(contentPack.games.map((g) => g.id));
    for (const r of roles) {
      for (const s of r.focusSkills) expect(skills.has(s), `${r.id} skill ${s}`).toBe(true);
      for (const w of r.weeks)
        for (const t of w.tasks) {
          const [kind, ref] = t.split(':');
          if (kind === 'lesson') expect(byLesson(ref!), `${r.id} ${t}`).toBe(true);
          if (kind === 'lab') expect(labs.has(ref!), `${r.id} ${t}`).toBe(true);
          if (kind === 'game') expect(games.has(ref!), `${r.id} ${t}`).toBe(true);
          if (kind === 'topic') expect(skills.has(ref!), `${r.id} ${t}`).toBe(true);
        }
      // Each role needs enough questions for the longest (30 min, 10 question) mock.
      expect(itemsForRole(items, r).length, r.id).toBeGreaterThanOrEqual(10);
    }
  });

  it('scores every model answer highly on its own rubric (keywords are reachable)', () => {
    for (const i of contentPack.interview.items) {
      if (i.type === 'mcq') continue;
      const s = scoreAnswer(i, i.modelAnswer);
      expect(s.coverage, `${i.id} missed: ${s.missed.join(' | ')}`).toBeGreaterThanOrEqual(80);
    }
  });

  it('gives a vague, generic answer a low score', () => {
    const vague = 'I would make sure it is secure and follow best practices and talk to the team about it.';
    for (const i of contentPack.interview.items) {
      if (i.type === 'mcq') continue;
      expect(scoreAnswer(i, vague).coverage, i.id).toBeLessThanOrEqual(40);
    }
  });

  it('keeps unreviewed content clearly flagged', () => {
    // Seed content is written with AI assistance and must be human-reviewed before it is marked published.
    for (const l of contentPack.lessons) expect(['needs_review', 'reviewed', 'published']).toContain(l.status);
  });
});

function byLesson(id: string) {
  return contentPack.lessons.some((l) => l.id === id);
}
