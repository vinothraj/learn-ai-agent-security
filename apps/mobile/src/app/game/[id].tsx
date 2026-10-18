import { gameById } from '@laas/content';
import { dayKey, GAME_XP, seededShuffle, shuffle, type GameRound } from '@laas/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { CalendarCheck, Trophy, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInRight, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceRoundView, MatchRoundView, SpotRoundView } from '@/components/games';
import { Button, IconBadge, ProgressBar, Row, T, Tag } from '@/components/ui';
import { awardXp, completeDailyChallenge, recordGameRound } from '@/db/repo';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useStudySession } from '@/state/tracker';
import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const ROUNDS_PER_SESSION = 5;

export default function GameScreen() {
  const { id, daily } = useLocalSearchParams<{ id: string; daily?: string }>();
  const isDaily = daily === '1';
  const game = gameById.get(id);
  const db = useSQLiteContext();
  const { theme, animate } = useTheme();
  const haptic = useHaptics();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { refresh, today, dailyToday } = useProgress();
  useStudySession('game', id);

  const [sessionId] = useState(() => `${Date.now()}-${id}`);
  const [rounds] = useState<GameRound[]>(() => {
    if (!game) return [];
    const all = game.rounds as GameRound[];
    // Daily challenge: same rounds in the same order for everyone today.
    return (isDaily ? seededShuffle(all, `daily:${today}`) : shuffle(all)).slice(0, ROUNDS_PER_SESSION);
  });
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<(boolean | null)[]>(() => rounds.map(() => null));
  const [summary, setSummary] = useState<{ xp: number; firstDaily: boolean } | null>(null);

  if (!game || rounds.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: space.xl, paddingTop: insets.top + space.xl, gap: space.lg }}>
        <T v="title">Game not found</T>
        <Button label="Go back" onPress={() => router.back()} />
      </View>
    );
  }

  const round = rounds[index]!;
  const result = results[index] ?? null;
  const correct = results.filter((r) => r === true).length;

  const onResult = (ok: boolean) => {
    setResults((rs) => rs.map((v, i) => (i === index ? ok : v)));
    recordGameRound(db, {
      sessionId,
      gameId: game.id,
      roundId: round.id,
      lessonId: round.lessonId ?? null,
      correct: ok,
      daily: isDaily,
      day: dayKey(new Date()),
    }).then(refresh);
  };

  const finish = async () => {
    const day = dayKey(new Date());
    const base = correct * GAME_XP.perCorrect + (correct === rounds.length ? GAME_XP.perfectBonus : 0);
    let xp = await awardXp(db, day, base, 'game', sessionId);
    let firstDaily = false;
    if (isDaily) {
      firstDaily = await completeDailyChallenge(db, { day, gameId: game.id, correct, total: rounds.length });
      if (firstDaily) xp += await awardXp(db, day, GAME_XP.dailyBonus, 'daily_challenge', day);
    }
    await refresh();
    haptic('success');
    setSummary({ xp, firstDaily });
  };

  const body = (() => {
    switch (game.kind) {
      case 'choice':
        return <ChoiceRoundView key={round.id} round={round as never} result={result} onResult={onResult} />;
      case 'spot':
        return <SpotRoundView key={round.id} round={round as never} result={result} onResult={onResult} />;
      case 'match':
        return <MatchRoundView key={round.id} round={round as never} result={result} onResult={onResult} />;
    }
  })();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + space.sm }}>
      <Row style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close game" hitSlop={12} onPress={() => router.back()}>
          <X size={26} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar value={summary ? 1 : (index + (result === null ? 0 : 1)) / rounds.length} color={theme.ringPractice} />
        </View>
        <T v="caption" muted>
          {Math.min(index + 1, rounds.length)}/{rounds.length}
        </T>
      </Row>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        {summary ? (
          <View style={{ alignItems: 'center', gap: space.lg, paddingTop: space.xxl }}>
            <Animated.View entering={animate ? ZoomIn.springify().damping(12) : undefined}>
              <IconBadge icon={isDaily ? CalendarCheck : Trophy} size={88} color={theme.warning} />
            </Animated.View>
            <T v="display">
              {correct}/{rounds.length}
            </T>
            <T v="title">{game.title}</T>
            {settings.gamification ? (
              <T v="heading" color={theme.warning}>
                +{summary.xp} XP{summary.firstDaily ? ' (incl. daily bonus)' : ''}
              </T>
            ) : null}
            {isDaily && !summary.firstDaily && dailyToday ? (
              <T v="caption" muted style={{ textAlign: 'center' }}>
                Today’s first result ({dailyToday.correct}/{dailyToday.total}) is the one that counts. Replays are for practice.
              </T>
            ) : null}
            <T muted style={{ textAlign: 'center' }}>
              {correct === rounds.length ? 'Perfect run.' : 'Every explanation you read is one fewer mistake in a real review.'}
            </T>
          </View>
        ) : (
          <Animated.View key={index} entering={animate ? FadeInRight.duration(260) : undefined} style={{ gap: space.md }}>
            <Row style={{ gap: 6 }}>
              <Tag label={game.title.toUpperCase()} color={theme.ringPractice} />
              {isDaily ? <Tag label="DAILY CHALLENGE" color={theme.warning} /> : null}
            </Row>
            {body}
          </Animated.View>
        )}
      </ScrollView>

      <Row style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg, borderTopWidth: 1, borderTopColor: theme.border }}>
        {summary ? (
          <Button label="Done" onPress={() => router.back()} style={{ flex: 1 }} />
        ) : (
          <Button
            label={index === rounds.length - 1 ? 'See results' : 'Next round'}
            disabled={result === null}
            onPress={index === rounds.length - 1 ? finish : () => setIndex(index + 1)}
            style={{ flex: 1 }}
          />
        )}
      </Row>
    </View>
  );
}
