import { contentPack } from '@laas/content';
import type { Level } from '@laas/shared';
import { router } from 'expo-router';
import { ChevronLeft, CircleCheck, Clock, FlaskConical, Star } from '@/components/icons';
import { Pressable, View } from 'react-native';

import { Illustration } from '@/components/art/Illustration';
import { Appear, Card, ProgressBar, Row, Screen, SectionTitle, T, Tag } from '@/components/ui';
import { useProgress } from '@/state/progress';
import { useTheme } from '@/theme/ThemeProvider';

const LEVELS: { id: Level; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

export default function Labs() {
  const { theme } = useTheme();
  const { labBests } = useProgress();
  const passed = contentPack.labs.filter((l) => labBests.get(l.id)?.passed).length;
  let i = 0;

  return (
    <Screen
      title="Security labs"
      subtitle="Attack a fictional system, harden it, export a report. Pure simulation: nothing leaves your phone."
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
          <ChevronLeft size={28} color={theme.text} />
        </Pressable>
      }>
      <Appear index={i++}>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="heading">
              {passed} of {contentPack.labs.length} labs passed
            </T>
            <FlaskConical size={20} color={theme.success} />
          </Row>
          <ProgressBar value={passed / contentPack.labs.length} color={theme.success} />
        </Card>
      </Appear>
      {LEVELS.map((lv) => {
        const labs = contentPack.labs.filter((l) => l.level === lv.id);
        if (labs.length === 0) return null;
        return (
          <View key={lv.id} style={{ gap: 12 }}>
            <Appear index={i++}>
              <SectionTitle>{lv.label}</SectionTitle>
            </Appear>
            {labs.map((lab) => {
              const best = labBests.get(lab.id);
              return (
                <Appear key={lab.id} index={i++}>
                  <Card onPress={() => router.push(`/lab/${lab.id}`)} accessibilityLabel={`${lab.title}${best?.passed ? `, passed with ${best.stars} stars` : ''}`}>
                    <Row style={{ alignItems: 'flex-start' }}>
                      <View>
                        <Illustration id={lab.id} width={72} height={56} />
                        {best?.passed ? (
                          <View style={{ position: 'absolute', right: -6, bottom: -6, backgroundColor: theme.surface, borderRadius: 12, padding: 2 }}>
                            <CircleCheck size={18} color={theme.success} />
                          </View>
                        ) : null}
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Tag label={lab.category} color={theme.ringPractice} />
                        <T v="heading">{lab.title}</T>
                        <T v="caption" muted>
                          {lab.summary}
                        </T>
                        <Row style={{ gap: 10 }}>
                          <Row style={{ gap: 4 }}>
                            <Clock size={12} color={theme.textMuted} />
                            <T v="caption" muted>
                              {lab.minutes} min · {lab.attacks.length} tests
                            </T>
                          </Row>
                          {best ? (
                            <Row style={{ gap: 2 }}>
                              {[1, 2, 3].map((s) => (
                                <Star key={s} size={13} color={theme.warning} fill={s <= best.stars ? theme.warning : 'transparent'} />
                              ))}
                            </Row>
                          ) : null}
                        </Row>
                      </View>
                    </Row>
                  </Card>
                </Appear>
              );
            })}
          </View>
        );
      })}
    </Screen>
  );
}
