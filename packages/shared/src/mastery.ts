import type { SkillArea } from './schema';

/**
 * Per-lesson mastery (0-100), deterministic and explainable:
 *  - quiz/game evidence, weighted by recency (half-life 21 days)
 *  - shrunk toward 0 until there is enough evidence (n / (n + 2))
 *  - blended 70/30 with average flashcard recall probability when cards have been reviewed
 */
export interface Evidence {
  lessonId: string;
  correct: boolean;
  at: number; // epoch ms
}

export interface LessonMastery {
  lessonId: string;
  score: number;
  attempts: number;
}

const HALF_LIFE_DAYS = 21;
const DAY_MS = 86_400_000;

export function lessonMastery(
  evidence: readonly Evidence[],
  recall: ReadonlyMap<string, readonly number[]>,
  now: number,
): Map<string, LessonMastery> {
  const acc = new Map<string, { w: number; wc: number; n: number }>();
  for (const e of evidence) {
    if (e.at > now) continue;
    const w = Math.pow(0.5, (now - e.at) / DAY_MS / HALF_LIFE_DAYS);
    const a = acc.get(e.lessonId) ?? { w: 0, wc: 0, n: 0 };
    a.w += w;
    a.wc += e.correct ? w : 0;
    a.n += 1;
    acc.set(e.lessonId, a);
  }

  const out = new Map<string, LessonMastery>();
  const ids = new Set([...acc.keys(), ...recall.keys()]);
  for (const lessonId of ids) {
    const a = acc.get(lessonId);
    const quiz = a && a.w > 0 ? (a.wc / a.w) * (a.n / (a.n + 2)) : 0;
    const r = recall.get(lessonId) ?? [];
    const recallAvg = r.length ? r.reduce((s, v) => s + v, 0) / r.length : null;
    const blended = recallAvg === null ? quiz : 0.7 * quiz + 0.3 * recallAvg;
    out.set(lessonId, { lessonId, score: Math.round(blended * 100), attempts: a?.n ?? 0 });
  }
  return out;
}

/** Skill mastery = mean over its lessons, counting unstudied lessons as 0 (shows coverage). */
export function skillScores(skills: readonly SkillArea[], mastery: ReadonlyMap<string, LessonMastery>) {
  return skills.map((s) => ({
    id: s.id,
    label: s.label,
    score: s.lessonIds.length
      ? Math.round(s.lessonIds.reduce((sum, id) => sum + (mastery.get(id)?.score ?? 0), 0) / s.lessonIds.length)
      : 0,
  }));
}

/** Studied lessons below the threshold with enough evidence to be meaningful, weakest first. */
export function weakTopics(mastery: ReadonlyMap<string, LessonMastery>, threshold = 60, minAttempts = 2): LessonMastery[] {
  return [...mastery.values()]
    .filter((m) => m.attempts >= minAttempts && m.score < threshold)
    .sort((a, b) => a.score - b.score || a.lessonId.localeCompare(b.lessonId));
}

/** Overall quiz-based mastery at the end of each of the last `weeks` weeks (for a trend line). */
export function masteryTrend(
  evidence: readonly Evidence[],
  lessonIds: readonly string[],
  now: number,
  weeks = 8,
): { at: number; score: number }[] {
  const points: { at: number; score: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const at = now - i * 7 * DAY_MS;
    const m = lessonMastery(evidence, new Map(), at);
    const score = lessonIds.length
      ? Math.round(lessonIds.reduce((s, id) => s + (m.get(id)?.score ?? 0), 0) / lessonIds.length)
      : 0;
    points.push({ at, score });
  }
  return points;
}
