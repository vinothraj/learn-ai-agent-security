import type { InterviewItem, Lesson, SkillArea } from '@laas/shared';
import { bank } from './bank';
import { bank2 } from './bank2';
import { roles } from './roles';

export { roles };

/** Every lesson's interview question also joins the bank, scored on its key concepts. */
export function fromLessons(lessons: readonly Lesson[], skills: readonly SkillArea[]): InterviewItem[] {
  return lessons.map((l) => ({
    id: l.interview.id,
    type: 'concept' as const,
    topic: skills.find((s) => s.lessonIds.includes(l.id))?.id ?? 'threat-modeling',
    level: l.level,
    roles: [],
    question: l.interview.question,
    modelAnswer: l.interview.modelAnswer,
    reasoning: `Covered in the lesson "${l.title}".`,
    followUps: [],
    rubric: l.interview.keyConcepts.map((concept) => ({ concept })),
    evidence: l.interview.evidence,
    lessonId: l.id,
  }));
}

export function interviewBank(lessons: readonly Lesson[], skills: readonly SkillArea[]): InterviewItem[] {
  return [...bank, ...bank2, ...fromLessons(lessons, skills)];
}
