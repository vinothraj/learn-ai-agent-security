export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export const DAY_PARTS: { id: DayPart; label: string; reminder: [number, number] }[] = [
  { id: 'morning', label: 'Morning', reminder: [7, 30] },
  { id: 'afternoon', label: 'Afternoon', reminder: [12, 30] },
  { id: 'evening', label: 'Evening', reminder: [18, 0] },
  { id: 'night', label: 'Night', reminder: [21, 30] },
];

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** Total active seconds per part of the day, from local session start times. */
export function timeOfDayTotals(sessions: readonly { startedAt: number; seconds: number }[]): Record<DayPart, number> {
  const out: Record<DayPart, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const s of sessions) out[dayPart(new Date(s.startedAt).getHours())] += s.seconds;
  return out;
}

/**
 * Suggest moving the reminder to when the learner actually studies, only with enough data
 * (>= 30 active minutes) and a clear favourite (>= 50% of time) that differs from the current slot.
 */
export function suggestReminder(
  totals: Record<DayPart, number>,
  currentHour: number,
): { part: DayPart; label: string; hour: number; minute: number } | null {
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  if (total < 30 * 60) return null;
  const best = DAY_PARTS.reduce((b, p) => (totals[p.id] > totals[b.id] ? p : b));
  if (totals[best.id] / total < 0.5 || dayPart(currentHour) === best.id) return null;
  return { part: best.id, label: best.label, hour: best.reminder[0], minute: best.reminder[1] };
}

/** Quiz accuracy split by part of day; used only when both groups have enough attempts. */
export function accuracyByPart(responses: readonly { at: number; correct: boolean }[]) {
  const out: Record<DayPart, { n: number; c: number }> = {
    morning: { n: 0, c: 0 },
    afternoon: { n: 0, c: 0 },
    evening: { n: 0, c: 0 },
    night: { n: 0, c: 0 },
  };
  for (const r of responses) {
    const g = out[dayPart(new Date(r.at).getHours())];
    g.n++;
    if (r.correct) g.c++;
  }
  return out;
}
