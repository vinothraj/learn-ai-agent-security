import { labById, lessonById } from '@laas/content';
import {
  dayKey,
  evaluateAttack,
  evaluateLab,
  LAB_XP,
  severityOf,
  type LabAttack,
  type LabEvaluation,
  type Severity,
} from '@laas/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  CircleCheck,
  ExternalLink,
  FileDown,
  FlaskConical,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  Star,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArchitectureDiagram } from '@/components/ArchitectureDiagram';
import { ScenarioBox } from '@/components/games';
import { Button, Card, IconBadge, ProgressBar, Row, SectionTitle, T, Tag } from '@/components/ui';
import { awardXp, saveLabAttempt } from '@/db/repo';
import { buildLabReportHtml, exportLabReport } from '@/lib/labReport';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useStudySession } from '@/state/tracker';
import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { Theme } from '@/theme/tokens';
import { openExternal } from '@/lib/links';

type Step = 'brief' | 'baseline' | 'harden' | 'report';
const STEPS: Step[] = ['brief', 'baseline', 'harden', 'report'];
const STEP_LABEL: Record<Step, string> = { brief: 'Brief', baseline: 'Attack', harden: 'Defend', report: 'Report' };
const RUN_MS = 900;

function sevColor(theme: Theme, s: Severity) {
  return s === 'critical' || s === 'high' ? theme.danger : s === 'medium' ? theme.warning : theme.info;
}

function SeverityTag({ attack }: { attack: LabAttack }) {
  const { theme } = useTheme();
  const s = severityOf(attack.likelihood, attack.impact);
  return (
    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
      <Tag label={s.toUpperCase()} color={sevColor(theme, s)} />
      <T v="caption" muted>
        Likelihood {attack.likelihood} × impact {attack.impact}
      </T>
    </Row>
  );
}

function Terminal({ lines }: { lines: string[] }) {
  const { theme, animate } = useTheme();
  return (
    <Animated.View
      entering={animate ? FadeIn.duration(300) : undefined}
      style={{ backgroundColor: '#0A0F1E', borderRadius: radius.sm, padding: space.md, gap: 2 }}>
      {lines.map((l, i) => (
        <T key={i} v="mono" color={l.startsWith('✔') ? '#5CFF9D' : '#C9F5EC'} style={{ fontSize: 11.5, lineHeight: 17 }}>
          {l}
        </T>
      ))}
      {lines.length === 0 ? (
        <T v="mono" color={theme.textMuted} style={{ fontSize: 11.5 }}>
          running…
        </T>
      ) : null}
    </Animated.View>
  );
}

export default function LabScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lab = labById.get(id);
  const db = useSQLiteContext();
  const { theme, animate } = useTheme();
  const haptic = useHaptics();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { refresh, labBests } = useProgress();
  useStudySession('lab', id);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const [step, setStep] = useState<Step>('brief');
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [attemptId, setAttemptId] = useState(() => `${Date.now()}-${id}`);
  const [baseline, setBaseline] = useState<Record<string, 'running' | 'done'>>({});
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [hardened, setHardened] = useState<LabEvaluation | null>(null);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState(0);
  const [result, setResult] = useState<{ evaluation: LabEvaluation; xp: number } | null>(null);

  if (!lab) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: space.xl, paddingTop: insets.top + space.xl, gap: space.lg }}>
        <T v="title">Lab not found</T>
        <Button label="Go back" onPress={() => router.back()} />
      </View>
    );
  }

  const labels = lab.outcomeLabels ?? { fail: 'Vulnerable', pass: 'Blocked' };
  const lesson = lab.lessonId ? lessonById.get(lab.lessonId) : undefined;
  const go = (s: Step) => {
    setStep(s);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const allBaselineDone = lab.attacks.every((a) => baseline[a.id] === 'done');

  const runBaseline = (attackId: string) => {
    haptic('tap');
    setRuns((r) => r + 1);
    setBaseline((b) => ({ ...b, [attackId]: 'running' }));
    setTimeout(
      () => {
        setBaseline((b) => ({ ...b, [attackId]: 'done' }));
        haptic('error');
      },
      animate ? RUN_MS : 0,
    );
  };

  const toggle = (cid: string, on: boolean) => {
    haptic('select');
    setEnabled((e) => {
      const n = new Set(e);
      if (on) n.add(cid);
      else n.delete(cid);
      return n;
    });
    setHardened(null); // configuration changed: results must be re-run
  };

  const runAll = () => {
    setRunning(true);
    setRuns((r) => r + lab.attacks.length);
    setTimeout(
      () => {
        const ev = evaluateLab(lab, enabled);
        setHardened(ev);
        setRunning(false);
        haptic(ev.allBlocked ? 'success' : 'error');
      },
      animate ? RUN_MS : 0,
    );
  };

  const finish = async () => {
    const evaluation = evaluateLab(lab, enabled);
    const day = dayKey(new Date());
    await saveLabAttempt(db, {
      id: attemptId,
      labId: lab.id,
      lessonId: lab.lessonId ?? null,
      day,
      startedAt,
      passed: evaluation.allBlocked,
      stars: evaluation.stars,
      runs,
      controls: [...enabled],
    });
    let xp = 0;
    if (evaluation.allBlocked) xp += await awardXp(db, day, LAB_XP.pass, 'lab_pass', lab.id);
    if (evaluation.stars === 3) xp += await awardXp(db, day, LAB_XP.threeStars, 'lab_3star', lab.id);
    await refresh();
    haptic(evaluation.allBlocked ? 'success' : 'error');
    setResult({ evaluation, xp });
    go('report');
  };

  const exportPdf = async () => {
    if (!result) return;
    try {
      const html = buildLabReportHtml({
        lab,
        evaluation: result.evaluation,
        enabled: [...enabled],
        tester: settings.displayName,
        date: new Date(),
      });
      const ok = await exportLabReport(html, `${lab.system} security test report`);
      if (!ok) Alert.alert('Sharing unavailable', 'This device cannot share files.');
    } catch {
      Alert.alert('Could not create the PDF', 'Please try again.');
    }
  };

  const retry = () => {
    const now = new Date().getTime();
    setStartedAt(now);
    setAttemptId(`${now}-${lab.id}`);
    setBaseline({});
    setEnabled(new Set());
    setHardened(null);
    setRuns(0);
    setResult(null);
    go('brief');
  };

  const best = labBests.get(lab.id);
  const stepIndex = STEPS.indexOf(step);

  const body = (() => {
    switch (step) {
      case 'brief':
        return (
          <View style={{ gap: space.lg }}>
            <Row style={{ flexWrap: 'wrap', gap: 6 }}>
              <Tag label={lab.category.toUpperCase()} />
              <Tag label={lab.level.toUpperCase()} color={theme.info} />
              <Tag label={`${lab.minutes} MIN`} color={theme.ringPractice} />
              {best?.passed ? <Tag label={`BEST ${'★'.repeat(best.stars)}`} color={theme.warning} /> : null}
            </Row>
            <T v="display">{lab.title}</T>
            <T v="label" muted>
              TARGET: {lab.system.toUpperCase()} (FICTIONAL)
            </T>
            <T style={{ fontSize: 16, lineHeight: 25 }}>{lab.scenario}</T>
            <Card>
              <T v="label" color={theme.accent}>
                OBJECTIVE
              </T>
              <T>{lab.objective}</T>
            </Card>
            <SectionTitle>Architecture</SectionTitle>
            <Card>
              <ArchitectureDiagram lab={lab} />
            </Card>
            <SectionTitle>Test plan</SectionTitle>
            <Card>
              {lab.attacks.map((a, i) => (
                <Row key={a.id} style={{ alignItems: 'flex-start' }}>
                  <T v="label" color={theme.accent}>
                    TC-{String(i + 1).padStart(2, '0')}
                  </T>
                  <View style={{ flex: 1 }}>
                    <T v="label">{a.label}</T>
                    <T v="caption" muted>
                      {a.technique}
                    </T>
                  </View>
                </Row>
              ))}
              <T v="caption" muted>
                Expected secure behaviour: {lab.expectedSecure}
              </T>
            </Card>
            <T v="caption" muted>
              Simulation only: no request leaves your phone, and every system here is fictional.
            </T>
          </View>
        );

      case 'baseline':
        return (
          <View style={{ gap: space.lg }}>
            <T v="title">Run each test against the unprotected system</T>
            <T muted>{lab.vulnerability}</T>
            {lab.attacks.map((a, i) => {
              const state = baseline[a.id];
              return (
                <Card key={a.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="label" color={theme.accent}>
                      TC-{String(i + 1).padStart(2, '0')} · {a.technique}
                    </T>
                    {state === 'done' ? <Tag label={labels.fail.toUpperCase()} color={theme.danger} /> : null}
                  </Row>
                  <T v="heading">{a.label}</T>
                  <ScenarioBox text={a.payload} />
                  {state === undefined ? (
                    <Button kind="secondary" icon={Play} label="Run test" onPress={() => runBaseline(a.id)} />
                  ) : state === 'running' ? (
                    <Terminal lines={[]} />
                  ) : (
                    <Animated.View entering={animate ? FadeInDown.duration(300) : undefined} style={{ gap: space.sm }}>
                      <Terminal lines={a.log} />
                      <Row style={{ alignItems: 'flex-start' }}>
                        <ShieldX size={18} color={theme.danger} style={{ marginTop: 2 }} />
                        <T style={{ flex: 1 }}>{a.vulnerable}</T>
                      </Row>
                      <SeverityTag attack={a} />
                      <T v="caption" muted>
                        Impact: {a.impactText}
                      </T>
                    </Animated.View>
                  )}
                </Card>
              );
            })}
          </View>
        );

      case 'harden':
        return (
          <View style={{ gap: space.lg }}>
            <T v="title">Enable defenses, then re-run every test</T>
            <T muted>Pick controls you would actually deploy. Some popular ideas don’t work. Re-run to find out.</T>
            <Card>
              {lab.controls.map((c) => (
                <Row key={c.id} style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="label">{c.label}</T>
                    <T v="caption" muted>
                      {c.description}
                    </T>
                  </View>
                  <Switch
                    accessibilityLabel={c.label}
                    value={enabled.has(c.id)}
                    onValueChange={(v) => toggle(c.id, v)}
                    trackColor={{ true: theme.accent, false: theme.surfaceAlt }}
                    thumbColor={theme.mode === 'light' ? '#FFFFFF' : theme.text}
                  />
                </Row>
              ))}
            </Card>
            <Button icon={RotateCcw} label={running ? 'Running tests…' : 'Re-run all tests'} onPress={runAll} disabled={running} />
            {hardened ? (
              <Animated.View entering={animate ? FadeInDown.duration(300) : undefined} style={{ gap: space.md }}>
                <Card accent={hardened.allBlocked}>
                  <Row>
                    {hardened.allBlocked ? <ShieldCheck size={22} color={theme.success} /> : <ShieldX size={22} color={theme.danger} />}
                    <T v="heading" style={{ flex: 1 }}>
                      {hardened.blockedCount}/{hardened.results.length} tests {labels.pass.toLowerCase()}
                    </T>
                  </Row>
                  <ProgressBar value={hardened.blockedCount / hardened.results.length} color={hardened.allBlocked ? theme.success : theme.warning} />
                </Card>
                {lab.attacks.map((a) => {
                  const r = evaluateAttack(lab, a, enabled);
                  return (
                    <Card key={a.id}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T v="label" style={{ flex: 1 }}>
                          {a.label}
                        </T>
                        <Tag label={(r.blocked ? labels.pass : labels.fail).toUpperCase()} color={r.blocked ? theme.success : theme.danger} />
                      </Row>
                      <T>{r.blocked ? a.blocked : a.vulnerable}</T>
                      {r.blocked ? <Terminal lines={[`✔ ${r.blockedBy.join(' + ')}: test ${labels.pass.toLowerCase()}`]} /> : null}
                    </Card>
                  );
                })}
                {hardened.decoysEnabled.map((c) => (
                  <Card key={c.id}>
                    <Row style={{ alignItems: 'flex-start' }}>
                      <TriangleAlert size={18} color={theme.warning} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <T v="label" color={theme.warning}>
                          “{c.label}” didn’t help
                        </T>
                        <T>{c.decoyReason}</T>
                      </View>
                    </Row>
                  </Card>
                ))}
              </Animated.View>
            ) : null}
          </View>
        );

      case 'report': {
        if (!result) return null;
        const ev = result.evaluation;
        return (
          <View style={{ gap: space.lg }}>
            <Animated.View entering={animate ? ZoomIn.springify().damping(12) : undefined} style={{ alignItems: 'center', gap: space.sm }}>
              <IconBadge icon={ev.allBlocked ? ShieldCheck : ShieldX} size={84} color={ev.allBlocked ? theme.success : theme.danger} />
              <T v="display">{ev.allBlocked ? 'Lab passed' : 'Not yet secure'}</T>
              <Row style={{ gap: 4 }}>
                {[1, 2, 3].map((s) => (
                  <Star key={s} size={26} color={theme.warning} fill={s <= ev.stars ? theme.warning : 'transparent'} />
                ))}
              </Row>
              {settings.gamification && result.xp > 0 ? (
                <T v="title" color={theme.warning}>
                  +{result.xp} XP
                </T>
              ) : null}
            </Animated.View>
            <Card>
              <T v="label" muted>
                FINDINGS
              </T>
              {lab.attacks.map((a) => {
                const r = ev.results.find((x) => x.attackId === a.id)!;
                const s = severityOf(a.likelihood, a.impact);
                return (
                  <Row key={a.id} style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
                    {r.blocked ? <CircleCheck size={18} color={theme.success} /> : <ShieldX size={18} color={theme.danger} />}
                    <View style={{ flex: 1 }}>
                      <T v="label">{a.label}</T>
                      <T v="caption" muted>
                        {s.toUpperCase()} · {r.blocked ? `${labels.pass} by ${r.blockedBy.join(' + ')}` : `still ${labels.fail.toLowerCase()}`}
                      </T>
                    </View>
                  </Row>
                );
              })}
            </Card>
            {ev.missingRecommended.length > 0 || ev.decoysEnabled.length > 0 ? (
              <Card>
                <T v="label" color={theme.warning}>
                  TO EARN 3 STARS
                </T>
                {ev.decoysEnabled.map((c) => (
                  <T key={c.id}>• Drop “{c.label}”: {c.decoyReason}</T>
                ))}
                {ev.missingRecommended.length > 0 ? (
                  <T>• Add for defense in depth: {ev.missingRecommended.map((c) => c.label).join('; ')}.</T>
                ) : null}
              </Card>
            ) : null}
            <Card>
              <T v="label" muted>
                REMEDIATION
              </T>
              {lab.remediation.map((r, i) => (
                <T key={i}>
                  {i + 1}. {r}
                </T>
              ))}
            </Card>
            <Button kind="secondary" icon={FileDown} label="Export PDF report" onPress={exportPdf} />
            {lesson ? (
              <Card onPress={() => router.push(`/lesson/${lesson.id}`)} accessibilityLabel={`Review lesson ${lesson.title}`}>
                <T v="caption" muted>
                  RELATED LESSON
                </T>
                <T v="heading">{lesson.title}</T>
              </Card>
            ) : null}
            <T v="label" muted>
              REFERENCES
            </T>
            {lab.references.map((r) => (
              <Pressable
                key={r.url}
                accessibilityRole="link"
                onPress={() => openExternal(r.url)}
                style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.md, borderRadius: radius.md, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                <ExternalLink size={18} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <T v="label">{r.title}</T>
                  <T v="caption" muted>
                    {r.publisher}
                  </T>
                </View>
              </Pressable>
            ))}
          </View>
        );
      }
    }
  })();

  const footer = (() => {
    switch (step) {
      case 'brief':
        return <Button icon={FlaskConical} label="Start testing" onPress={() => go('baseline')} style={{ flex: 1 }} />;
      case 'baseline':
        return (
          <Button
            label={allBaselineDone ? 'Harden the system' : `Run all ${lab.attacks.length} tests first`}
            disabled={!allBaselineDone}
            onPress={() => go('harden')}
            style={{ flex: 1 }}
          />
        );
      case 'harden':
        return (
          <Button
            label={hardened?.allBlocked ? 'Finish & view report' : 'Finish anyway'}
            kind={hardened?.allBlocked ? 'primary' : 'secondary'}
            disabled={!hardened || running}
            onPress={finish}
            style={{ flex: 1 }}
          />
        );
      case 'report':
        return (
          <>
            <Button kind="secondary" label="Retry" icon={RotateCcw} onPress={retry} style={{ flex: 1 }} />
            <Button label="Done" onPress={() => router.back()} style={{ flex: 1 }} />
          </>
        );
    }
  })();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + space.sm }}>
      <Row style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close lab" hitSlop={12} onPress={() => router.back()}>
          <X size={26} color={theme.text} />
        </Pressable>
        <Row style={{ flex: 1, gap: 6 }}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, gap: 3 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: i <= stepIndex ? theme.accent : theme.surfaceAlt }} />
              <T v="caption" color={i === stepIndex ? theme.accent : theme.textMuted} style={{ fontSize: 10, textAlign: 'center' }}>
                {STEP_LABEL[s]}
              </T>
            </View>
          ))}
        </Row>
      </Row>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Animated.View key={step} entering={animate ? FadeIn.duration(250) : undefined}>
          {body}
        </Animated.View>
      </ScrollView>
      <Row style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg, borderTopWidth: 1, borderTopColor: theme.border }}>{footer}</Row>
    </View>
  );
}

