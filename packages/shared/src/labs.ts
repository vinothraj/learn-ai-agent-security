import { z } from 'zod';
import { Level, Reference, ReviewStatus } from './schema';

/**
 * Security labs are data-driven simulations of FICTIONAL systems. The engine never sends
 * traffic anywhere: an attack's outcome is computed from which defensive controls are enabled.
 */
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ids must be kebab-case');

export const RiskLevel = z.enum(['low', 'medium', 'high']);
export type RiskLevel = z.infer<typeof RiskLevel>;
export type Severity = 'note' | 'low' | 'medium' | 'high' | 'critical';

export const LabNode = z.object({
  id,
  label: z.string().min(2).max(22),
  kind: z.enum(['user', 'attacker', 'app', 'model', 'tool', 'data', 'external']),
  /** Grid position: x 0..3, y 0..2. */
  x: z.number().int().min(0).max(3),
  y: z.number().int().min(0).max(2),
  zone: id,
  info: z.string().min(10),
});

export const LabControl = z.object({
  id,
  label: z.string().min(3),
  description: z.string().min(10),
  /** Present only on decoys: why this popular idea does not stop the attacks. */
  decoyReason: z.string().optional(),
});
export type LabControl = z.infer<typeof LabControl>;

export const LabAttack = z.object({
  id,
  label: z.string().min(3),
  technique: z.string().min(3),
  /** The fictional input the tester sends or plants. */
  payload: z.string().min(5),
  /** Blocked if ANY group has ALL of its controls enabled (OR of ANDs). */
  blockedBy: z.array(z.array(id).min(1)).min(1),
  vulnerable: z.string().min(10),
  blocked: z.string().min(10),
  log: z.array(z.string()).min(1),
  likelihood: RiskLevel,
  impact: RiskLevel,
  impactText: z.string().min(10),
});
export type LabAttack = z.infer<typeof LabAttack>;

export const Lab = z.object({
  id,
  title: z.string().min(4),
  system: z.string().min(3),
  summary: z.string().min(10),
  category: z.string().min(3),
  level: Level,
  minutes: z.number().int().min(3).max(20),
  lessonId: id.optional(),
  objective: z.string().min(10),
  scenario: z.string().min(20),
  zones: z.array(z.object({ id, label: z.string(), trust: z.enum(['trusted', 'untrusted', 'external']) })).min(1),
  nodes: z.array(LabNode).min(3),
  edges: z.array(z.object({ from: id, to: id, label: z.string().optional(), untrusted: z.boolean().optional() })).min(2),
  vulnerability: z.string().min(20),
  expectedSecure: z.string().min(10),
  controls: z.array(LabControl).min(3),
  /** The defense-in-depth set a strong answer enables (needed for 3 stars). */
  recommended: z.array(id).min(1),
  attacks: z.array(LabAttack).min(2).max(5),
  /** Wording for outcomes, e.g. detection labs use "Undetected"/"Detected". */
  outcomeLabels: z.object({ fail: z.string(), pass: z.string() }).optional(),
  remediation: z.array(z.string().min(10)).min(2),
  references: z.array(Reference).min(1),
  status: ReviewStatus,
  version: z.number().int().min(1),
});
export type Lab = z.infer<typeof Lab>;

/** OWASP Risk Rating style matrix: likelihood x impact. */
export function severityOf(likelihood: RiskLevel, impact: RiskLevel): Severity {
  const m: Record<RiskLevel, Record<RiskLevel, Severity>> = {
    low: { low: 'note', medium: 'low', high: 'medium' },
    medium: { low: 'low', medium: 'medium', high: 'high' },
    high: { low: 'medium', medium: 'high', high: 'critical' },
  };
  return m[likelihood][impact];
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'note'];

export interface AttackResult {
  attackId: string;
  blocked: boolean;
  /** Labels of the control group that stopped it, if any. */
  blockedBy: string[];
  severity: Severity;
}

export function evaluateAttack(lab: Lab, attack: LabAttack, enabled: ReadonlySet<string>): AttackResult {
  const group = attack.blockedBy.find((g) => g.every((c) => enabled.has(c)));
  const label = (cid: string) => lab.controls.find((c) => c.id === cid)?.label ?? cid;
  return {
    attackId: attack.id,
    blocked: !!group,
    blockedBy: group ? group.map(label) : [],
    severity: severityOf(attack.likelihood, attack.impact),
  };
}

export interface LabEvaluation {
  results: AttackResult[];
  allBlocked: boolean;
  blockedCount: number;
  /** Enabled controls that are decoys. */
  decoysEnabled: LabControl[];
  /** Recommended controls the learner left off. */
  missingRecommended: LabControl[];
  /** 0 = nothing blocked, 1 = partial, 2 = all blocked, 3 = all blocked with the full recommended set and no decoys. */
  stars: 0 | 1 | 2 | 3;
}

export function evaluateLab(lab: Lab, enabled: ReadonlySet<string>): LabEvaluation {
  const results = lab.attacks.map((a) => evaluateAttack(lab, a, enabled));
  const blockedCount = results.filter((r) => r.blocked).length;
  const allBlocked = blockedCount === results.length;
  const decoysEnabled = lab.controls.filter((c) => c.decoyReason && enabled.has(c.id));
  const missingRecommended = lab.controls.filter((c) => lab.recommended.includes(c.id) && !enabled.has(c.id));
  const stars: LabEvaluation['stars'] = allBlocked
    ? decoysEnabled.length === 0 && missingRecommended.length === 0
      ? 3
      : 2
    : blockedCount > 0
      ? 1
      : 0;
  return { results, allBlocked, blockedCount, decoysEnabled, missingRecommended, stars };
}

/** Integrity checks used by content validation (beyond the zod schema). */
export function labIssues(lab: Lab): string[] {
  const issues: string[] = [];
  const controlIds = new Set(lab.controls.map((c) => c.id));
  const nodeIds = new Set(lab.nodes.map((n) => n.id));
  const zoneIds = new Set(lab.zones.map((z) => z.id));
  for (const n of lab.nodes) if (!zoneIds.has(n.zone)) issues.push(`node ${n.id}: unknown zone ${n.zone}`);
  const cells = lab.nodes.map((n) => `${n.x},${n.y}`);
  if (new Set(cells).size !== cells.length) issues.push('two nodes share a grid cell');
  for (const e of lab.edges) if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) issues.push(`edge ${e.from}->${e.to}: unknown node`);
  for (const a of lab.attacks)
    for (const g of a.blockedBy)
      for (const c of g) {
        if (!controlIds.has(c)) issues.push(`attack ${a.id}: unknown control ${c}`);
        if (lab.controls.find((x) => x.id === c)?.decoyReason) issues.push(`attack ${a.id}: decoy ${c} cannot block`);
      }
  for (const r of lab.recommended) {
    if (!controlIds.has(r)) issues.push(`recommended: unknown control ${r}`);
    if (lab.controls.find((x) => x.id === r)?.decoyReason) issues.push(`recommended: ${r} is a decoy`);
  }
  if (!lab.controls.some((c) => c.decoyReason)) issues.push('needs at least one decoy control');
  if (!evaluateLab(lab, new Set(lab.recommended)).allBlocked) issues.push('recommended controls do not block every attack');
  if (evaluateLab(lab, new Set()).blockedCount !== 0) issues.push('an attack is blocked with no controls');
  const decoyOnly = new Set(lab.controls.filter((c) => c.decoyReason).map((c) => c.id));
  if (evaluateLab(lab, decoyOnly).blockedCount !== 0) issues.push('decoys alone block an attack');
  return issues;
}
