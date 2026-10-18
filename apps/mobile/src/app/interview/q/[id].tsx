import { contentPack, interviewItemById, lessonById } from '@laas/content';
import { dayKey, scoreAnswer, type AnswerScore } from '@laas/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AiFeedbackCard, AnswerComposer, FeedbackPanel, QuestionHeader } from '@/components/interview';
import { Button, Card, Screen, T } from '@/components/ui';
import { awardXp, rateInterviewAnswer, saveInterviewAnswer, setBookmark } from '@/db/repo';
import { useProgress } from '@/state/progress';
import { useSync } from '@/state/sync';
import { useStudySession } from '@/state/tracker';
import { useHaptics, useTheme } from '@/theme/ThemeProvider';

const PRACTICE_XP = 5;

/** Practise one question with immediate, transparent feedback. */
export default function PracticeQuestion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = interviewItemById.get(id);
  const db = useSQLiteContext();
  const { theme } = useTheme();
  const haptic = useHaptics();
  const { refresh, bookmarks, questionStats } = useProgress();
  const sync = useSync();
  useStudySession('interview', id);

  const [result, setResult] = useState<{ score: AnswerScore; answer: string | number; rowId: number } | null>(null);
  const [rating, setRating] = useState<number | null>(null);

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
      <ChevronLeft size={28} color={theme.text} />
    </Pressable>
  );

  if (!item) {
    return (
      <Screen title="Not found" right={back}>
        <T muted>This question does not exist.</T>
      </Screen>
    );
  }

  const submit = async (answer: string | number) => {
    const score = scoreAnswer(item, answer);
    const day = dayKey(new Date());
    const rowId = await saveInterviewAnswer(db, {
      questionId: item.id,
      lessonId: item.lessonId ?? null,
      topic: item.topic,
      mode: 'practice',
      sessionId: null,
      answer: typeof answer === 'number' ? item.mcq!.options[answer]! : answer,
      coverage: score.coverage,
      day,
    });
    if (score.coverage >= 60) await awardXp(db, day, PRACTICE_XP, 'interview_answer', `${item.id}:${day}`);
    haptic(score.coverage >= 60 ? 'success' : 'tap');
    setResult({ score, answer, rowId });
    refresh();
  };

  const rate = async (r: number) => {
    if (!result) return;
    setRating(r);
    await rateInterviewAnswer(db, result.rowId, r);
  };

  // Next: an unattempted question in the same topic, otherwise any other in the topic.
  const sameTopic = contentPack.interview.items.filter((q) => q.topic === item.topic && q.id !== item.id);
  const next = sameTopic.find((q) => !questionStats.has(q.id)) ?? sameTopic[0];
  const lesson = item.lessonId ? lessonById.get(item.lessonId) : undefined;
  const best = questionStats.get(item.id);

  return (
    <Screen title="Practice" right={back}>
      <QuestionHeader item={item} />
      {best && !result ? (
        <T v="caption" muted>
          Your best so far: {best.best}% over {best.attempts} attempt{best.attempts === 1 ? '' : 's'}.
        </T>
      ) : null}
      {!result ? (
        <AnswerComposer item={item} onSubmit={submit} />
      ) : (
        <View style={{ gap: 12 }}>
          <FeedbackPanel
            item={item}
            score={result.score}
            answer={result.answer}
            rating={rating}
            onRate={rate}
            bookmarked={bookmarks.has(item.id)}
            onBookmark={async () => {
              await setBookmark(db, item.id, !bookmarks.has(item.id));
              refresh();
            }}
          />
          {sync.aiAvailable && typeof result.answer === 'string' ? (
            <AiFeedbackCard
              request={() => sync.call('/v1/ai/interview-feedback', { method: 'POST', body: { itemId: item.id, answer: result.answer } })}
            />
          ) : null}
          {lesson ? (
            <Card onPress={() => router.push(`/lesson/${lesson.id}`)} accessibilityLabel={`Revise ${lesson.title}`}>
              <T v="caption" muted>
                REVISE THE LESSON
              </T>
              <T v="heading">{lesson.title}</T>
            </Card>
          ) : null}
          {next ? <Button label="Next question" onPress={() => router.replace(`/interview/q/${next.id}`)} /> : null}
        </View>
      )}
    </Screen>
  );
}
