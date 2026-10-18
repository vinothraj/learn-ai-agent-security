import { contentPack } from '@laas/content';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ChevronLeft } from '@/components/icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

import { Button, Card, Chip, Row, Screen, SectionTitle, T } from '@/components/ui';
import { resetAllProgress } from '@/db/repo';
import { isOptedIn, setOptIn } from '@/sync/analytics';
import { ensurePermission, formatTime, notificationsSupported, pushAvailability } from '@/lib/notifications';
import { useProgress } from '@/state/progress';
import { useSync } from '@/state/sync';
import { useSettings, type Settings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { ACCENTS, type AccentKey, type ThemeMode } from '@/theme/tokens';

const MODES: { key: ThemeMode; label: string }[] = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'amoled', label: 'AMOLED' },
  { key: 'contrast', label: 'High contrast' },
  { key: 'system', label: 'System' },
];
const GOALS = [5, 10, 15, 20, 30];
const TIMES: [number, number][] = [
  [7, 30],
  [9, 0],
  [12, 30],
  [18, 0],
  [20, 0],
  [21, 30],
];
const RECAP_TIMES: [number, number][] = [
  [19, 0],
  [20, 30],
  [21, 0],
  [21, 30],
];
const QUIET: { label: string; start: number; end: number }[] = [
  { label: '10 PM – 7 AM', start: 22, end: 7 },
  { label: '11 PM – 8 AM', start: 23, end: 8 },
  { label: '9 PM – 6 AM', start: 21, end: 6 },
  { label: 'Off', start: 0, end: 0 },
];
const PERMISSION_OFF = ['Notifications are off', 'Allow notifications for this app in Android settings to get reminders.'] as const;

function Toggle({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
      <View style={{ flex: 1 }}>
        <T v="heading">{label}</T>
        <T v="caption" muted>
          {detail}
        </T>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.accent, false: theme.surfaceAlt }}
        thumbColor={theme.mode === 'light' ? '#FFFFFF' : theme.text}
      />
    </Row>
  );
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { theme } = useTheme();
  const { settings, update } = useSettings();
  const { refresh } = useProgress();
  const sync = useSync();
  const set = (patch: Partial<Settings>) => update(patch);

  const push = pushAvailability();
  const [shareStats, setShareStats] = useState(false);
  useEffect(() => {
    isOptedIn(db).then(setShareStats);
  }, [db]);
  const toggleStats = async (on: boolean) => {
    setShareStats(on);
    try {
      await setOptIn(db, on, sync.session ? sync.call : null);
    } catch {
      if (!on) Alert.alert('Saved on this device', 'Sharing is off. We could not reach the server to delete shared statistics; try again when online.');
    }
  };
  /** Turning a notification on asks for permission first; the scheduler re-plans from settings. */
  const enable = async (patch: Partial<Settings>) => {
    const turningOn = Object.entries(patch).some(([k, v]) => k.endsWith('Enabled') || k.endsWith('Push') ? v === true : false);
    if (turningOn && !(await ensurePermission())) {
      if (notificationsSupported) Alert.alert(...PERMISSION_OFF);
      return;
    }
    await set(patch);
  };
  const setPush = async (patch: Partial<Settings>) => {
    if (!sync.session) {
      Alert.alert('Sign in needed', 'Advisory and new-content alerts are sent by the server, so they need an account. Reminders and recaps work without one.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/account') },
      ]);
      return;
    }
    await enable(patch);
  };

  const confirmReset = () =>
    sync.session
      ? Alert.alert('Signed in', 'Your progress is backed up to your account, so a local reset would sync back. To start over, delete your account from Account settings.')
      :
    Alert.alert('Reset all progress?', 'This deletes lessons, quiz history, study time and XP stored on this device. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await resetAllProgress(db);
          await refresh();
        },
      },
    ]);

  return (
    <Screen
      title="Settings"
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
          <ChevronLeft size={28} color={theme.text} />
        </Pressable>
      }>
      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <T v="label" muted>
          THEME
        </T>
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {MODES.map((m) => (
            <Chip key={m.key} label={m.label} selected={settings.themeMode === m.key} onPress={() => set({ themeMode: m.key })} />
          ))}
        </Row>
        <T v="label" muted style={{ marginTop: 8 }}>
          ACCENT
        </T>
        <Row style={{ flexWrap: 'wrap', gap: 12 }}>
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
            const c = theme.isDark ? ACCENTS[k].onDark : ACCENTS[k].onLight;
            const selected = settings.accent === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`${ACCENTS[k].label} accent`}
                accessibilityState={{ selected }}
                onPress={() => set({ accent: k })}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c,
                  borderWidth: selected ? 3 : 0,
                  borderColor: theme.text,
                }}
              />
            );
          })}
        </Row>
        <Toggle
          label="Smooth animations"
          detail="Turn off for reduced motion. The system setting is also respected."
          value={settings.motion === 'full'}
          onChange={(v) => set({ motion: v ? 'full' : 'reduced' })}
        />
        <Toggle label="Haptic feedback" detail="Subtle vibrations on answers and taps." value={settings.haptics} onChange={(v) => set({ haptics: v })} />
      </Card>

      <SectionTitle>Learning</SectionTitle>
      <Card>
        <T v="label" muted>
          DAILY GOAL
        </T>
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {GOALS.map((g) => (
            <Chip key={g} label={`${g} min`} selected={settings.goalMinutes === g} onPress={() => set({ goalMinutes: g })} />
          ))}
        </Row>
        <T v="label" muted style={{ marginTop: 8 }}>
          FOCUS ROADMAP
        </T>
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {contentPack.roadmaps
            .filter((r) => r.lessonIds.length > 0)
            .map((r) => (
              <Chip key={r.id} label={`${r.code}. ${r.title}`} selected={settings.focusRoadmapId === r.id} onPress={() => set({ focusRoadmapId: r.id })} />
            ))}
        </Row>
        <Toggle
          label="Gamification"
          detail="XP, levels and streaks. Turn off for a focus-only experience."
          value={settings.gamification}
          onChange={(v) => set({ gamification: v })}
        />
      </Card>

      <SectionTitle>Notifications</SectionTitle>
      <Card>
        <Toggle
          label="Daily reminder"
          detail="One nudge a day, skipped once you hit your goal. Scheduled on this phone."
          value={settings.reminderEnabled}
          onChange={(v) => enable({ reminderEnabled: v })}
        />
        {settings.reminderEnabled ? (
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {TIMES.map(([h, m]) => (
              <Chip
                key={`${h}:${m}`}
                label={formatTime(h, m)}
                selected={settings.reminderHour === h && settings.reminderMinute === m}
                onPress={() => set({ reminderHour: h, reminderMinute: m })}
              />
            ))}
          </Row>
        ) : null}
        <Toggle
          label="Evening recap"
          detail="What you did today, only on days you studied."
          value={settings.recapEnabled}
          onChange={(v) => enable({ recapEnabled: v })}
        />
        <Toggle
          label="Weekly report"
          detail="Sunday summary of your minutes, active days and lessons."
          value={settings.weeklyReportEnabled}
          onChange={(v) => enable({ weeklyReportEnabled: v })}
        />
        {settings.recapEnabled || settings.weeklyReportEnabled ? (
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {RECAP_TIMES.map(([h, m]) => (
              <Chip
                key={`${h}:${m}`}
                label={formatTime(h, m)}
                selected={settings.recapHour === h && settings.recapMinute === m}
                onPress={() => set({ recapHour: h, recapMinute: m })}
              />
            ))}
          </Row>
        ) : null}
        <T v="heading">Quiet hours</T>
        <T v="caption" muted>
          Nothing is sent in this window.
        </T>
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {QUIET.map((q) => (
            <Chip key={q.label} label={q.label} selected={settings.quietStart === q.start && settings.quietEnd === q.end} onPress={() => set({ quietStart: q.start, quietEnd: q.end })} />
          ))}
        </Row>
      </Card>
      <Card>
        <Toggle
          label="Security advisories"
          detail={push.available ? 'High-impact items an editor has reviewed. At most 2 a day.' : `Unavailable: ${push.reason}`}
          value={settings.advisoriesPush && push.available}
          onChange={(v) => (push.available ? setPush({ advisoriesPush: v }) : undefined)}
        />
        <Toggle
          label="New lessons"
          detail={push.available ? 'When new content is published. At most 1 a day.' : `Unavailable: ${push.reason}`}
          value={settings.contentPush && push.available}
          onChange={(v) => (push.available ? setPush({ contentPush: v }) : undefined)}
        />
      </Card>

      <SectionTitle>Account & privacy</SectionTitle>
      <Card onPress={() => router.push('/account')} accessibilityLabel="Account and cloud sync">
        <T v="heading">{sync.session ? sync.session.email : 'Account & cloud sync'}</T>
        <T v="caption" muted>
          {sync.session ? 'Backed up and synced across your devices' : sync.configured ? 'Optional: sign in to back up your progress' : 'Offline mode'}
        </T>
      </Card>
      <Card>
        <Toggle
          label="Share anonymous usage statistics"
          detail={
            sync.session
              ? 'Helps improve lessons: study minutes per day and which lessons and labs you start and finish. No answers or text, under a pseudonymous id. Turning it off deletes what was shared.'
              : 'Available when signed in. Until then, statistics stay on this device.'
          }
          value={shareStats && !!sync.session}
          onChange={(v) => (sync.session ? toggleStats(v) : undefined)}
        />
      </Card>
      <Card>
        <T>
          Progress is stored on this device{sync.session ? ' and synced to your account' : ''}. No ads and no third-party analytics or trackers.
          Lesson content is AI-assisted draft material pending expert review.
        </T>
        <Button kind="danger" label="Reset all progress" onPress={confirmReset} />
      </Card>
      <Card onPress={() => router.push('/privacy')} accessibilityLabel="Privacy policy and data deletion">
        <T v="heading">Privacy policy</T>
        <T v="caption" muted>
          What is stored, where, and how to delete it
        </T>
      </Card>
      <T v="caption" muted style={{ textAlign: 'center' }}>
        Learn AI & Agent Security · content pack {contentPack.version}
      </T>
    </Screen>
  );
}
