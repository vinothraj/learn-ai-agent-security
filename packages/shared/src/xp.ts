export const XP_RULES = {
  lessonComplete: 50,
  quizCorrect: 10,
  quizPerfectBonus: 20,
  dailyGoalMet: 30,
} as const;

export const GAME_XP = { perCorrect: 5, perfectBonus: 10, dailyBonus: 20 } as const;
export const REVIEW_XP = 2;

export const LEVELS = [
  { title: 'Recruit', xp: 0 },
  { title: 'Analyst', xp: 200 },
  { title: 'Defender', xp: 600 },
  { title: 'Threat Hunter', xp: 1200 },
  { title: 'Red Teamer', xp: 2200 },
  { title: 'Security Architect', xp: 3600 },
  { title: 'Principal', xp: 5500 },
] as const;

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  currentFloor: number;
  nextAt: number | null;
  /** 0..1 progress to the next level; 1 at max level. */
  progress: number;
}

export function levelFor(xp: number): LevelInfo {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]!.xp) idx = i;
  const floor = LEVELS[idx]!.xp;
  const next = LEVELS[idx + 1]?.xp ?? null;
  return {
    level: idx + 1,
    title: LEVELS[idx]!.title,
    xp,
    currentFloor: floor,
    nextAt: next,
    progress: next === null ? 1 : (xp - floor) / (next - floor),
  };
}

export function quizXp(correct: number, total: number): number {
  if (total === 0) return 0;
  return correct * XP_RULES.quizCorrect + (correct === total ? XP_RULES.quizPerfectBonus : 0);
}
