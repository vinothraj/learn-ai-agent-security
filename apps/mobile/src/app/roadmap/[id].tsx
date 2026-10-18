import { lessonById, roadmapById } from '@laas/content';
import { isLessonUnlocked, roadmapProgress } from '@laas/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CircleCheck, Clock, Lock, Play } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Appear, Card, ProgressBar, Row, Screen, T, Tag } from '@/components/ui';
import { useProgress } from '@/state/progress';
import { useTheme } from '@/theme/ThemeProvider';

export default function RoadmapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { completed, statuses } = useProgress();
  const roadmap = roadmapById.get(id);

  if (!roadmap) {
    return (
      <Screen title="Not found">
        <T muted>This roadmap does not exist.</T>
      </Screen>
    );
  }

  const p = roadmapProgress(roadmap, completed);
  const lessons = roadmap.lessonIds.map((lid) => lessonById.get(lid)).filter((l) => l !== undefined);

  return (
    <Screen
      title={roadmap.title}
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
          <ChevronLeft size={28} color={theme.text} />
        </Pressable>
      }>
      <T muted>{roadmap.description}</T>
      {lessons.length > 0 ? (
        <View style={{ gap: 6 }}>
          <ProgressBar value={p.ratio} />
          <T v="caption" muted>
            {p.done} of {p.total} complete
          </T>
        </View>
      ) : (
        <Card>
          <T v="heading">Lessons coming soon</T>
          <T muted>This roadmap is planned for the next content pack. Keep going with the security roadmaps meanwhile.</T>
        </Card>
      )}

      {lessons.map((lesson, i) => {
        const done = completed.has(lesson.id);
        const unlocked = isLessonUnlocked(lesson, completed);
        const inProg = statuses.get(lesson.id)?.status === 'in_progress';
        const missing = lesson.prerequisites.filter((pid) => !completed.has(pid)).map((pid) => lessonById.get(pid)?.title);
        const Icon = done ? CircleCheck : unlocked ? Play : Lock;
        const color = done ? theme.success : unlocked ? theme.accent : theme.textMuted;
        return (
          <Appear key={lesson.id} index={i}>
            <Card
              onPress={unlocked || done ? () => router.push(`/lesson/${lesson.id}`) : undefined}
              accessibilityLabel={`${lesson.title}. ${done ? 'Completed' : unlocked ? 'Available' : 'Locked'}`}
              style={!unlocked && !done ? { opacity: 0.6 } : undefined}>
              <Row>
                <Icon size={22} color={color} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="heading">{lesson.title}</T>
                  <Row style={{ gap: 8 }}>
                    <Clock size={12} color={theme.textMuted} />
                    <T v="caption" muted>
                      {lesson.minutes} min · {lesson.level}
                    </T>
                  </Row>
                </View>
                {inProg ? <Tag label="In progress" /> : null}
              </Row>
              {!unlocked && !done ? (
                <T v="caption" muted>
                  Complete first: {missing.join(', ')}
                </T>
              ) : null}
            </Card>
          </Appear>
        );
      })}
    </Screen>
  );
}
