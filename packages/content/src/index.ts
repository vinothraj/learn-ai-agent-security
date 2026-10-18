import type { ContentPack, Flashcard, Game, InterviewItem, InterviewRole, Lab, Lesson } from '@laas/shared';
import { flashcards } from './flashcards';
import { games } from './games';
import { interviewBank, roles } from './interview';
import { agentLessons } from './lessons/agents';
import { foundationsLessons } from './lessons/foundations';
import { fundamentalsLessons } from './lessons/fundamentals';
import { genaiLessons } from './lessons/genai';
import { testingLessons } from './lessons/testing';
import { labsPart1 } from './labs/labs1';
import { labsPart2 } from './labs/labs2';
import { roadmaps } from './roadmaps';
import { skills } from './skills';
import { threats } from './threats';

export const CONTENT_VERSION = '2026.10.3';

const lessons = [...foundationsLessons, ...genaiLessons, ...agentLessons, ...testingLessons, ...fundamentalsLessons];

export const contentPack: ContentPack = {
  version: CONTENT_VERSION,
  roadmaps,
  lessons,
  threats,
  flashcards,
  games,
  skills,
  labs: [...labsPart1, ...labsPart2],
  interview: { roles, items: interviewBank(lessons, skills) },
};

export const lessonById = new Map<string, Lesson>(contentPack.lessons.map((l) => [l.id, l]));
export const roadmapById = new Map(contentPack.roadmaps.map((r) => [r.id, r]));
export const gameById = new Map<string, Game>(contentPack.games.map((g) => [g.id, g]));
export const flashcardById = new Map<string, Flashcard>(contentPack.flashcards.map((c) => [c.id, c]));
export const flashcardsByLesson = new Map<string, Flashcard[]>();
for (const c of contentPack.flashcards) {
  flashcardsByLesson.set(c.lessonId, [...(flashcardsByLesson.get(c.lessonId) ?? []), c]);
}
export const labById = new Map<string, Lab>(contentPack.labs.map((l) => [l.id, l]));
export const interviewItemById = new Map<string, InterviewItem>(contentPack.interview.items.map((i) => [i.id, i]));
export const roleById = new Map<string, InterviewRole>(contentPack.interview.roles.map((r) => [r.id, r]));
