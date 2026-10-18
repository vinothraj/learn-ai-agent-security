import { contentPack, roadmapById } from '@laas/content';
import { compareWeeks, minutes, pickDaily, series } from '@laas/shared';
import { router } from 'expo-router';
import { ChevronRight, Clock, MessageSquareText, Play, Settings, ShieldAlert, Zap } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { WeekBars } from '@/components/charts';
import { TodayCard } from '@/components/TodayCard';
import { Appear, Card, IconBadge, ProgressBar, Row, Screen, SectionTitle, T, Tag } from '@/components/ui';
import { lessonStepCount } from '@/lib/lesson';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

export default function Home() {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { next, inProgress, today, stats, level } = useProgress();

  const threat = pickDaily(contentPack.threats, today, 'threat');
  const interviewLesson = pickDaily(contentPack.lessons, today, 'interview');
  const nextRoadmap = next ? roadmapById.get(next.roadmapId) : null;
  const resuming = next && inProgress?.lessonId === next.id;
  const week = compareWeeks(stats, today);

  return (
    <Screen
      title={greeting(settings.displayName)}
      subtitle={settings.gamification ? `Level ${level.level} · ${level.title} · ${level.xp} XP` : 'Ready for today’s session?'}
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12} onPress={() => router.push('/settings')}>
          <Settings size={24} color={theme.textMuted} />
        </Pressable>
      }>
      <Appear index={0}>
        <TodayCard />
      </Appear>

      {next ? (
        <Appear index={1}>
          <Card accent onPress={() => router.push(`/lesson/${next.id}`)} accessibilityLabel={`${resuming ? 'Continue' : 'Start'} ${next.title}`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Tag label={resuming ? 'CONTINUE LEARNING' : "TODAY'S LESSON"} />
              <Row style={{ gap: 4 }}>
                <Clock size={14} color={theme.textMuted} />
                <T v="caption" muted>
                  {next.minutes} min
                </T>
              </Row>
            </Row>
            <T v="title">{next.title}</T>
            <T muted>{next.summary}</T>
            {resuming && inProgress ? <ProgressBar value={inProgress.step / lessonStepCount(next)} /> : null}
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <T v="caption" muted>
                {nextRoadmap ? `${nextRoadmap.code}. ${nextRoadmap.title}` : ''}
              </T>
              <View style={{ backgroundColor: theme.accent, borderRadius: 999, padding: 10 }}>
                <Play size={18} color={theme.onAccent} fill={theme.onAccent} />
              </View>
            </Row>
          </Card>
        </Appear>
      ) : (
        <Appear index={1}>
          <Card accent>
            <T v="title">You’ve finished every available lesson</T>
            <T muted>Revise with a quick quiz while the next content pack is prepared.</T>
          </Card>
        </Appear>
      )}

      <Appear index={2}>
        <Card onPress={() => router.push('/quiz')} accessibilityLabel="Daily quick quiz">
          <Row>
            <IconBadge icon={Zap} color={theme.ringPractice} />
            <View style={{ flex: 1 }}>
              <T v="heading">Daily challenge: quick quiz</T>
              <T v="caption" muted>
                5 questions · about 2 minutes · fills your Practice ring
              </T>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Row>
        </Card>
      </Appear>

      {threat ? (
        <Appear index={3}>
          <Card
            onPress={() => (threat.lessonId ? router.push(`/lesson/${threat.lessonId}`) : router.push('/news'))}
            accessibilityLabel={`Threat of the day: ${threat.title}`}>
            <Row>
              <IconBadge icon={ShieldAlert} color={theme.danger} />
              <View style={{ flex: 1 }}>
                <T v="caption" color={theme.danger}>
                  THREAT OF THE DAY
                </T>
                <T v="heading">{threat.title}</T>
              </View>
            </Row>
            <T muted>{threat.summary}</T>
            <T v="label" color={theme.success}>
              Defense: {threat.defense}
            </T>
          </Card>
        </Appear>
      ) : null}

      {interviewLesson ? (
        <Appear index={4}>
          <Card onPress={() => router.push(`/interview?focus=${interviewLesson.interview.id}`)} accessibilityLabel="Interview question of the day">
            <Row>
              <IconBadge icon={MessageSquareText} color={theme.info} />
              <View style={{ flex: 1 }}>
                <T v="caption" color={theme.info}>
                  INTERVIEW QUESTION OF THE DAY
                </T>
                <T v="heading">{interviewLesson.interview.question}</T>
              </View>
            </Row>
          </Card>
        </Appear>
      ) : null}

      <Appear index={5}>
        <SectionTitle>This week</SectionTitle>
        <Card onPress={() => router.push('/me')} accessibilityLabel="Open progress report">
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="heading">{minutes(week.thisWeekSeconds)} min in the last 7 days</T>
            {week.changePct !== null ? (
              <T v="label" color={week.changePct >= 0 ? theme.success : theme.textMuted}>
                {week.changePct >= 0 ? '▲' : '▼'} {Math.abs(week.changePct)}%
              </T>
            ) : null}
          </Row>
          <WeekBars days={series(stats, today, 7)} goalMinutes={settings.goalMinutes} today={today} height={130} />
        </Card>
      </Appear>
    </Screen>
  );
}
