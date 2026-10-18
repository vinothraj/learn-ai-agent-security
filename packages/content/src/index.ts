import type { ContentPack, Flashcard, Game, Lab, Lesson } from '@laas/shared';
import { flashcards } from './flashcards';
import { games } from './games';
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

export const CONTENT_VERSION = '2026.10.2';

export const contentPack: ContentPack = {
  version: CONTENT_VERSION,
  roadmaps,
  lessons: [...foundationsLessons, ...genaiLessons, ...agentLessons, ...testingLessons, ...fundamentalsLessons],
  threats,
  flashcards,
  games,
  skills,
  labs: [...labsPart1, ...labsPart2],
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
