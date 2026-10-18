import type { Lesson } from '@laas/shared';

export type LessonStep =
  | { kind: 'objective' }
  | { kind: 'concept' }
  | { kind: 'example' }
  | { kind: 'defend' }
  | { kind: 'quiz'; index: number }
  | { kind: 'interview' }
  | { kind: 'done' };

export function lessonSteps(lesson: Lesson): LessonStep[] {
  return [
    { kind: 'objective' },
    { kind: 'concept' },
    { kind: 'example' },
    { kind: 'defend' },
    ...lesson.quiz.map((_, index) => ({ kind: 'quiz' as const, index })),
    { kind: 'interview' },
    { kind: 'done' },
  ];
}

export const lessonStepCount = (lesson: Lesson) => lessonSteps(lesson).length;

/** Index of the first quiz step; resumed lessons restart the quiz so scores stay honest. */
export const QUIZ_START = 4;
