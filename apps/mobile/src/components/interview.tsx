import { contentPack } from '@laas/content';
import { SELF_RATINGS, tokens, type AnswerScore, type InterviewItem } from '@laas/shared';
import { Bookmark, BookmarkCheck, CircleCheck, CircleX, Lightbulb, MessageCircleQuestion, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { font, radius, space } from '@/theme/tokens';
import { QuizQuestionView } from './QuizQuestionView';
import { Button, Card, Chip, ProgressBar, Row, T, Tag } from './ui';

const TYPE_LABEL: Record<InterviewItem['type'], string> = {
  concept: 'Concept',
  scenario: 'Scenario',
  troubleshooting: 'Troubleshooting',
  mcq: 'Multiple choice',
};
const EVIDENCE_LABEL = { established: 'Established practice', emerging: 'Emerging technique', opinion: 'Opinion' } as const;

export const topicLabel = (topic: string) => contentPack.skills.find((s) => s.id === topic)?.label ?? topic;

export function coverageLabel(c: number) {
  return c >= 80 ? 'Strong coverage' : c >= 60 ? 'Solid' : c >= 40 ? 'Partial' : 'Needs work';
}

export function QuestionHeader({ item }: { item: InterviewItem }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Tag label={TYPE_LABEL[item.type].toUpperCase()} color={theme.info} />
        <Tag label={topicLabel(item.topic)} color={theme.ringPractice} />
        <Tag label={item.level} color={theme.textMuted} />
      </Row>
      <T v="title">{item.question}</T>
    </View>
  );
}

/** Free-text answer box with a live word count, or the multiple-choice options. */
export function AnswerComposer({
  item,
  onSubmit,
  submitLabel = 'Submit answer',
  secondary,
}: {
  item: InterviewItem;
  onSubmit: (answer: string | number) => void;
  submitLabel?: string;
  secondary?: { label: string; onPress: () => void };
}) {
  const { theme } = useTheme();
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const words = tokens(text).length;

  if (item.type === 'mcq') {
    return (
      <View style={{ gap: space.md }}>
        <QuizQuestionView
          question={{ id: item.id, prompt: 'Choose the best answer', options: item.mcq!.options, correctIndex: item.mcq!.correctIndex, explanation: item.reasoning }}
          answer={choice}
          onAnswer={(i) => setChoice(i)}
        />
        <Row>
          {secondary ? <Button kind="secondary" label={secondary.label} onPress={secondary.onPress} style={{ flex: 1 }} /> : null}
          <Button label={submitLabel} disabled={choice === null} onPress={() => onSubmit(choice!)} style={{ flex: 2 }} />
        </Row>
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <T v="caption" muted>
        Structure helps: context → risks → controls → how you would verify. Aim for 60–150 words.
      </T>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Type your answer as you would say it…"
        placeholderTextColor={theme.textMuted}
        textAlignVertical="top"
        autoCorrect
        accessibilityLabel="Your answer"
        style={[
          font.body,
          {
            minHeight: 180,
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: space.md,
          },
        ]}
      />
      <T v="caption" color={words >= 60 ? theme.success : theme.textMuted} style={{ textAlign: 'right' }}>
        {words} words
      </T>
      <Row>
        {secondary ? <Button kind="secondary" label={secondary.label} onPress={secondary.onPress} style={{ flex: 1 }} /> : null}
        <Button label={submitLabel} disabled={words < 3} onPress={() => onSubmit(text)} style={{ flex: 2 }} />
      </Row>
    </View>
  );
}

/** Transparent, deterministic feedback: what was covered, what was missed, and the model answer. */
export function FeedbackPanel({
  item,
  score,
  answer,
  rating,
  onRate,
  bookmarked,
  onBookmark,
}: {
  item: InterviewItem;
  score: AnswerScore;
  answer?: string | number | null;
  rating?: number | null;
  onRate?: (r: number) => void;
  bookmarked?: boolean;
  onBookmark?: () => void;
}) {
  const { theme, animate } = useTheme();
  const haptic = useHaptics();
  const color = score.coverage >= 80 ? theme.success : score.coverage >= 60 ? theme.accent : score.coverage >= 40 ? theme.warning : theme.danger;
  const isMcq = item.type === 'mcq';

  return (
    <Animated.View entering={animate ? FadeInDown.duration(300) : undefined} style={{ gap: space.md }}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <T v="caption" muted>
              {isMcq ? 'RESULT' : 'KEY-CONCEPT COVERAGE'}
            </T>
            <T v="display" color={color}>
              {isMcq ? (score.coverage === 100 ? 'Correct' : 'Incorrect') : `${score.coverage}%`}
            </T>
          </View>
          {!isMcq ? <Tag label={coverageLabel(score.coverage)} color={color} /> : null}
        </Row>
        {!isMcq ? <ProgressBar value={score.coverage / 100} color={color} /> : null}
        {score.notes.map((n) => (
          <T key={n} v="caption" color={theme.warning}>
            {n}
          </T>
        ))}
        {!isMcq ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            {score.covered.map((c) => (
              <Row key={c} style={{ alignItems: 'flex-start', gap: 8 }}>
                <CircleCheck size={16} color={theme.success} style={{ marginTop: 3 }} />
                <T style={{ flex: 1 }}>{c}</T>
              </Row>
            ))}
            {score.missed.map((c) => (
              <Row key={c} style={{ alignItems: 'flex-start', gap: 8 }}>
                <CircleX size={16} color={theme.danger} style={{ marginTop: 3 }} />
                <T style={{ flex: 1 }} muted>
                  {c}
                </T>
              </Row>
            ))}
            <T v="caption" muted>
              Automatic keyword coverage is a rough signal, not a grade. Compare your answer with the model answer below.
            </T>
          </View>
        ) : null}
      </Card>

      {typeof answer === 'string' && answer.trim() ? (
        <Card>
          <T v="label" muted>
            YOUR ANSWER
          </T>
          <T>{answer}</T>
        </Card>
      ) : null}

      <Card accent>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="label" color={theme.accent}>
            MODEL ANSWER
          </T>
          <Tag label={EVIDENCE_LABEL[item.evidence]} color={theme.ringPractice} />
        </Row>
        <T style={{ fontSize: 16, lineHeight: 25 }}>{item.modelAnswer}</T>
      </Card>

      <Card>
        <Row style={{ gap: 8 }}>
          <Lightbulb size={16} color={theme.warning} />
          <T v="label">Why interviewers ask this</T>
        </Row>
        <T>{item.reasoning}</T>
        {item.followUps.length ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            <Row style={{ gap: 8 }}>
              <MessageCircleQuestion size={16} color={theme.info} />
              <T v="label">Likely follow-ups</T>
            </Row>
            {item.followUps.map((f) => (
              <T key={f}>• {f}</T>
            ))}
          </View>
        ) : null}
      </Card>

      {onRate ? (
        <Card>
          <T v="label">How did you do, compared with the model answer?</T>
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {SELF_RATINGS.map((r) => (
              <Chip key={r.value} label={r.label} selected={rating === r.value} onPress={() => onRate(r.value)} />
            ))}
          </Row>
        </Card>
      ) : null}

      {onBookmark ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: bookmarked }}
          onPress={() => {
            haptic('select');
            onBookmark();
          }}
          style={{ flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start', padding: 4 }}>
          {bookmarked ? <BookmarkCheck size={18} color={theme.warning} /> : <Bookmark size={18} color={theme.textMuted} />}
          <T v="label" color={bookmarked ? theme.warning : theme.textMuted}>
            {bookmarked ? 'Saved for revision' : 'Save for revision'}
          </T>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}


interface AiFeedback {
  score: number;
  strengths: string[];
  gaps: string[];
  feedback: string;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Optional second opinion from the server's AI, only on request: the answer is sent once,
 * is not stored or cached by the server, and the result is labelled as AI-generated.
 */
export function AiFeedbackCard({ request }: { request: () => Promise<{ ai: AiFeedback | null; fallbackReason?: string }> }) {
  const { theme } = useTheme();
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'error'; message?: string } | { status: 'done'; value: AiFeedback }>({ status: 'idle' });

  const run = async () => {
    setState({ status: 'loading' });
    try {
      const r = await request();
      if (r.ai) setState({ status: 'done', value: r.ai });
      else setState({ status: 'error', message: r.fallbackReason === 'user_limit' ? 'Daily AI limit reached. Try again tomorrow.' : 'AI feedback is unavailable right now.' });
    } catch {
      setState({ status: 'error', message: 'Could not reach the server.' });
    }
  };

  if (state.status !== 'done') {
    return (
      <Card>
        <Row>
          <Sparkles size={18} color={theme.warning} />
          <T v="heading" style={{ flex: 1 }}>
            Want an AI second opinion?
          </T>
        </Row>
        <T v="caption" muted>
          Your answer is sent to our server and its AI provider for this one review. It is not stored.
        </T>
        {state.status === 'error' ? <T color={theme.danger}>{state.message}</T> : null}
        <Button kind="secondary" label={state.status === 'loading' ? 'Reviewing…' : 'Get AI feedback'} disabled={state.status === 'loading'} onPress={run} />
      </Card>
    );
  }
  const v = state.value;
  return (
    <Animated.View entering={FadeInDown.duration(250)}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Tag label="AI-generated feedback" color={theme.warning} />
          <T v="caption" muted>
            Confidence: {v.confidence}
          </T>
        </Row>
        <T v="title">{v.score}/100</T>
        <T>{v.feedback}</T>
        {v.strengths.length ? (
          <View style={{ gap: 4 }}>
            <T v="caption" muted>
              STRENGTHS
            </T>
            {v.strengths.map((s) => (
              <T key={s}>• {s}</T>
            ))}
          </View>
        ) : null}
        {v.gaps.length ? (
          <View style={{ gap: 4 }}>
            <T v="caption" muted>
              TO IMPROVE
            </T>
            {v.gaps.map((s) => (
              <T key={s}>• {s}</T>
            ))}
          </View>
        ) : null}
        <T v="caption" muted>
          AI feedback can be wrong. The rubric above is the deterministic score.
        </T>
      </Card>
    </Animated.View>
  );
}
