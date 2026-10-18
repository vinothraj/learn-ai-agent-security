import { addDays, compareWeeks, emptyDay, minutes, parseDayKey, series } from '@laas/shared';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { ChevronLeft, Share2, ShieldCheck } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, View, type HostInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { WeekBars } from '@/components/charts';
import { Button, Row, Screen, T } from '@/components/ui';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

function range(today: string) {
  const fmt = (d: string) => parseDayKey(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(addDays(today, -6))} – ${fmt(today)}`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T v="title">{value}</T>
      <T v="caption" muted style={{ textAlign: 'center' }}>
        {label}
      </T>
    </View>
  );
}

/** A weekly report card built only from local data, shareable as an image. */
export default function ShareReport() {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { stats, today, streak, level } = useProgress();
  const cardRef = useRef<HostInstance>(null);
  const [busy, setBusy] = useState(false);

  const week = series(stats, today, 7);
  const sum = week.reduce(
    (a, d) => ({
      lessons: a.lessons + d.lessonsCompleted,
      cards: a.cards + d.cardsReviewed,
      answered: a.answered + d.questionsAnswered + d.gameRounds,
      correct: a.correct + d.questionsCorrect + d.gameCorrect,
    }),
    { lessons: 0, cards: 0, answered: 0, correct: 0 },
  );
  const cmp = compareWeeks(stats, today);
  const activeDays = week.filter((d) => (stats.get(d.day) ?? emptyDay(d.day)).activeSeconds >= 60).length;

  const share = async () => {
    setBusy(true);
    try {
      if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'Sharing images is supported on the phone app.');
        return;
      }
      // view-shot's types predate RN 0.88 host instances; at runtime it accepts the instance directly.
      const uri = await captureRef(cardRef.current as unknown as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your weekly report' });
    } catch {
      Alert.alert('Could not share', 'Something went wrong creating the image. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Weekly report"
      subtitle="Share your progress. Only what you see here is included."
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
          <ChevronLeft size={28} color={theme.text} />
        </Pressable>
      }>
      <View
        ref={cardRef}
        collapsable={false}
        style={{
          backgroundColor: theme.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.accent + '66',
          padding: space.xl,
          gap: space.lg,
        }}>
        <Row>
          <ShieldCheck size={22} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <T v="heading">Learn AI & Agent Security</T>
            <T v="caption" muted>
              {range(today)}
            </T>
          </View>
        </Row>
        <View>
          <T v="display" color={theme.accent}>
            {minutes(cmp.thisWeekSeconds)} min
          </T>
          <T muted>
            {cmp.changePct === null
              ? `of focused learning across ${activeDays} day${activeDays === 1 ? '' : 's'}`
              : `${cmp.changePct >= 0 ? 'up' : 'down'} ${Math.abs(cmp.changePct)}% on the previous week · ${activeDays} active day${activeDays === 1 ? '' : 's'}`}
          </T>
        </View>
        <WeekBars days={week} goalMinutes={settings.goalMinutes} today={today} height={120} />
        <Row style={{ gap: space.sm }}>
          <Stat value={String(sum.lessons)} label="lessons" />
          <Stat value={String(sum.cards)} label="cards reviewed" />
          <Stat value={sum.answered ? `${Math.round((sum.correct / sum.answered) * 100)}%` : '–'} label="accuracy" />
          {settings.gamification ? <Stat value={`${streak.current}d`} label="streak" /> : null}
        </Row>
        {settings.gamification ? (
          <T v="caption" muted style={{ textAlign: 'center' }}>
            Level {level.level} · {level.title} · {level.xp} XP
          </T>
        ) : null}
      </View>
      <Button label={busy ? 'Preparing…' : 'Share as image'} icon={Share2} onPress={share} disabled={busy} />
    </Screen>
  );
}
