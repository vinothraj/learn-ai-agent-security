import { itemsForRole, scoreAnswer } from './interview';
import { labIssues } from './labs';
import { ContentPack } from './pack';

const VAGUE_ANSWER = 'I would make sure it is secure and follow best practices and talk to the team about it.';
const MAX_ISSUES = 50;

/**
 * Every integrity rule a content pack must satisfy before it can ship, in one place: used by the
 * repository tests, by the API before an admin can publish a version, and by the app before it
 * applies a downloaded pack. Returns human-readable problems (empty = valid).
 */
export function packIssues(input: unknown): string[] {
  const parsed = ContentPack.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.slice(0, MAX_ISSUES).map((i) => `schema: ${i.path.join('.') || '(root)'}: ${i.message}`);
  }
  const p = parsed.data;
  const out: string[] = [];
  const push = (msg: string) => out.length < MAX_ISSUES && out.push(msg);

  const lessonIds = new Set(p.lessons.map((l) => l.id));
  const labIds = new Set(p.labs.map((l) => l.id));
  const gameIds = new Set(p.games.map((g) => g.id));
  const skillIds = new Set(p.skills.map((s) => s.id));

  const dupes = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) push(`${label}: duplicate id ${id}`);
      seen.add(id);
    }
  };
  dupes('ids', [
    ...p.lessons.map((l) => l.id),
    ...p.lessons.flatMap((l) => l.quiz.map((q) => q.id)),
    ...p.lessons.map((l) => l.interview.id),
    ...p.threats.map((t) => t.id),
    ...p.roadmaps.map((r) => r.id),
  ]);
  dupes('flashcards', p.flashcards.map((c) => c.id));
  dupes('game rounds', p.games.flatMap((g) => g.rounds.map((r) => r.id)));
  dupes('labs', p.labs.map((l) => l.id));
  dupes('lab attacks', p.labs.flatMap((l) => l.attacks.map((a) => a.id)));
  dupes('interview items', p.interview.items.map((i) => i.id));

  // Roadmaps and prerequisites
  for (const l of p.lessons) {
    const owners = p.roadmaps.filter((r) => r.lessonIds.includes(l.id)).map((r) => r.id);
    if (owners.length !== 1 || owners[0] !== l.roadmapId) push(`lesson ${l.id}: must appear in exactly its own roadmap (${l.roadmapId}), found [${owners.join(', ')}]`);
  }
  for (const r of p.roadmaps) for (const id of r.lessonIds) if (!lessonIds.has(id)) push(`roadmap ${r.id}: unknown lesson ${id}`);
  const byId = new Map(p.lessons.map((l) => [l.id, l]));
  const cyclic = new Set<string>();
  const visit = (id: string, path: string[]) => {
    if (path.includes(id)) {
      cyclic.add([...path, id].join(' -> '));
      return;
    }
    const l = byId.get(id);
    if (!l) return push(`prerequisite ${id} (from ${path[path.length - 1]}) does not exist`);
    for (const pre of l.prerequisites) visit(pre, [...path, id]);
  };
  for (const l of p.lessons) visit(l.id, []);
  for (const c of cyclic) push(`prerequisite cycle: ${c}`);

  const supporting = new Set(p.roadmaps.filter((r) => r.kind === 'supporting').flatMap((r) => r.lessonIds));
  for (const l of p.lessons) for (const s of l.supportLessons ?? []) if (!supporting.has(s)) push(`lesson ${l.id}: support lesson ${s} is not in a supporting roadmap`);

  // Linked content
  for (const t of p.threats) if (t.lessonId && !lessonIds.has(t.lessonId)) push(`threat ${t.id}: unknown lesson ${t.lessonId}`);
  for (const l of p.lessons) if (p.flashcards.filter((c) => c.lessonId === l.id).length < 3) push(`lesson ${l.id}: needs at least 3 flashcards`);
  for (const c of p.flashcards) if (!lessonIds.has(c.lessonId)) push(`flashcard ${c.id}: unknown lesson ${c.lessonId}`);
  for (const g of p.games) {
    for (const r of g.rounds) {
      if (r.lessonId && !lessonIds.has(r.lessonId)) push(`game round ${r.id}: unknown lesson ${r.lessonId}`);
      if ('pairs' in r) {
        if (new Set(r.pairs.map((x) => x.left)).size !== r.pairs.length || new Set(r.pairs.map((x) => x.right)).size !== r.pairs.length) {
          push(`match round ${r.id}: pair texts must be unique`);
        }
      }
    }
    if (g.kind === 'choice') {
      const fixed = g.rounds.filter((r) => r.options.every((o) => /^[A-Z]: /.test(o)));
      if (fixed.length >= 4) {
        const counts = new Map<number, number>();
        for (const r of fixed) counts.set(r.correctIndex, (counts.get(r.correctIndex) ?? 0) + 1);
        if (Math.max(...counts.values()) / fixed.length > 0.67) push(`game ${g.id}: correct answers in fixed-order rounds are too predictable`);
      }
    }
  }
  const covered = new Set(p.skills.flatMap((s) => s.lessonIds));
  for (const s of p.skills) for (const id of s.lessonIds) if (!lessonIds.has(id)) push(`skill ${s.id}: unknown lesson ${id}`);
  for (const l of p.lessons) if (!covered.has(l.id)) push(`lesson ${l.id}: not covered by any radar skill`);

  // Labs
  for (const lab of p.labs) {
    for (const issue of labIssues(lab)) push(`lab ${lab.id}: ${issue}`);
    if (lab.lessonId && !lessonIds.has(lab.lessonId)) push(`lab ${lab.id}: unknown lesson ${lab.lessonId}`);
  }

  // Interview
  const roleIds = new Set(p.interview.roles.map((r) => r.id));
  for (const i of p.interview.items) {
    if (!skillIds.has(i.topic)) push(`interview ${i.id}: unknown topic ${i.topic}`);
    for (const r of i.roles) if (!roleIds.has(r)) push(`interview ${i.id}: unknown role ${r}`);
    if (i.lessonId && !lessonIds.has(i.lessonId)) push(`interview ${i.id}: unknown lesson ${i.lessonId}`);
    if (i.type !== 'mcq') {
      const own = scoreAnswer(i, i.modelAnswer);
      if (own.coverage < 80) push(`interview ${i.id}: model answer covers only ${own.coverage}% of its rubric (missed: ${own.missed.join('; ')})`);
      if (scoreAnswer(i, VAGUE_ANSWER).coverage > 40) push(`interview ${i.id}: rubric rewards a vague answer`);
    }
  }
  for (const r of p.interview.roles) {
    for (const s of r.focusSkills) if (!skillIds.has(s)) push(`role ${r.id}: unknown skill ${s}`);
    for (const w of r.weeks)
      for (const t of w.tasks) {
        const [kind, ref] = t.split(':') as [string, string];
        const ok = kind === 'mock' || (kind === 'lesson' && lessonIds.has(ref)) || (kind === 'lab' && labIds.has(ref)) || (kind === 'game' && gameIds.has(ref)) || (kind === 'topic' && skillIds.has(ref));
        if (!ok) push(`role ${r.id}: task ${t} references nothing`);
      }
    if (itemsForRole(p.interview.items, r).length < 10) push(`role ${r.id}: needs at least 10 interview questions for a 30-minute mock`);
  }
  return out;
}
