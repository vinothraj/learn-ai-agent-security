import type { ContentPack, Flashcard, Game, InterviewItem, InterviewRole, Lab, Lesson } from '@laas/shared';
import { flashcards } from './flashcards';
import { games } from './games';
import { interviewBank, roles } from './interview';
export { fromLessons } from './interview';
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

/**
 * Replace the active content with a downloaded pack (already validated by the caller with
 * packIssues). Objects are updated in place so every existing import sees the new content.
 */
export function applyContentPack(pack: ContentPack) {
  Object.assign(contentPack, pack);
  const refill = <K, V>(map: Map<K, V>, entries: [K, V][]) => {
    map.clear();
    for (const [k, v] of entries) map.set(k, v);
  };
  refill(lessonById, pack.lessons.map((l) => [l.id, l]));
  refill(roadmapById, pack.roadmaps.map((r) => [r.id, r]));
  refill(gameById, pack.games.map((g) => [g.id, g]));
  refill(flashcardById, pack.flashcards.map((c) => [c.id, c]));
  refill(labById, pack.labs.map((l) => [l.id, l]));
  refill(interviewItemById, pack.interview.items.map((i) => [i.id, i]));
  refill(roleById, pack.interview.roles.map((r) => [r.id, r]));
  flashcardsByLesson.clear();
  for (const c of pack.flashcards) flashcardsByLesson.set(c.lessonId, [...(flashcardsByLesson.get(c.lessonId) ?? []), c]);
}

/** Numeric comparison of "YYYY.MM.N" style versions (so 2026.10.10 > 2026.10.9). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
