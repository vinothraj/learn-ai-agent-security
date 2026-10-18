import { contentPack, flashcardsByLesson, lessonById } from '@laas/content';
import { dayKey, quizXp, scoreQuiz, XP_RULES, type EvidenceLevel } from '@laas/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  CircleCheck,
  ExternalLink,
  Lightbulb,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trophy,
  X,
} from '@/components/icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInRight, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuizQuestionView } from '@/components/QuizQuestionView';
import { Button, Card, IconBadge, ProgressBar, Row, T, Tag } from '@/components/ui';
import { awardXp, completeLesson, recordResponse, saveLessonStep } from '@/db/repo';
import { lessonSteps, QUIZ_START } from '@/lib/lesson';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useStudySession } from '@/state/tracker';
import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { openExternal } from '@/lib/links';

const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  established: 'Established practice',
  emerging: 'Emerging technique',
  opinion: 'Opinion',
};

export default function LessonPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = lessonById.get(id);
  const db = useSQLiteContext();
  const { theme, animate } = useTheme();
  const haptic = useHaptics();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { statuses, refresh, next } = useProgress();
  useStudySession('lesson', id);

  const saved = statuses.get(id);
  const [step, setStep] = useState(() =>
    saved?.status === 'in_progress' ? Math.min(saved.step, QUIZ_START) : 0,
  );
  const [answers, setAnswers] = useState<(number | null)[]>(() => lesson?.quiz.map(() => null) ?? []);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number; xp: number; first: boolean } | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const steps = lesson ? lessonSteps(lesson) : [];
  const current = steps[step];

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (lesson && current?.kind !== 'done') saveLessonStep(db, lesson.id, step);
  }, [step, lesson, db, current?.kind]);

  if (!lesson || !current) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: space.xl, paddingTop: insets.top + space.xl }}>
        <T v="title">Lesson not found</T>
        <Button label="Go back" onPress={() => router.back()} />
      </View>
    );
  }

  const answer = (qIndex: number, choice: number) => {
    const q = lesson.quiz[qIndex]!;
    setAnswers((a) => a.map((v, i) => (i === qIndex ? choice : v)));
    recordResponse(db, {
      questionId: q.id,
      lessonId: lesson.id,
      source: 'lesson',
      correct: choice === q.correctIndex,
      day: dayKey(new Date()),
    }).then(refresh);
  };

  const finish = async () => {
    const day = dayKey(new Date());
    const score = scoreQuiz(lesson.quiz, answers);
    const first = await completeLesson(db, lesson.id, score.percent, day);
    let xp = 0;
    if (first) {
      xp = XP_RULES.lessonComplete + quizXp(score.correct, score.total);
      await awardXp(db, day, XP_RULES.lessonComplete, 'lesson_complete', lesson.id);
      await awardXp(db, day, quizXp(score.correct, score.total), 'lesson_quiz', lesson.id);
    }
    await refresh();
    haptic('success');
    setResult({ correct: score.correct, total: score.total, xp, first });
    setStep(steps.length - 1);
  };

  const canAdvance = current.kind !== 'quiz' || answers[current.index] !== null;
  const isInterview = current.kind === 'interview';

  const body = (() => {
    switch (current.kind) {
      case 'objective':
        return (
          <View style={{ gap: space.lg }}>
            <IconBadge icon={Target} size={52} />
            <Row style={{ flexWrap: 'wrap', gap: 8 }}>
              <Tag label={lesson.level.toUpperCase()} />
              <Tag label={`${lesson.minutes} MIN`} color={theme.info} />
              <Tag label={EVIDENCE_LABEL[lesson.evidence]} color={theme.ringPractice} />
            </Row>
            <T v="display">{lesson.title}</T>
            <T v="label" muted>
              LEARNING OBJECTIVE
            </T>
            <T style={{ fontSize: 17, lineHeight: 26 }}>{lesson.objective}</T>
            {lesson.status === 'needs_review' ? (
              <T v="caption" muted>
                Draft content: pending expert review.
              </T>
            ) : null}
          </View>
        );
      case 'concept':
        return (
          <View style={{ gap: space.lg }}>
            <IconBadge icon={Lightbulb} size={52} color={theme.warning} />
            <T v="title">The concept</T>
            {lesson.explanation.map((p, i) => (
              <T key={i} style={{ fontSize: 16, lineHeight: 25 }}>
                {p}
              </T>
            ))}
          </View>
        );
      case 'example':
        return (
          <View style={{ gap: space.lg }}>
            <IconBadge icon={MessageSquareText} size={52} color={theme.info} />
            <T v="title">Realistic example</T>
            <Card>
              <T v="label" color={theme.info}>
                {lesson.example.title.toUpperCase()}
              </T>
              <T style={{ fontSize: 16, lineHeight: 25 }}>{lesson.example.body}</T>
            </Card>
            <T v="caption" muted>
              All systems in examples and labs are fictional.
            </T>
          </View>
        );
      case 'defend':
        return (
          <View style={{ gap: space.lg }}>
            <IconBadge icon={ShieldAlert} size={52} color={theme.danger} />
            <T v="title">The risk</T>
            <T style={{ fontSize: 16, lineHeight: 25 }}>{lesson.risk}</T>
            <Row style={{ marginTop: space.sm }}>
              <ShieldCheck size={22} color={theme.success} />
              <T v="title">Defensive controls</T>
            </Row>
            {lesson.controls.map((c, i) => (
              <Row key={i} style={{ alignItems: 'flex-start' }}>
                <CircleCheck size={18} color={theme.success} style={{ marginTop: 3 }} />
                <T style={{ flex: 1 }}>{c}</T>
              </Row>
            ))}
          </View>
        );
      case 'quiz':
        return (
          <View style={{ gap: space.md }}>
            <T v="label" color={theme.ringPractice}>
              KNOWLEDGE CHECK {current.index + 1} OF {lesson.quiz.length}
            </T>
            <QuizQuestionView
              question={lesson.quiz[current.index]!}
              answer={answers[current.index] ?? null}
              onAnswer={(c) => answer(current.index, c)}
            />
          </View>
        );
      case 'interview':
        return (
          <View style={{ gap: space.lg }}>
            <IconBadge icon={MessageSquareText} size={52} color={theme.info} />
            <T v="label" color={theme.info}>
              INTERVIEW PRACTICE
            </T>
            <T v="title">{lesson.interview.question}</T>
            {!revealed ? (
              <>
                <T muted>Say your answer out loud or think it through, then compare with a model answer.</T>
                <Button kind="secondary" label="Reveal model answer" onPress={() => setRevealed(true)} />
              </>
            ) : (
              <Card>
                <Tag label={EVIDENCE_LABEL[lesson.interview.evidence]} color={theme.ringPractice} />
                <T style={{ fontSize: 16, lineHeight: 25 }}>{lesson.interview.modelAnswer}</T>
                <T v="label" muted style={{ marginTop: space.sm }}>
                  A STRONG ANSWER MENTIONS
                </T>
                <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                  {lesson.interview.keyConcepts.map((k) => (
                    <Tag key={k} label={k} />
                  ))}
                </Row>
              </Card>
            )}
          </View>
        );
      case 'done':
        return (
          <View style={{ gap: space.lg, alignItems: 'stretch' }}>
            <Animated.View entering={animate ? ZoomIn.springify().damping(12) : undefined} style={{ alignItems: 'center' }}>
              <IconBadge icon={Trophy} size={88} color={theme.warning} />
            </Animated.View>
            <T v="display" style={{ textAlign: 'center' }}>
              Lesson complete
            </T>
            {result ? (
              <Row style={{ justifyContent: 'center', gap: space.xl }}>
                <View style={{ alignItems: 'center' }}>
                  <T v="display" color={theme.accent}>
                    {result.correct}/{result.total}
                  </T>
                  <T v="caption" muted>
                    QUIZ SCORE
                  </T>
                </View>
                {settings.gamification ? (
                  <View style={{ alignItems: 'center' }}>
                    <T v="display" color={theme.warning}>
                      +{result.xp}
                    </T>
                    <T v="caption" muted>
                      {result.first ? 'XP EARNED' : 'XP (REPLAY)'}
                    </T>
                  </View>
                ) : null}
              </Row>
            ) : null}
            {result?.first && (flashcardsByLesson.get(lesson.id)?.length ?? 0) > 0 ? (
              <Card onPress={() => router.replace('/review')} accessibilityLabel="Review new flashcards">
                <T v="heading" color={theme.ringLessons}>
                  {flashcardsByLesson.get(lesson.id)!.length} flashcards added to your deck
                </T>
                <T v="caption" muted>
                  Review them now and spaced repetition will bring them back right before you forget.
                </T>
              </Card>
            ) : null}
            {contentPack.labs
              .filter((l) => l.lessonId === lesson.id)
              .map((l) => (
                <Card key={l.id} onPress={() => router.replace(`/lab/${l.id}`)} accessibilityLabel={`Practice in lab ${l.title}`}>
                  <T v="caption" color={theme.success}>
                    PRACTICE IT IN A LAB · {l.minutes} MIN
                  </T>
                  <T v="heading">{l.title}</T>
                  <T v="caption" muted>
                    {l.summary}
                  </T>
                </Card>
              ))}
            <T v="label" muted>
              REFERENCES & FURTHER READING
            </T>
            {lesson.references.map((r) => (
              <Pressable
                key={r.url}
                accessibilityRole="link"
                onPress={() => openExternal(r.url)}
                style={{
                  flexDirection: 'row',
                  gap: space.md,
                  alignItems: 'center',
                  padding: space.md,
                  borderRadius: radius.md,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}>
                <ExternalLink size={18} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <T v="label">{r.title}</T>
                  <T v="caption" muted>
                    {r.publisher}
                  </T>
                </View>
              </Pressable>
            ))}
          </View>
        );
    }
  })();

  const nextLessonAfter = next && next.id !== lesson.id ? next : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + space.sm }}>
      <Row style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close lesson" hitSlop={12} onPress={() => router.back()}>
          <X size={26} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar value={(step + 1) / steps.length} height={8} />
        </View>
        <T v="caption" muted>
          {step + 1}/{steps.length}
        </T>
      </Row>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Animated.View key={step} entering={animate ? FadeInRight.duration(280) : undefined}>
          {body}
        </Animated.View>
      </ScrollView>

      <Row style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg, borderTopWidth: 1, borderTopColor: theme.border }}>
        {current.kind === 'done' ? (
          <>
            <Button kind="secondary" label="Home" onPress={() => router.replace('/')} style={{ flex: 1 }} />
            {nextLessonAfter ? (
              <Button label="Next lesson" onPress={() => router.replace(`/lesson/${nextLessonAfter.id}`)} style={{ flex: 2 }} />
            ) : null}
          </>
        ) : (
          <>
            {step > 0 && current.kind !== 'quiz' ? (
              <Button kind="secondary" label="Back" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />
            ) : null}
            <Button
              label={isInterview ? 'Finish lesson' : 'Continue'}
              disabled={!canAdvance}
              onPress={isInterview ? finish : () => setStep(step + 1)}
              style={{ flex: 2 }}
            />
          </>
        )}
      </Row>
    </View>
  );
}
