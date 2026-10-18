import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';

/**
 * Spaced repetition with FSRS (open-source, MIT). Cards are stored as JSON;
 * these helpers keep Date revival and scheduler settings in one place.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, request_retention: 0.9 }));

export { Rating, State };
export type { Card, Grade };

export const GRADES: { grade: Grade; label: string }[] = [
  { grade: Rating.Again, label: 'Again' },
  { grade: Rating.Hard, label: 'Hard' },
  { grade: Rating.Good, label: 'Good' },
  { grade: Rating.Easy, label: 'Easy' },
];

export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

export function reviewCard(card: Card, grade: Grade, now: Date): Card {
  return scheduler.next(card, now, grade).card;
}

/** The interval each grade would schedule, for labelling the answer buttons. */
export function previewIntervals(card: Card, now: Date): Record<Grade, number> {
  const preview = scheduler.repeat(card, now);
  const out = {} as Record<Grade, number>;
  for (const { grade } of GRADES) out[grade] = preview[grade].card.due.getTime() - now.getTime();
  return out;
}

/** Probability (0..1) the learner can still recall the card now; null if never reviewed. */
export function retrievability(card: Card, now: Date): number | null {
  if (card.state === State.New || !card.last_review) return null;
  return scheduler.get_retrievability(card, now, false);
}

export function serializeCard(card: Card): string {
  return JSON.stringify(card);
}

export function deserializeCard(json: string): Card {
  const raw = JSON.parse(json) as Card & { due: string; last_review?: string };
  return {
    ...raw,
    due: new Date(raw.due),
    last_review: raw.last_review ? new Date(raw.last_review) : undefined,
  };
}

/** Compact interval label: "<1m", "10m", "3h", "4d", "2mo". */
export function formatInterval(ms: number): string {
  const min = ms / 60_000;
  if (min < 1) return '<1m';
  if (min < 60) return `${Math.round(min)}m`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)}d`;
  const mo = d / 30;
  if (mo < 12) return `${Math.round(mo)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}
