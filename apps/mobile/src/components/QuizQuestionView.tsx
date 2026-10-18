import type { QuizQuestion } from '@laas/shared';
import { CircleCheck, CircleX } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { T } from './ui';

/** One multiple-choice question with immediate, explained feedback. */
export function QuizQuestionView({
  question,
  answer,
  onAnswer,
}: {
  question: QuizQuestion;
  answer: number | null;
  onAnswer: (index: number) => void;
}) {
  const { theme, animate } = useTheme();
  const haptic = useHaptics();
  const answered = answer !== null;
  const correct = answer === question.correctIndex;

  return (
    <View style={{ gap: space.md }}>
      <T v="title">{question.prompt}</T>
      {question.options.map((opt, i) => {
        const isCorrect = i === question.correctIndex;
        const isChosen = i === answer;
        const border = !answered
          ? theme.border
          : isCorrect
            ? theme.success
            : isChosen
              ? theme.danger
              : theme.border;
        const bg = answered && isCorrect ? theme.success + '1F' : answered && isChosen ? theme.danger + '1F' : theme.surface;
        return (
          <Pressable
            key={i}
            disabled={answered}
            accessibilityRole="button"
            accessibilityState={{ disabled: answered, selected: isChosen }}
            accessibilityLabel={`Option ${i + 1}: ${opt}${answered && isCorrect ? ', correct answer' : ''}`}
            onPress={() => {
              haptic(isCorrect ? 'success' : 'error');
              onAnswer(i);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              padding: space.lg,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: border,
              backgroundColor: bg,
              opacity: answered && !isCorrect && !isChosen ? 0.6 : pressed ? 0.85 : 1,
            })}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.surfaceAlt,
              }}>
              {answered && isCorrect ? (
                <CircleCheck size={22} color={theme.success} />
              ) : answered && isChosen ? (
                <CircleX size={22} color={theme.danger} />
              ) : (
                <T v="label">{String.fromCharCode(65 + i)}</T>
              )}
            </View>
            <T style={{ flex: 1 }}>{opt}</T>
          </Pressable>
        );
      })}
      {answered ? (
        <Animated.View
          entering={animate ? FadeIn.duration(250) : undefined}
          style={{
            padding: space.lg,
            borderRadius: radius.md,
            backgroundColor: (correct ? theme.success : theme.warning) + '18',
            gap: 4,
          }}>
          <T v="heading" color={correct ? theme.success : theme.warning}>
            {correct ? 'Correct' : 'Not quite'}
          </T>
          <T>{question.explanation}</T>
        </Animated.View>
      ) : null}
    </View>
  );
}
