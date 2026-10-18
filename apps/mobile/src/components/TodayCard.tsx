import { buildInsights, minutes, ringProgress } from '@laas/shared';
import { Flame, Sparkles } from 'lucide-react-native';
import { View } from 'react-native';

import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { ActivityRings } from './charts';
import { Card, Row, T } from './ui';

export const PRACTICE_GOAL = 5;

/** Today's rings, streak and the single most relevant data-driven insight. */
export function TodayCard({ insightCount = 1 }: { insightCount?: number }) {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { stats, today, streak } = useProgress();
  const t = stats.get(today);
  const goals = { learnMinutes: settings.goalMinutes, practiceQuestions: PRACTICE_GOAL, lessons: 1 };
  const rp = ringProgress(
    t ?? { day: today, activeSeconds: 0, byActivity: {}, lessonsCompleted: 0, questionsAnswered: 0, questionsCorrect: 0, xp: 0 },
    goals,
  );
  const insights = buildInsights(stats, today, settings.goalMinutes, streak).slice(0, insightCount);

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label" muted>
          TODAY
        </T>
        {settings.gamification ? (
          <Row style={{ gap: 6 }}>
            <Flame size={18} color={streak.activeToday ? theme.warning : theme.textMuted} />
            <T v="heading" color={streak.activeToday ? theme.warning : theme.textMuted}>
              {streak.current} day{streak.current === 1 ? '' : 's'}
            </T>
          </Row>
        ) : null}
      </Row>
      <ActivityRings
        rings={[
          {
            label: 'Learn',
            value: rp.learn,
            color: theme.accent,
            detail: `${minutes(t?.activeSeconds ?? 0)} / ${settings.goalMinutes} min`,
          },
          {
            label: 'Practice',
            value: rp.practice,
            color: theme.ringPractice,
            detail: `${t?.questionsAnswered ?? 0} / ${PRACTICE_GOAL} questions`,
          },
          {
            label: 'Lessons',
            value: rp.lessons,
            color: theme.ringLessons,
            detail: `${t?.lessonsCompleted ?? 0} / 1 lesson`,
          },
        ]}
      />
      {insights.map((i) => (
        <View
          key={i.id}
          style={{
            flexDirection: 'row',
            gap: 8,
            alignItems: 'flex-start',
            backgroundColor: theme.surfaceAlt,
            borderRadius: 12,
            padding: 12,
            marginTop: 4,
          }}>
          <Sparkles size={16} color={i.tone === 'nudge' ? theme.warning : theme.accent} style={{ marginTop: 3 }} />
          <T style={{ flex: 1 }}>{i.text}</T>
        </View>
      ))}
    </Card>
  );
}
