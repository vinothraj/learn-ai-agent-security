import { z } from 'zod';
import { InterviewItem, InterviewRole } from './interview';
import { Lab } from './labs';
import { Flashcard, Game, Lesson, Roadmap, SkillArea, ThreatItem } from './schema';

/** Everything that ships in (or is downloaded into) the app as one versioned content pack. */
export const ContentPack = z.object({
  version: z.string(),
  roadmaps: z.array(Roadmap),
  lessons: z.array(Lesson),
  threats: z.array(ThreatItem),
  flashcards: z.array(Flashcard),
  games: z.array(Game),
  skills: z.array(SkillArea),
  labs: z.array(Lab),
  interview: z.object({ roles: z.array(InterviewRole), items: z.array(InterviewItem) }),
});
export type ContentPack = z.infer<typeof ContentPack>;
