import type { ChoiceRound, MatchRound, SpotRound } from '@laas/shared';
import { seededShuffle } from '@laas/shared';
import { CircleCheck, CircleX, Database, Link2, Lock, Scale, ScanSearch, Tag as TagIcon, Wrench, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { font, radius, space } from '@/theme/tokens';
import { QuizQuestionView } from './QuizQuestionView';
import { Button, Row, T } from './ui';

export const GAME_ICONS: Record<string, LucideIcon> = {
  spot: ScanSearch,
  lock: Lock,
  database: Database,
  tag: TagIcon,
  wrench: Wrench,
  scale: Scale,
  link: Link2,
};

interface RoundProps<R> {
  round: R;
  result: boolean | null;
  onResult: (correct: boolean) => void;
}

function Explanation({ correct, text }: { correct: boolean; text: string }) {
  const { theme, animate } = useTheme();
  return (
    <Animated.View
      entering={animate ? FadeIn.duration(250) : undefined}
      style={{ padding: space.lg, borderRadius: radius.md, backgroundColor: (correct ? theme.success : theme.warning) + '18', gap: 4 }}>
      <T v="heading" color={correct ? theme.success : theme.warning}>
        {correct ? 'Correct' : 'Not quite'}
      </T>
      <T>{text}</T>
    </Animated.View>
  );
}

/** A fictional document, request or architecture shown like a terminal pane. */
export function ScenarioBox({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.mode === 'light' ? '#0E1430' : theme.surfaceAlt,
        borderRadius: radius.md,
        padding: space.md,
        borderLeftWidth: 3,
        borderLeftColor: theme.accent,
      }}>
      <T v="mono" color={theme.mode === 'light' ? '#C9F5EC' : theme.text}>
        {text}
      </T>
    </View>
  );
}

export function ChoiceRoundView({ round, result, onResult }: RoundProps<ChoiceRound>) {
  const [answer, setAnswer] = useState<number | null>(null);
  return (
    <View style={{ gap: space.md }}>
      {round.scenario ? <ScenarioBox text={round.scenario} /> : null}
      <QuizQuestionView
        question={round}
        // Options written as "A: …" / "B: …" refer to labelled designs, so keep their order.
        shuffleOptions={!round.options.every((o) => /^[A-Z]: /.test(o))}
        answer={answer}
        onAnswer={(i) => {
          if (result !== null) return;
          setAnswer(i);
          onResult(i === round.correctIndex);
        }}
      />
    </View>
  );
}

export function SpotRoundView({ round, result, onResult }: RoundProps<SpotRound>) {
  const { theme } = useTheme();
  const haptic = useHaptics();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const checked = result !== null;

  const toggle = (i: number) => {
    if (checked) return;
    haptic('select');
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  const check = () => {
    const ok = round.segments.every((s, i) => s.malicious === picked.has(i));
    haptic(ok ? 'success' : 'error');
    onResult(ok);
  };

  return (
    <View style={{ gap: space.md }}>
      <T v="title">{round.prompt}</T>
      <T v="caption" muted>
        Tap lines to flag them, then check.
      </T>
      {round.segments.map((s, i) => {
        const sel = picked.has(i);
        let border = sel ? theme.accent : theme.border;
        let note: string | null = null;
        if (checked) {
          if (s.malicious) {
            border = sel ? theme.success : theme.danger;
            note = sel ? 'Injection (caught)' : 'Injection (missed)';
          } else if (sel) {
            border = theme.warning;
            note = 'Benign (false alarm)';
          }
        }
        return (
          <Pressable
            key={i}
            onPress={() => toggle(i)}
            disabled={checked}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: sel, disabled: checked }}
            accessibilityLabel={`${s.text.replace(/[.!?]$/, '')}${note ? `. ${note}` : ''}`}
            style={{
              padding: space.md,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: border,
              backgroundColor: sel ? theme.accentSoft : theme.surface,
              gap: 4,
            }}>
            <T v="mono">{s.text}</T>
            {note ? (
              <T v="caption" color={border}>
                {note}
              </T>
            ) : null}
          </Pressable>
        );
      })}
      {checked ? <Explanation correct={result} text={round.explanation} /> : <Button label="Check" onPress={check} disabled={picked.size === 0} />}
    </View>
  );
}

const PAIR_COLORS = ['#2DD4BF', '#A78BFA', '#FBBF24', '#60A5FA'];

/** Stable shuffle of the fixes column that never lines up with the findings column. */
function fixesOrder(round: MatchRound): string[] {
  const original = round.pairs.map((p) => p.right);
  const mixed = seededShuffle(original, round.id);
  const aligned = mixed.some((r, i) => r === original[i]);
  return aligned ? [...original.slice(1), original[0]!] : mixed;
}

export function MatchRoundView({ round, result, onResult }: RoundProps<MatchRound>) {
  const { theme } = useTheme();
  const haptic = useHaptics();
  const rights = fixesOrder(round);
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const [assign, setAssign] = useState<Record<number, string>>({});
  const checked = result !== null;
  const allPaired = Object.keys(assign).length === round.pairs.length;

  const tapLeft = (i: number) => {
    if (checked) return;
    haptic('select');
    if (assign[i] !== undefined) {
      const { [i]: _removed, ...rest } = assign;
      setAssign(rest);
    }
    setActiveLeft(i);
  };

  const tapRight = (r: string) => {
    if (checked || activeLeft === null) return;
    haptic('tap');
    const cleared = Object.fromEntries(Object.entries(assign).filter(([, v]) => v !== r));
    setAssign({ ...cleared, [activeLeft]: r });
    const nextFree = round.pairs.findIndex((_, i) => i !== activeLeft && cleared[i] === undefined);
    setActiveLeft(nextFree === -1 ? null : nextFree);
  };

  const check = () => {
    const ok = round.pairs.every((p, i) => assign[i] === p.right);
    haptic(ok ? 'success' : 'error');
    onResult(ok);
  };

  const colorFor = (i: number) => PAIR_COLORS[i % PAIR_COLORS.length]!;
  const leftForRight = (r: string) => Object.entries(assign).find(([, v]) => v === r)?.[0];

  return (
    <View style={{ gap: space.md }}>
      <T v="title">{round.prompt}</T>
      <T v="caption" muted>
        Tap a finding, then its fix. Tap a finding again to re-pair it.
      </T>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1, gap: space.sm }}>
          {round.pairs.map((p, i) => {
            const paired = assign[i] !== undefined;
            const ok = checked ? assign[i] === p.right : null;
            const c = checked ? (ok ? theme.success : theme.danger) : paired ? colorFor(i) : activeLeft === i ? theme.accent : theme.border;
            return (
              <Pressable
                key={p.left}
                onPress={() => tapLeft(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: activeLeft === i }}
                accessibilityLabel={`Finding: ${p.left}${paired ? `, paired with ${assign[i]}` : ''}`}
                style={{
                  minHeight: 64,
                  padding: space.sm,
                  borderRadius: radius.sm,
                  borderWidth: activeLeft === i && !checked ? 2.5 : 1.5,
                  borderColor: c,
                  backgroundColor: paired || checked ? c + '1F' : theme.surface,
                  justifyContent: 'center',
                }}>
                <Row style={{ gap: 6 }}>
                  {checked ? ok ? <CircleCheck size={14} color={theme.success} /> : <CircleX size={14} color={theme.danger} /> : null}
                  <T v="label" style={{ flex: 1 }}>
                    {p.left}
                  </T>
                </Row>
                {checked && !ok ? (
                  <T v="caption" color={theme.success}>
                    → {p.right}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={{ flex: 1, gap: space.sm }}>
          {rights.map((r) => {
            const li = leftForRight(r);
            const c = li !== undefined ? colorFor(Number(li)) : theme.border;
            return (
              <Pressable
                key={r}
                onPress={() => tapRight(r)}
                disabled={checked}
                accessibilityRole="button"
                accessibilityLabel={`Fix: ${r}`}
                style={{
                  minHeight: 64,
                  padding: space.sm,
                  borderRadius: radius.sm,
                  borderWidth: 1.5,
                  borderColor: c,
                  backgroundColor: li !== undefined ? c + '1F' : theme.surfaceAlt,
                  justifyContent: 'center',
                }}>
                <T v="label" style={{ fontWeight: font.label.fontWeight }}>
                  {r}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>
      {checked ? <Explanation correct={result} text={round.explanation} /> : <Button label="Check" onPress={check} disabled={!allPaired} />}
    </View>
  );
}
