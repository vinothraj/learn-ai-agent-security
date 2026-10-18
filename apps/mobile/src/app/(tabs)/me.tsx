import { contentPack, lessonById } from '@laas/content';
import {
  accuracyByPart,
  buildInsights,
  compareWeeks,
  emptyDay,
  masteryTrend,
  minutes,
  parseDayKey,
  roadmapProgress,
  series,
  suggestReminder,
  timeOfDayTotals,
} from '@laas/shared';
import { router } from 'expo-router';
import {
  Award,
  BellRing,
  BookOpen,
  Brain,
  Clock,
  Flame,
  Lock,
  Settings,
  Share2,
  Snowflake,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { WeekBars } from '@/components/charts';
import { SkillRadar, StatPill, StudyHeatmap, TimeOfDayBars, TrendLine } from '@/components/reportCharts';
import { TodayCard } from '@/components/TodayCard';
import { Appear, Button, Card, ProgressBar, Row, Screen, SectionTitle, T } from '@/components/ui';
import { formatTime, scheduleDailyReminder } from '@/lib/reminders';
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
  const { settings, update } = useSettings();
  const p = useProgress();
  const { stats, today, streak, level, completed, totalSeconds, weak, skills, evidence, sessions, badges, dueCards } = p;
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const week = compareWeeks(stats, today);
  const insights = buildInsights(stats, today, settings.goalMinutes, streak, {
    dueCards: dueCards.length,
    partAccuracy: accuracyByPart(evidence),
  });
  const all = [...stats.values()];
  const answered = all.reduce((a, d) => a + d.questionsAnswered + d.gameRounds, 0);
  const correct = all.reduce((a, d) => a + d.questionsCorrect + d.gameCorrect, 0);
  const cardsReviewed = all.reduce((a, d) => a + d.cardsReviewed, 0);
  const tod = timeOfDayTotals(sessions);
  const suggestion = suggestReminder(tod, settings.reminderHour);
  // Captured once per mount so the trend is stable while the screen is open.
  const [now] = useState(() => Date.now());
  const trend = masteryTrend(evidence, contentPack.lessons.map((l) => l.id), now, 8);
  const sel = selectedDay ? stats.get(selectedDay) ?? emptyDay(selectedDay) : null;
  const earned = badges.filter((b) => b.earned).length;

  const applySuggestion = async () => {
    if (!suggestion) return;
    const ok = await scheduleDailyReminder(suggestion.hour, suggestion.minute);
    if (!ok) {
      Alert.alert('Notifications are off', 'Allow notifications for this app in Android settings to get reminders.');
      return;
    }
    await update({ reminderEnabled: true, reminderHour: suggestion.hour, reminderMinute: suggestion.minute });
  };

  let i = 0;
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
        <Appear index={i++}>
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
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="caption" muted>
                {level.nextAt === null ? 'Top level reached.' : `${level.nextAt - level.xp} XP to the next level`}
              </T>
              {streak.freezes > 0 ? (
                <Row style={{ gap: 4 }}>
                  <Snowflake size={13} color={theme.info} />
                  <T v="caption" color={theme.info}>
                    {streak.freezes} streak freeze{streak.freezes === 1 ? '' : 's'}
                  </T>
                </Row>
              ) : null}
            </Row>
          </Card>
        </Appear>
      ) : null}

      <Appear index={i++}>
        <TodayCard insightCount={0} />
      </Appear>

      <Appear index={i++}>
        <SectionTitle
          action={
            <Pressable accessibilityRole="button" onPress={() => router.push('/share')} hitSlop={8} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Share2 size={16} color={theme.accent} />
              <T v="label" color={theme.accent}>
                Share
              </T>
            </Pressable>
          }>
          Last 7 days
        </SectionTitle>
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
        <Appear index={i++}>
          <SectionTitle>Insights</SectionTitle>
          <Card>
            {insights.map((x) => (
              <Row key={x.id} style={{ alignItems: 'flex-start' }}>
                <TrendingUp size={16} color={x.tone === 'nudge' ? theme.warning : theme.accent} style={{ marginTop: 3 }} />
                <T style={{ flex: 1 }}>{x.text}</T>
              </Row>
            ))}
          </Card>
        </Appear>
      ) : null}

      <Appear index={i++}>
        <SectionTitle>Activity calendar</SectionTitle>
        <Card>
          <StudyHeatmap
            stats={stats}
            today={today}
            goalMinutes={settings.goalMinutes}
            frozenDays={streak.frozenDays}
            selected={selectedDay}
            onSelect={setSelectedDay}
          />
          {sel ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <T v="label">
                {parseDayKey(sel.day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                {streak.frozenDays.includes(sel.day) ? ' · streak freeze used' : ''}
              </T>
              <Row style={{ gap: 8 }}>
                <StatPill label="minutes" value={String(minutes(sel.activeSeconds))} />
                <StatPill label="lessons" value={String(sel.lessonsCompleted)} />
                <StatPill label="practice" value={String(sel.questionsAnswered + sel.gameRounds)} />
                <StatPill label="cards" value={String(sel.cardsReviewed)} />
              </Row>
            </View>
          ) : (
            <T v="caption" muted>
              Tap a day to see what you did.
            </T>
          )}
        </Card>
      </Appear>

      <Appear index={i++}>
        <SectionTitle>Skill radar</SectionTitle>
        <Card>
          <SkillRadar skills={skills} />
          <T v="caption" muted>
            Mastery per area from recent quiz and game answers plus flashcard recall. Unstarted lessons count as 0%.
          </T>
        </Card>
      </Appear>

      <Appear index={i++}>
        <SectionTitle>Knowledge trend</SectionTitle>
        <Card>
          <TrendLine points={trend} />
          <T v="caption" muted>
            Overall mastery at the end of each of the last 8 weeks, based on quiz and game answers.
          </T>
        </Card>
      </Appear>

      <Appear index={i++}>
        <SectionTitle>Focus areas</SectionTitle>
        <Card>
          {weak.length === 0 ? (
            <T muted>
              No weak topics right now. Weak topics appear after at least 2 answers on a lesson with mastery below 60%.
            </T>
          ) : (
            weak.slice(0, 3).map((w) => {
              const l = lessonById.get(w.lessonId);
              if (!l) return null;
              return (
                <View key={w.lessonId} style={{ gap: 6, paddingVertical: 4 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="label" style={{ flex: 1 }}>
                      {l.title}
                    </T>
                    <T v="caption" color={theme.warning}>
                      {w.score}%
                    </T>
                  </Row>
                  <ProgressBar value={w.score / 100} color={theme.warning} />
                  <Button kind="secondary" label="Fix in 5 min" icon={Target} onPress={() => router.push(`/quiz?lesson=${l.id}`)} />
                </View>
              );
            })
          )}
        </Card>
      </Appear>

      <Appear index={i++}>
        <SectionTitle>When you study</SectionTitle>
        <Card>
          <TimeOfDayBars totals={tod} />
          {suggestion ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <T>
                You do most of your learning in the {suggestion.label.toLowerCase()}.{' '}
                {settings.reminderEnabled
                  ? `Move your reminder to ${formatTime(suggestion.hour, suggestion.minute)}?`
                  : `Set a reminder for ${formatTime(suggestion.hour, suggestion.minute)}?`}
              </T>
              <Button kind="secondary" icon={BellRing} label={settings.reminderEnabled ? 'Move reminder' : 'Set reminder'} onPress={applySuggestion} />
            </View>
          ) : (
            <T v="caption" muted>
              After about 30 minutes of learning we can suggest the best reminder time for you.
            </T>
          )}
        </Card>
      </Appear>

      <Appear index={i++}>
        <SectionTitle>{`Badges · ${earned}/${badges.length}`}</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {badges.map((b) => (
            <View
              key={b.id}
              accessible
              accessibilityLabel={`${b.title}. ${b.description}. ${b.earned ? 'Earned' : `Progress ${b.progress}`}`}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                backgroundColor: b.earned ? theme.warning + '1A' : theme.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: b.earned ? theme.warning + '88' : theme.border,
                padding: 12,
                gap: 4,
                opacity: b.earned ? 1 : 0.8,
              }}>
              <Row style={{ gap: 6 }}>
                {b.earned ? <Award size={18} color={theme.warning} /> : <Lock size={16} color={theme.textMuted} />}
                <T v="label" style={{ flex: 1 }}>
                  {b.title}
                </T>
              </Row>
              <T v="caption" muted>
                {b.description}
              </T>
              {!b.earned ? <ProgressBar value={b.ratio} height={5} color={theme.warning} /> : null}
            </View>
          ))}
        </View>
      </Appear>

      <Appear index={i++}>
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
          <Stat icon={Target} color={theme.success} value={answered ? `${Math.round((correct / answered) * 100)}%` : '–'} label={`Accuracy (${answered} answered)`} />
          <Stat icon={Brain} color={theme.ringLessons} value={String(cardsReviewed)} label="Flashcards reviewed" />
        </View>
      </Appear>

      <Appear index={i++}>
        <SectionTitle>Roadmaps</SectionTitle>
        <Card>
          {contentPack.roadmaps
            .filter((r) => r.lessonIds.length > 0)
            .map((r) => {
              const rp = roadmapProgress(r, completed);
              return (
                <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push(`/roadmap/${r.id}`)} style={{ gap: 6, paddingVertical: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="label">
                      {r.code}. {r.title}
                    </T>
                    <T v="caption" muted>
                      {rp.done}/{rp.total}
                    </T>
                  </Row>
                  <ProgressBar value={rp.ratio} />
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
