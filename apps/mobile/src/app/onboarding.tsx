import { contentPack } from '@laas/content';
import { router } from 'expo-router';
import { Bell, Bot, ShieldCheck, Target } from '@/components/icons';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, IconBadge, ProgressBar, Row, T } from '@/components/ui';
import { ensurePermission, formatTime } from '@/lib/notifications';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius, space } from '@/theme/tokens';

const GOALS = [5, 10, 15, 20];
const TIMES: [number, number][] = [
  [7, 30],
  [12, 30],
  [18, 0],
  [20, 0],
  [21, 30],
];

export default function Onboarding() {
  const { theme, animate } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.displayName);
  const [goal, setGoal] = useState(settings.goalMinutes);
  const [focus, setFocus] = useState(settings.focusRoadmapId);
  const [time, setTime] = useState<[number, number] | null>([settings.reminderHour, settings.reminderMinute]);

  const finish = async () => {
    // One permission covers the reminder, the evening recap and the Sunday report (all local).
    const reminderEnabled = time ? await ensurePermission() : false;
    await update({
      onboarded: true,
      displayName: name.trim().slice(0, 40),
      goalMinutes: goal,
      focusRoadmapId: focus,
      reminderEnabled,
      recapEnabled: reminderEnabled,
      weeklyReportEnabled: reminderEnabled,
      reminderHour: time?.[0] ?? settings.reminderHour,
      reminderMinute: time?.[1] ?? settings.reminderMinute,
    });
    router.replace('/');
  };

  const steps = [
    <View key="welcome" style={{ gap: space.lg }}>
      <IconBadge icon={ShieldCheck} size={64} />
      <T v="display">Learn AI & Agent Security</T>
      <T muted>
        Five-to-ten-minute daily lessons on prompt injection, RAG data leaks, agent permissions, MCP security and more,
        with quizzes and interview practice. Everything works offline.
      </T>
      <T v="label" muted>
        What should we call you? (optional, stays on this device)
      </T>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your first name"
        placeholderTextColor={theme.textMuted}
        maxLength={40}
        autoComplete="off"
        style={[
          font.body,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            minHeight: 52,
          },
        ]}
      />
    </View>,
    <View key="goal" style={{ gap: space.lg }}>
      <IconBadge icon={Target} size={56} />
      <T v="title">Pick a daily goal</T>
      <T muted>Small and steady beats long and rare. You can change this any time.</T>
      <Row style={{ flexWrap: 'wrap' }}>
        {GOALS.map((g) => (
          <Chip key={g} label={`${g} min`} selected={goal === g} onPress={() => setGoal(g)} />
        ))}
      </Row>
      <T v="caption" muted>
        {goal <= 5 ? 'Casual: about one lesson a day.' : goal <= 10 ? 'Regular: a lesson plus a quiz.' : 'Serious: steady progress toward interviews.'}
      </T>
    </View>,
    <View key="focus" style={{ gap: space.md }}>
      <IconBadge icon={Bot} size={56} />
      <T v="title">Where do you want to start?</T>
      {contentPack.roadmaps
        .filter((r) => r.lessonIds.length > 0)
        .map((r) => (
          <Card key={r.id} accent={focus === r.id} onPress={() => setFocus(r.id)} accessibilityLabel={r.title}>
            <T v="heading">
              {r.code}. {r.title}
            </T>
            <T muted v="caption">
              {r.tagline}
            </T>
          </Card>
        ))}
    </View>,
    <View key="reminder" style={{ gap: space.lg }}>
      <IconBadge icon={Bell} size={56} />
      <T v="title">A gentle daily reminder?</T>
      <T muted>One notification a day at most, on this device only. No account needed.</T>
      <Row style={{ flexWrap: 'wrap' }}>
        {TIMES.map(([h, m]) => (
          <Chip
            key={`${h}:${m}`}
            label={formatTime(h, m)}
            selected={time?.[0] === h && time?.[1] === m}
            onPress={() => setTime([h, m])}
          />
        ))}
        <Chip label="No reminders" selected={time === null} onPress={() => setTime(null)} />
      </Row>
    </View>,
  ];

  const last = step === steps.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }}>
      <View style={{ paddingHorizontal: space.lg }}>
        <ProgressBar value={(step + 1) / steps.length} height={6} />
      </View>
      <Animated.ScrollView
        key={step}
        entering={animate ? FadeInRight.duration(300) : FadeIn.duration(0)}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl }}>
        {steps[step]}
      </Animated.ScrollView>
      <Row style={{ paddingHorizontal: space.lg }}>
        {step > 0 ? <Button kind="secondary" label="Back" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        <Button
          label={last ? 'Start learning' : 'Continue'}
          onPress={last ? finish : () => setStep(step + 1)}
          style={{ flex: 2 }}
        />
      </Row>
    </View>
  );
}
