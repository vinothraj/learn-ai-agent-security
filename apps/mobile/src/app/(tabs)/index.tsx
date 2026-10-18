import { contentPack, lessonById, roadmapById } from '@laas/content';
import { compareWeeks, minutes, pickDaily, series, supportFor } from '@laas/shared';
import { router } from 'expo-router';
import {
  Brain,
  CalendarCheck,
  ChevronRight,
  Clock,
  FlaskConical,
  GraduationCap,
  MessageSquareText,
  Play,
  Settings,
  ShieldAlert,
  Target,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { WeekBars } from '@/components/charts';
import { GAME_ICONS } from '@/components/games';
import { TodayCard } from '@/components/TodayCard';
import { Appear, Card, IconBadge, ProgressBar, Row, Screen, SectionTitle, T, Tag } from '@/components/ui';
import { dailyGame, reviewMinutes } from '@/lib/daily';
import { lessonStepCount } from '@/lib/lesson';
import { NewsCard } from '@/components/NewsCard';
import { useNews } from '@/state/news';
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
  const { next, inProgress, today, stats, level, dueCards, dailyToday, weak, completed, labBests } = useProgress();
  // First unpassed lab whose lesson the learner has finished: theory first, then practice.
  const recommendedLab = contentPack.labs.find((l) => l.lessonId && completed.has(l.lessonId) && !labBests.get(l.id)?.passed);

  const threat = pickDaily(contentPack.threats, today, 'threat');
  const interviewQ = pickDaily(contentPack.interview.items.filter((q) => q.type !== 'mcq'), today, 'interview');
  const nextRoadmap = next ? roadmapById.get(next.roadmapId) : null;
  const resuming = next && inProgress?.lessonId === next.id;
  const week = compareWeeks(stats, today);
  const game = dailyGame(today);
  const GameIcon = GAME_ICONS[game.icon] ?? Target;
  const weakest = weak[0];
  const weakLesson = weakest ? lessonById.get(weakest.lessonId) : undefined;
  const support = weakLesson ? supportFor(weakLesson, completed).map((id) => lessonById.get(id)).filter((l) => l !== undefined) : [];
  const news = useNews();
  const latest = news.articles.slice(0, 2);
  let i = 0;

  return (
    <Screen
      title={greeting(settings.displayName)}
      subtitle={settings.gamification ? `Level ${level.level} · ${level.title} · ${level.xp} XP` : 'Ready for today’s session?'}
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12} onPress={() => router.push('/settings')}>
          <Settings size={24} color={theme.textMuted} />
        </Pressable>
      }>
      <Appear index={i++}>
        <TodayCard />
      </Appear>

      {next ? (
        <Appear index={i++}>
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
        <Appear index={i++}>
          <Card accent>
            <T v="title">You’ve finished every available lesson</T>
            <T muted>Keep your knowledge fresh with flashcards and games while new content is prepared.</T>
          </Card>
        </Appear>
      )}

      {dueCards.length > 0 ? (
        <Appear index={i++}>
          <Card onPress={() => router.push('/review')} accessibilityLabel={`Review ${dueCards.length} flashcards`}>
            <Row>
              <IconBadge icon={Brain} color={theme.ringLessons} />
              <View style={{ flex: 1 }}>
                <T v="heading">Revision due</T>
                <T v="caption" muted>
                  {dueCards.length} flashcard{dueCards.length === 1 ? '' : 's'} · ≈ {reviewMinutes(dueCards.length)} min · fills your Revise ring
                </T>
              </View>
              <ChevronRight size={20} color={theme.textMuted} />
            </Row>
          </Card>
        </Appear>
      ) : null}

      <Appear index={i++}>
        <Card onPress={() => router.push(`/game/${game.id}?daily=1`)} accessibilityLabel={`Daily challenge: ${game.title}`}>
          <Row>
            <IconBadge icon={dailyToday ? CalendarCheck : GameIcon} color={dailyToday ? theme.success : theme.ringPractice} />
            <View style={{ flex: 1 }}>
              <T v="caption" color={dailyToday ? theme.success : theme.ringPractice}>
                {dailyToday ? `DAILY CHALLENGE DONE · ${dailyToday.correct}/${dailyToday.total}` : 'DAILY CHALLENGE'}
              </T>
              <T v="heading">{game.title}</T>
              <T v="caption" muted>
                {dailyToday ? 'Replay for practice. Same puzzle for everyone today.' : `${game.tagline} 5 rounds.`}
              </T>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Row>
        </Card>
      </Appear>

      {weakest && weakLesson ? (
        <Appear index={i++}>
          <Card onPress={() => router.push(`/quiz?lesson=${weakLesson.id}`)} accessibilityLabel={`Strengthen ${weakLesson.title}`}>
            <Row>
              <IconBadge icon={Target} color={theme.warning} />
              <View style={{ flex: 1 }}>
                <T v="caption" color={theme.warning}>
                  WEAKEST TOPIC · MASTERY {weakest.score}%
                </T>
                <T v="heading">{weakLesson.title}</T>
                <T v="caption" muted>
                  Fix it in 5 minutes with a focused quiz
                </T>
              </View>
              <ChevronRight size={20} color={theme.textMuted} />
            </Row>
            {support[0] ? (
              <Pressable accessibilityRole="link" onPress={() => router.push(`/lesson/${support[0]!.id}`)} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <GraduationCap size={14} color={theme.accent} />
                <T v="label" color={theme.accent}>
                  Background first: {support[0].title} →
                </T>
              </Pressable>
            ) : null}
          </Card>
        </Appear>
      ) : null}

      {recommendedLab ? (
        <Appear index={i++}>
          <Card onPress={() => router.push(`/lab/${recommendedLab.id}`)} accessibilityLabel={`Recommended lab: ${recommendedLab.title}`}>
            <Row>
              <IconBadge icon={FlaskConical} color={theme.success} />
              <View style={{ flex: 1 }}>
                <T v="caption" color={theme.success}>
                  RECOMMENDED LAB · {recommendedLab.minutes} MIN
                </T>
                <T v="heading">{recommendedLab.title}</T>
                <T v="caption" muted>
                  Put “{lessonById.get(recommendedLab.lessonId!)?.title}” into practice
                </T>
              </View>
              <ChevronRight size={20} color={theme.textMuted} />
            </Row>
          </Card>
        </Appear>
      ) : null}

      {threat ? (
        <Appear index={i++}>
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

      {interviewQ ? (
        <Appear index={i++}>
          <Card onPress={() => router.push(`/interview/q/${interviewQ.id}`)} accessibilityLabel="Interview question of the day">
            <Row>
              <IconBadge icon={MessageSquareText} color={theme.info} />
              <View style={{ flex: 1 }}>
                <T v="caption" color={theme.info}>
                  INTERVIEW QUESTION OF THE DAY
                </T>
                <T v="heading">{interviewQ.question}</T>
              </View>
            </Row>
          </Card>
        </Appear>
      ) : null}

      {latest.length > 0 ? (
        <Appear index={i++}>
          <SectionTitle
            action={
              <Pressable accessibilityRole="link" onPress={() => router.push('/news')} hitSlop={8}>
                <T v="label" color={theme.accent}>
                  All news →
                </T>
              </Pressable>
            }>
            Latest verified news
          </SectionTitle>
          {latest.map((a) => (
            <View key={a.id} style={{ marginBottom: 12 }}>
              <NewsCard a={a} compact />
            </View>
          ))}
        </Appear>
      ) : null}

      <Appear index={i++}>
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
