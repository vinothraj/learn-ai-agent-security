import { contentPack, lessonById } from '@laas/content';
import { dayKey, quizXp, shuffle, type QuizQuestion } from '@laas/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Trophy, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInRight, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuizQuestionView } from '@/components/QuizQuestionView';
import { Button, IconBadge, ProgressBar, Row, T, Tag } from '@/components/ui';
import { awardXp, recordResponse } from '@/db/repo';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useStudySession } from '@/state/tracker';
import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const QUIZ_SIZE = 5;

/**
 * Focused revision: the weak lesson's questions first, then studied lessons in the same skill area.
 * Otherwise: questions from lessons the learner has studied first, topped up from the rest.
 */
function pickQuestions(studied: Set<string>, focus: string | undefined): { q: QuizQuestion; lessonId: string }[] {
  const pool = contentPack.lessons.flatMap((l) => l.quiz.map((q) => ({ q, lessonId: l.id })));
  if (focus && lessonById.has(focus)) {
    const related = new Set(contentPack.skills.filter((s) => s.lessonIds.includes(focus)).flatMap((s) => s.lessonIds));
    const own = shuffle(pool.filter((p) => p.lessonId === focus));
    const near = shuffle(pool.filter((p) => p.lessonId !== focus && related.has(p.lessonId) && studied.has(p.lessonId)));
    const rest = shuffle(pool.filter((p) => p.lessonId !== focus && !related.has(p.lessonId) && studied.has(p.lessonId)));
    return [...own, ...near, ...rest].slice(0, QUIZ_SIZE);
  }
  const fromStudied = shuffle(pool.filter((p) => studied.has(p.lessonId)));
  const rest = shuffle(pool.filter((p) => !studied.has(p.lessonId)));
  return [...fromStudied, ...rest].slice(0, QUIZ_SIZE);
}

export default function QuickQuiz() {
  const db = useSQLiteContext();
  const { theme, animate } = useTheme();
  const haptic = useHaptics();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { lesson: focus } = useLocalSearchParams<{ lesson?: string }>();
  const { statuses, refresh } = useProgress();
  useStudySession('quiz', focus ? `focus:${focus}` : 'quick-quiz');
  const focusLesson = focus ? lessonById.get(focus) : undefined;

  // Picked once per visit; later progress refreshes must not reshuffle a running quiz.
  const [questions] = useState(() => pickQuestions(new Set(statuses.keys()), focus));
  const [runId] = useState(() => String(Date.now()));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [xp, setXp] = useState<number | null>(null);

  const done = xp !== null;
  const current = questions[index];
  const correct = questions.filter((item, i) => answers[i] === item.q.correctIndex).length;

  const answer = (choice: number) => {
    if (!current) return;
    setAnswers((a) => a.map((v, i) => (i === index ? choice : v)));
    recordResponse(db, {
      questionId: current.q.id,
      lessonId: current.lessonId,
      source: 'quick_quiz',
      correct: choice === current.q.correctIndex,
      day: dayKey(new Date()),
    }).then(refresh);
  };

  const finish = async () => {
    const earned = quizXp(correct, questions.length);
    await awardXp(db, dayKey(new Date()), earned, 'quick_quiz', runId);
    await refresh();
    haptic('success');
    setXp(earned);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + space.sm }}>
      <Row style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close quiz" hitSlop={12} onPress={() => router.back()}>
          <X size={26} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar value={done ? 1 : (index + 1) / questions.length} color={theme.ringPractice} />
        </View>
        <T v="caption" muted>
          {Math.min(index + 1, questions.length)}/{questions.length}
        </T>
      </Row>

      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        {done ? (
          <View style={{ alignItems: 'center', gap: space.lg, paddingTop: space.xxl }}>
            <Animated.View entering={animate ? ZoomIn.springify().damping(12) : undefined}>
              <IconBadge icon={Trophy} size={88} color={theme.warning} />
            </Animated.View>
            <T v="display">
              {correct}/{questions.length} correct
            </T>
            {settings.gamification ? (
              <T v="title" color={theme.warning}>
                +{xp} XP
              </T>
            ) : null}
            <T muted style={{ textAlign: 'center' }}>
              {correct === questions.length
                ? 'Perfect run. These topics are sticking.'
                : 'Missed questions come from lessons worth a quick revisit.'}
            </T>
          </View>
        ) : current ? (
          <Animated.View key={index} entering={animate ? FadeInRight.duration(260) : undefined} style={{ gap: space.md }}>
            {focusLesson ? <Tag label={`FOCUSED REVISION · ${focusLesson.title}`} color={theme.warning} /> : null}
            <QuizQuestionView question={current.q} answer={answers[index] ?? null} onAnswer={answer} />
          </Animated.View>
        ) : (
          <T muted>No questions available yet.</T>
        )}
      </ScrollView>

      <Row style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg, borderTopWidth: 1, borderTopColor: theme.border }}>
        {done ? (
          <Button label="Done" onPress={() => router.back()} style={{ flex: 1 }} />
        ) : (
          <Button
            label={index === questions.length - 1 ? 'See results' : 'Next question'}
            disabled={answers[index] === null}
            onPress={index === questions.length - 1 ? finish : () => setIndex(index + 1)}
            style={{ flex: 1 }}
          />
        )}
      </Row>
    </View>
  );
}
