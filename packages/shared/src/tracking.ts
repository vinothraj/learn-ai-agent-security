/**
 * Active learning time. Time counts only while the app is in the foreground on a
 * learning screen AND the learner interacted within the idle window. Never padded.
 */
export const IDLE_CUTOFF_MS = 60_000;
/** Guards against clock jumps or a suspended JS thread crediting huge spans. */
export const MAX_TICK_MS = 30_000;

export interface TickInput {
  lastTickAt: number;
  now: number;
  lastInteractionAt: number;
  foreground: boolean;
}

/** Milliseconds of active time to credit for the interval [lastTickAt, now]. */
export function activeMsForTick({ lastTickAt, now, lastInteractionAt, foreground }: TickInput): number {
  if (!foreground || now <= lastTickAt) return 0;
  const activeUntil = Math.min(now, lastInteractionAt + IDLE_CUTOFF_MS);
  const credited = activeUntil - lastTickAt;
  if (credited <= 0) return 0;
  return Math.min(credited, MAX_TICK_MS);
}
