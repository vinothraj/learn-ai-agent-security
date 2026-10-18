/** What the home-screen widget shows. Computed in the app, stored in SQLite for the headless widget task. */
export interface WidgetSnapshot {
  streak: number;
  todayMinutes: number;
  goalMinutes: number;
  dueCards: number;
  nextLesson: string | null;
  /** Local day the snapshot describes; a stale day shows zero minutes. */
  day: string;
}

export const WIDGET_NAME = 'Progress';
export const SNAPSHOT_KEY = 'widget_snapshot';
export const DB_NAME = 'learn-ai-security.db';

export function parseSnapshot(raw: string | undefined | null): WidgetSnapshot | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<WidgetSnapshot>;
    if (typeof s.streak !== 'number' || typeof s.day !== 'string') return null;
    return {
      streak: s.streak,
      todayMinutes: s.todayMinutes ?? 0,
      goalMinutes: s.goalMinutes ?? 10,
      dueCards: s.dueCards ?? 0,
      nextLesson: s.nextLesson ?? null,
      day: s.day,
    };
  } catch {
    return null;
  }
}

/** Lines shown on the widget; pure so it can be unit-tested. */
export function widgetLines(s: WidgetSnapshot | null, today: string) {
  if (!s) return { headline: 'Start your first lesson', detail: '5 minutes a day builds real AI security skills', action: 'aisec:///' };
  const minutes = s.day === today ? s.todayMinutes : 0;
  const done = minutes >= s.goalMinutes;
  const headline = s.streak > 0 ? `${s.streak}-day streak · ${minutes}/${s.goalMinutes} min` : `${minutes}/${s.goalMinutes} min today`;
  if (s.dueCards > 0 && s.day === today) return { headline, detail: `${s.dueCards} flashcard${s.dueCards === 1 ? '' : 's'} ready to review`, action: 'aisec:///review' };
  if (done) return { headline, detail: 'Goal reached. Nice work today!', action: 'aisec:///' };
  return { headline, detail: s.nextLesson ? `Next: ${s.nextLesson}` : 'Pick up where you left off', action: 'aisec:///' };
}
