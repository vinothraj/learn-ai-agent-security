import type { ContentPack, Lesson } from '@laas/shared';
import { agentLessons } from './lessons/agents';
import { foundationsLessons } from './lessons/foundations';
import { genaiLessons } from './lessons/genai';
import { roadmaps } from './roadmaps';
import { threats } from './threats';

export const CONTENT_VERSION = '2026.10.0';

export const contentPack: ContentPack = {
  version: CONTENT_VERSION,
  roadmaps,
  lessons: [...foundationsLessons, ...genaiLessons, ...agentLessons],
  threats,
};

export const lessonById = new Map<string, Lesson>(contentPack.lessons.map((l) => [l.id, l]));
export const roadmapById = new Map(contentPack.roadmaps.map((r) => [r.id, r]));
