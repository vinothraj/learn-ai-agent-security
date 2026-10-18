import { contentPack } from '@laas/content';
import { pickDaily, type Game } from '@laas/shared';

/** Today's daily-challenge game: the same for every learner on a given day. */
export function dailyGame(today: string): Game {
  return pickDaily(contentPack.games, today, 'daily-game')!;
}

/** Rough review-time estimate shown as "≈ N min" (about 15 s per card). */
export function reviewMinutes(cards: number) {
  return Math.max(1, Math.round((cards * 15) / 60));
}
