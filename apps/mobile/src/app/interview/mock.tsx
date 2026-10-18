import { contentPack, lessonById, roleById } from '@laas/content';
import {
  buildMock,
  dayKey,
  MOCK_LENGTHS,
  mockXp,
  scoreAnswer,
  scoreMock,
  type AnswerScore,
  type InterviewItem,
  type Scorecard,
} from '@laas/shared';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ChevronDown, ChevronUp, Clock, Mic, Timer, Trophy, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnswerComposer, coverageLabel, FeedbackPanel, QuestionHeader, topicLabel } from '@/components/interview';
import { Button, Card, Chip, IconBadge, ProgressBar, Row, SectionTitle, T } from '@/components/ui';
import { awardXp, saveInterviewAnswer, saveMockSession } from '@/db/repo';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useStudySession } from '@/state/tracker';
import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

type Phase = 'setup' | 'running' | 'done';
interface Answer {
  raw: string | number | null;
  score: AnswerScore | null;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function MockInterview() {
  const db = useSQLiteContext();
  const { theme, animate } = useTheme();
  const haptic = useHaptics();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const { refresh, skills, completed } = useProgress();
  useStudySession('interview', 'mock');

  const [phase, setPhase] = useState<Phase>('setup');
  const [minutes, setMinutes] = useState<number>(MOCK_LENGTHS[0].minutes);
  const [questions, setQuestions] = useState<InterviewItem[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<{ card: Scorecard; xp: number } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const role = roleById.get(settings.targetRole) ?? contentPack.interview.roles[0]!;
  const timeUp = phase === 'running' && now >= endsAt;

  // Ticking clock while running. State only changes inside the interval callback.
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const start = () => {
    const t = new Date().getTime();
    const len = MOCK_LENGTHS.find((l) => l.minutes === minutes)!;
    const weak = skills.filter((s) => s.score < 50).map((s) => s.id);
    const qs = buildMock(contentPack.interview.items, role, len.questions, weak, `${t}`);
    setQuestions(qs);
    setAnswers(qs.map(() => ({ raw: null, score: null })));
    setIndex(0);
    setStartedAt(t);
    setNow(t);
    setEndsAt(t + minutes * 60_000);
    setPhase('running');
    haptic('tap');
  };

  const answer = (raw: string | number | null) => {
    const item = questions[index]!;
    // null = skipped; scoreAnswer marks it "Skipped" for both open and multiple-choice items.
    const score = scoreAnswer(item, raw);
    setAnswers((a) => a.map((x, i) => (i === index ? { raw, score } : x)));
    if (index < questions.length - 1) setIndex(index + 1);
    else finish(answers.map((x, i) => (i === index ? { raw, score } : x)));
  };

  const finish = async (final: Answer[] = answers) => {
    const results = questions.map((item, i) => ({ item, score: final[i]?.score ?? null }));
    const card = scoreMock(results);
    const day = dayKey(new Date());
    const sessionId = `${startedAt}-mock`;
    for (const [i, r] of results.entries()) {
      const raw = final[i]?.raw;
      if (!r.score || raw === null || raw === undefined) continue;
      await saveInterviewAnswer(db, {
        questionId: r.item.id,
        lessonId: r.item.lessonId ?? null,
        topic: r.item.topic,
        mode: 'mock',
        sessionId,
        answer: typeof raw === 'number' ? r.item.mcq!.options[raw]! : raw,
        coverage: r.score.coverage,
        day,
      });
    }
    await saveMockSession(db, {
      id: sessionId,
      roleId: role.id,
      minutes,
      questions: card.total,
      answered: card.answered,
      score: card.overall,
      byTopic: card.byTopic,
      day,
      startedAt,
    });
    const xp = await awardXp(db, day, mockXp(card), 'mock', sessionId);
    await refresh();
    haptic('success');
    setResult({ card, xp });
    setPhase('done');
  };

  const header = (
    <Row style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close mock interview" hitSlop={12} onPress={() => router.back()}>
        <X size={26} color={theme.text} />
      </Pressable>
      {phase === 'running' ? (
        <>
          <View style={{ flex: 1 }}>
            <ProgressBar value={(index + 1) / questions.length} color={theme.info} />
          </View>
          <Row style={{ gap: 4 }} accessibilityLabel={`Time left ${fmt(endsAt - now)}`}>
            <Timer size={16} color={endsAt - now < 120_000 ? theme.danger : theme.textMuted} />
            <T v="label" color={endsAt - now < 120_000 ? theme.danger : theme.text}>
              {fmt(endsAt - now)}
            </T>
          </Row>
        </>
      ) : (
        <T v="heading" style={{ flex: 1 }}>
          Mock interview
        </T>
      )}
    </Row>
  );

  const body = (() => {
    if (phase === 'setup') {
      return (
        <View style={{ gap: space.lg }}>
          <IconBadge icon={Mic} size={56} color={theme.info} />
          <T v="display">Mock interview</T>
          <T muted>
            A timed set of questions for your target role, weighted toward your weaker topics. No hints during the interview;
            you get a scorecard and model answers at the end.
          </T>
          <SectionTitle>Target role</SectionTitle>
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {contentPack.interview.roles.map((r) => (
              <Chip key={r.id} label={r.title} selected={r.id === role.id} onPress={() => update({ targetRole: r.id })} />
            ))}
          </Row>
          <T v="caption" muted>
            {role.summary}
          </T>
          <SectionTitle>Length</SectionTitle>
          <Row style={{ gap: 8 }}>
            {MOCK_LENGTHS.map((l) => (
              <Chip key={l.minutes} label={`${l.minutes} min · ${l.questions} Qs`} selected={minutes === l.minutes} onPress={() => setMinutes(l.minutes)} />
            ))}
          </Row>
          <Card>
            <T v="caption" muted>
              This is practice for preparation. Please don’t use it during a real interview.
            </T>
          </Card>
        </View>
      );
    }

    if (phase === 'running') {
      const item = questions[index]!;
      if (timeUp) {
        return (
          <Animated.View entering={animate ? FadeIn : undefined} style={{ alignItems: 'center', gap: space.lg, paddingTop: space.xxl }}>
            <IconBadge icon={Clock} size={72} color={theme.warning} />
            <T v="title">Time’s up</T>
            <T muted style={{ textAlign: 'center' }}>
              Unanswered questions count as 0, just like running out of time in a real interview.
            </T>
          </Animated.View>
        );
      }
      return (
        <Animated.View key={index} entering={animate ? FadeIn.duration(250) : undefined} style={{ gap: space.lg }}>
          <T v="label" color={theme.info}>
            QUESTION {index + 1} OF {questions.length}
          </T>
          <QuestionHeader item={item} />
          <AnswerComposer
            key={item.id}
            item={item}
            onSubmit={answer}
            submitLabel={index === questions.length - 1 ? 'Submit & finish' : 'Submit & next'}
            secondary={{ label: 'Skip', onPress: () => answer(null) }}
          />
        </Animated.View>
      );
    }

    if (!result) return null;
    const { card, xp } = result;
    const weakLessons = card.weakTopics
      .flatMap((t) => contentPack.skills.find((s) => s.id === t)?.lessonIds ?? [])
      .map((id) => lessonById.get(id))
      .filter((l) => l !== undefined);
    const color = card.overall >= 80 ? theme.success : card.overall >= 60 ? theme.accent : card.overall >= 40 ? theme.warning : theme.danger;
    return (
      <View style={{ gap: space.lg }}>
        <Animated.View entering={animate ? ZoomIn.springify().damping(12) : undefined} style={{ alignItems: 'center', gap: space.sm }}>
          <IconBadge icon={Trophy} size={80} color={color} />
          <T v="display" color={color}>
            {card.overall}%
          </T>
          <T v="heading">{coverageLabel(card.overall)}</T>
          <T muted>
            {card.answered}/{card.total} answered · {Math.round((Math.min(now, endsAt) - startedAt) / 60000)} of {minutes} min used
          </T>
          {settings.gamification && xp > 0 ? (
            <T v="heading" color={theme.warning}>
              +{xp} XP
            </T>
          ) : null}
        </Animated.View>
        <Card>
          <T v="label" muted>
            BY TOPIC
          </T>
          {card.byTopic.map((t) => (
            <View key={t.topic} style={{ gap: 4, paddingVertical: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="label">{topicLabel(t.topic)}</T>
                <T v="caption" muted>
                  {t.score}% · {t.count} Q
                </T>
              </Row>
              <ProgressBar value={t.score / 100} color={t.score >= 60 ? theme.success : theme.warning} />
            </View>
          ))}
        </Card>
        {weakLessons.length > 0 ? (
          <Card>
            <T v="label" color={theme.warning}>
              REVISE BEFORE YOUR NEXT MOCK
            </T>
            {weakLessons.slice(0, 4).map((l) => (
              <Pressable key={l.id} accessibilityRole="link" onPress={() => router.push(`/lesson/${l.id}`)} style={{ paddingVertical: 4 }}>
                <T v="label" color={theme.accent}>
                  {completed.has(l.id) ? 'Revise' : 'Study'}: {l.title} →
                </T>
              </Pressable>
            ))}
          </Card>
        ) : null}
        <SectionTitle>Review answers</SectionTitle>
        {questions.map((q, i) => {
          const a = answers[i];
          const isOpen = open === i;
          return (
            <Card key={q.id} onPress={() => setOpen(isOpen ? null : i)} accessibilityLabel={`Question ${i + 1}: ${q.question}`}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="caption" muted>
                    Q{i + 1} · {topicLabel(q.topic)} · {a?.score ? `${a.score.coverage}%` : 'not reached'}
                  </T>
                  <T v="label">{q.question}</T>
                </View>
                {isOpen ? <ChevronUp size={18} color={theme.textMuted} /> : <ChevronDown size={18} color={theme.textMuted} />}
              </Row>
              {isOpen ? <FeedbackPanel item={q} score={a?.score ?? scoreAnswer(q, '')} answer={a?.raw ?? null} /> : null}
            </Card>
          );
        })}
      </View>
    );
  })();

  const footer = (() => {
    if (phase === 'setup') return <Button icon={Mic} label={`Start ${minutes}-minute interview`} onPress={start} style={{ flex: 1 }} />;
    if (phase === 'running' && timeUp) return <Button label="See my scorecard" onPress={() => finish()} style={{ flex: 1 }} />;
    if (phase === 'done')
      return (
        <>
          <Button kind="secondary" label="New mock" onPress={() => setPhase('setup')} style={{ flex: 1 }} />
          <Button label="Done" onPress={() => router.back()} style={{ flex: 1 }} />
        </>
      );
    return null;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + space.sm }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
      {footer ? (
        <Row style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg, borderTopWidth: 1, borderTopColor: theme.border }}>{footer}</Row>
      ) : null}
    </View>
  );
}
