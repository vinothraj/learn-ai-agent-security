import type { ContentPack, Lesson, QuizQuestion, Roadmap } from './schema';

export function isLessonUnlocked(lesson: Lesson, completed: ReadonlySet<string>): boolean {
  return lesson.prerequisites.every((p) => completed.has(p));
}

export function roadmapProgress(roadmap: Roadmap, completed: ReadonlySet<string>) {
  const done = roadmap.lessonIds.filter((id) => completed.has(id)).length;
  const total = roadmap.lessonIds.length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

/**
 * Deterministic next-lesson choice: resume an unfinished lesson, otherwise the first
 * unlocked, incomplete lesson in the focus roadmap, then in other security roadmaps.
 */
export function nextLesson(
  pack: ContentPack,
  completed: ReadonlySet<string>,
  focusRoadmapId: string | null,
  inProgressId: string | null,
): Lesson | null {
  const byId = new Map(pack.lessons.map((l) => [l.id, l]));
  if (inProgressId && !completed.has(inProgressId) && byId.has(inProgressId)) {
    return byId.get(inProgressId)!;
  }
  const order = [...pack.roadmaps].sort((a, b) => {
    const rank = (r: Roadmap) => (r.id === focusRoadmapId ? 0 : r.kind === 'security' ? 1 : 2);
    return rank(a) - rank(b) || a.code.localeCompare(b.code);
  });
  for (const r of order) {
    for (const id of r.lessonIds) {
      const l = byId.get(id);
      if (l && !completed.has(id) && isLessonUnlocked(l, completed)) return l;
    }
  }
  return null;
}

export interface QuizScore {
  correct: number;
  total: number;
  percent: number;
}

export function scoreQuiz(questions: QuizQuestion[], answers: (number | null)[]): QuizScore {
  const correct = questions.filter((q, i) => answers[i] === q.correctIndex).length;
  const total = questions.length;
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct / total) * 100) };
}

/** FNV-1a: stable hash so "of the day" picks are identical for every learner on a given day. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickDaily<T>(items: readonly T[], day: string, salt: string): T | null {
  if (items.length === 0) return null;
  return items[hash(`${salt}:${day}`) % items.length]!;
}
