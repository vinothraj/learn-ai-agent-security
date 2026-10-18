import { contentPack } from '@laas/content';
import { buildInsights, compareWeeks, minutes, roadmapProgress, series } from '@laas/shared';
import { router } from 'expo-router';
import { Award, BookOpen, Clock, Flame, Settings, Target, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { WeekBars } from '@/components/charts';
import { TodayCard } from '@/components/TodayCard';
import { Appear, Card, ProgressBar, Row, Screen, SectionTitle, T } from '@/components/ui';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

function Stat({ icon: Icon, color, value, label }: { icon: LucideIcon; color: string; value: string; label: string }) {
  const { theme } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        backgroundColor: theme.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 14,
        gap: 4,
      }}>
      <Icon size={18} color={color} />
      <T v="title">{value}</T>
      <T v="caption" muted>
        {label}
      </T>
    </View>
  );
}

function fmtDuration(seconds: number) {
  const m = minutes(seconds);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export default function Me() {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { stats, today, streak, level, completed, totalSeconds } = useProgress();
  const week = compareWeeks(stats, today);
  const insights = buildInsights(stats, today, settings.goalMinutes, streak);
  const answered = [...stats.values()].reduce((a, d) => a + d.questionsAnswered, 0);
  const correct = [...stats.values()].reduce((a, d) => a + d.questionsCorrect, 0);

  return (
    <Screen
      title="Your progress"
      subtitle="Every number here comes from your own activity on this device."
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12} onPress={() => router.push('/settings')}>
          <Settings size={24} color={theme.textMuted} />
        </Pressable>
      }>
      {settings.gamification ? (
        <Appear index={0}>
          <Card accent>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T v="caption" color={theme.accent}>
                  LEVEL {level.level}
                </T>
                <T v="title">{level.title}</T>
              </View>
              <T v="title" color={theme.warning}>
                {level.xp} XP
              </T>
            </Row>
            <ProgressBar value={level.progress} color={theme.warning} />
            <T v="caption" muted>
              {level.nextAt === null ? 'Top level reached.' : `${level.nextAt - level.xp} XP to the next level`}
            </T>
          </Card>
        </Appear>
      ) : null}

      <Appear index={1}>
        <TodayCard insightCount={0} />
      </Appear>

      <Appear index={2}>
        <SectionTitle>Last 7 days</SectionTitle>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <T v="title">{fmtDuration(week.thisWeekSeconds)}</T>
              <T v="caption" muted>
                {week.changePct === null
                  ? 'No previous week to compare yet'
                  : `${week.changePct >= 0 ? 'Up' : 'Down'} ${Math.abs(week.changePct)}% vs the 7 days before`}
              </T>
            </View>
            {week.bestDay ? (
              <View style={{ alignItems: 'flex-end' }}>
                <T v="caption" muted>
                  BEST DAY
                </T>
                <T v="heading">{minutes(week.bestDay.activeSeconds)} min</T>
              </View>
            ) : null}
          </Row>
          <WeekBars days={series(stats, today, 7)} goalMinutes={settings.goalMinutes} today={today} />
        </Card>
      </Appear>

      {insights.length > 0 ? (
        <Appear index={3}>
          <SectionTitle>Insights</SectionTitle>
          <Card>
            {insights.map((i) => (
              <Row key={i.id} style={{ alignItems: 'flex-start' }}>
                <TrendingUp size={16} color={i.tone === 'nudge' ? theme.warning : theme.accent} style={{ marginTop: 3 }} />
                <T style={{ flex: 1 }}>{i.text}</T>
              </Row>
            ))}
          </Card>
        </Appear>
      ) : null}

      <Appear index={4}>
        <SectionTitle>All time</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Stat icon={Clock} color={theme.accent} value={fmtDuration(totalSeconds)} label="Active learning time" />
          <Stat icon={BookOpen} color={theme.ringLessons} value={String(completed.size)} label="Lessons completed" />
          {settings.gamification ? (
            <>
              <Stat icon={Flame} color={theme.warning} value={`${streak.current} d`} label="Current streak" />
              <Stat icon={Award} color={theme.ringPractice} value={`${streak.longest} d`} label="Longest streak" />
            </>
          ) : null}
          <Stat icon={Target} color={theme.success} value={answered ? `${Math.round((correct / answered) * 100)}%` : '–'} label={`Quiz accuracy (${answered} answered)`} />
        </View>
      </Appear>

      <Appear index={5}>
        <SectionTitle>Roadmaps</SectionTitle>
        <Card>
          {contentPack.roadmaps
            .filter((r) => r.lessonIds.length > 0)
            .map((r) => {
              const p = roadmapProgress(r, completed);
              return (
                <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push(`/roadmap/${r.id}`)} style={{ gap: 6, paddingVertical: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="label">
                      {r.code}. {r.title}
                    </T>
                    <T v="caption" muted>
                      {p.done}/{p.total}
                    </T>
                  </Row>
                  <ProgressBar value={p.ratio} />
                </Pressable>
              );
            })}
        </Card>
      </Appear>

      <T v="caption" muted style={{ textAlign: 'center' }}>
        Time counts only while a learning screen is open and you have interacted in the last minute.
      </T>
    </Screen>
  );
}
