import { contentPack } from '@laas/content';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ChevronLeft } from 'lucide-react-native';
import { Alert, Pressable, Switch, View } from 'react-native';

import { Button, Card, Chip, Row, Screen, SectionTitle, T } from '@/components/ui';
import { resetAllProgress } from '@/db/repo';
import { cancelReminders, formatTime, scheduleDailyReminder } from '@/lib/reminders';
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

  const setReminder = async (enabled: boolean, hour = settings.reminderHour, minute = settings.reminderMinute) => {
    if (!enabled) {
      await cancelReminders();
      return set({ reminderEnabled: false });
    }
    const ok = await scheduleDailyReminder(hour, minute);
    if (!ok) Alert.alert('Notifications are off', 'Allow notifications for this app in Android settings to get reminders.');
    await set({ reminderEnabled: ok, reminderHour: hour, reminderMinute: minute });
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

      <SectionTitle>Reminders</SectionTitle>
      <Card>
        <Toggle
          label="Daily reminder"
          detail="At most one local notification a day. Nothing leaves your phone."
          value={settings.reminderEnabled}
          onChange={(v) => setReminder(v)}
        />
        {settings.reminderEnabled ? (
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {TIMES.map(([h, m]) => (
              <Chip
                key={`${h}:${m}`}
                label={formatTime(h, m)}
                selected={settings.reminderHour === h && settings.reminderMinute === m}
                onPress={() => setReminder(true, h, m)}
              />
            ))}
          </Row>
        ) : null}
      </Card>

      <SectionTitle>Account & privacy</SectionTitle>
      <Card onPress={() => router.push('/account')} accessibilityLabel="Account and cloud sync">
        <T v="heading">{sync.session ? sync.session.email : 'Account & cloud sync'}</T>
        <T v="caption" muted>
          {sync.session ? 'Backed up and synced across your devices' : sync.configured ? 'Optional: sign in to back up your progress' : 'Offline mode'}
        </T>
      </Card>
      <Card>
        <T>
          Progress is stored on this device{sync.session ? ' and synced to your account' : ''}. No ads and no third-party analytics.
          Lesson content is AI-assisted draft material pending expert review.
        </T>
        <Button kind="danger" label="Reset all progress" onPress={confirmReset} />
      </Card>
      <T v="caption" muted style={{ textAlign: 'center' }}>
        Learn AI & Agent Security · content pack {contentPack.version}
      </T>
    </Screen>
  );
}
