import { accuracyByPart, buildInsights, emptyDay, learnRing, practiceRing, reviseRing } from '@laas/shared';
import { Flame, Snowflake, Sparkles } from '@/components/icons';
import { View } from 'react-native';

import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { ActivityRings } from './charts';
import { Card, Row, T } from './ui';

/** Today's rings, streak (with banked freezes) and the most relevant data-driven insights. */
export function TodayCard({ insightCount = 1 }: { insightCount?: number }) {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { stats, today, streak, dueCards, cards, evidence } = useProgress();
  const t = stats.get(today) ?? emptyDay(today);
  const learn = learnRing(t, settings.goalMinutes);
  const practice = practiceRing(t);
  const revise = reviseRing(t.cardsReviewed, dueCards.length, cards.length);
  const insights =
    insightCount > 0
      ? buildInsights(stats, today, settings.goalMinutes, streak, {
          dueCards: dueCards.length,
          partAccuracy: accuracyByPart(evidence),
        }).slice(0, insightCount)
      : [];

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label" muted>
          TODAY
        </T>
        {settings.gamification ? (
          <Row style={{ gap: 10 }}>
            {streak.freezes > 0 ? (
              <Row style={{ gap: 3 }} accessibilityLabel={`${streak.freezes} streak freezes banked`}>
                <Snowflake size={15} color={theme.info} />
                <T v="label" color={theme.info}>
                  {streak.freezes}
                </T>
              </Row>
            ) : null}
            <Row style={{ gap: 6 }}>
              <Flame size={18} color={streak.activeToday ? theme.warning : theme.textMuted} />
              <T v="heading" color={streak.activeToday ? theme.warning : theme.textMuted}>
                {streak.current} day{streak.current === 1 ? '' : 's'}
              </T>
            </Row>
          </Row>
        ) : null}
      </Row>
      <ActivityRings
        rings={[
          { label: 'Learn', value: learn.value, color: theme.accent, detail: learn.detail },
          { label: 'Practice', value: practice.value, color: theme.ringPractice, detail: practice.detail },
          { label: 'Revise', value: revise.value, color: theme.ringLessons, detail: revise.detail },
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
