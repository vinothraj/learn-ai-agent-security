import { contentPack } from '@laas/content';
import { buildLessonIndex, guardQuestion, lessonAnswer, refusal, type LessonIndex, type TutorResponse } from '@laas/shared';
import { router } from 'expo-router';
import { BookOpen, ChevronLeft, Send, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Card, Chip, Row, Screen, T, Tag } from '@/components/ui';
import { useSync } from '@/state/sync';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius, space } from '@/theme/tokens';

const SUGGESTIONS = ['What is indirect prompt injection?', 'How do I limit what an agent can do?', 'What is MCP tool poisoning?', 'How should I report an AI vulnerability?'];

// Built on first use: contentPack may be replaced by an over-the-air pack at startup.
let index: LessonIndex | null = null;
const lessonIndex = () => (index ??= buildLessonIndex(contentPack.lessons));

interface Turn {
  question: string;
  response: TutorResponse;
}

/** Answers from the app's own lessons (offline). With server AI, a model phrases a grounded answer. */
export default function Tutor() {
  const { theme } = useTheme();
  const sync = useSync();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion('');
    // Refusals and off-topic checks run locally first; nothing is sent for them.
    const g = guardQuestion(lessonIndex(), text);
    let response: TutorResponse = g.ok ? lessonAnswer(g.hits) : refusal(g.reason, g.hits);
    if (g.ok && sync.aiAvailable) {
      setBusy(true);
      try {
        response = await sync.call<TutorResponse>('/v1/ai/tutor', { method: 'POST', body: { question: text } });
      } catch {
        // Offline or server error: keep the lesson-based answer.
      } finally {
        setBusy(false);
      }
    }
    setTurns((t) => [{ question: text, response }, ...t].slice(0, 20));
  };

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
      <ChevronLeft size={28} color={theme.text} />
    </Pressable>
  );

  return (
    <Screen title="Ask the tutor" subtitle="Answers come from the lessons in this app, with links to read more." right={back}>
      <Card>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask about AI, LLM or agent security…"
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={500}
          accessibilityLabel="Your question"
          onSubmitEditing={() => ask(question)}
          style={[font.body, { minHeight: 64, color: theme.text, borderColor: theme.border, borderWidth: 1, borderRadius: radius.md, padding: space.md, textAlignVertical: 'top' }]}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="caption" muted>
            {sync.aiAvailable ? 'AI answers are grounded in lessons and may still contain mistakes.' : 'Works offline from your lessons.'}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask"
            disabled={!question.trim() || busy}
            onPress={() => ask(question)}
            style={{ padding: 10, borderRadius: 999, backgroundColor: question.trim() ? theme.accent : theme.surfaceAlt }}>
            {busy ? <ActivityIndicator color={theme.onAccent} /> : <Send size={20} color={question.trim() ? theme.onAccent : theme.textMuted} />}
          </Pressable>
        </Row>
      </Card>

      {turns.length === 0 ? (
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTIONS.map((s) => (
            <Chip key={s} label={s} onPress={() => ask(s)} />
          ))}
        </Row>
      ) : null}

      {turns.map((turn, i) => (
        <Animated.View key={turns.length - i} entering={FadeInDown.duration(250)}>
          <Card>
            <T v="caption" muted>
              You asked
            </T>
            <T v="heading">{turn.question}</T>
            <Row>
              {turn.response.origin === 'ai' ? (
                <Tag label="AI-generated answer" color={theme.warning} />
              ) : (
                <Tag label={turn.response.refused ? 'Tutor' : 'From your lessons'} color={theme.accent} />
              )}
            </Row>
            <Row style={{ alignItems: 'flex-start' }}>
              {turn.response.origin === 'ai' ? <Sparkles size={18} color={theme.warning} /> : <BookOpen size={18} color={theme.accent} />}
              <T style={{ flex: 1 }}>{turn.response.answer}</T>
            </Row>
            {turn.response.citations.length ? (
              <View style={{ gap: 6 }}>
                <T v="caption" muted>
                  {turn.response.refused ? 'Related lessons' : 'Sources'}
                </T>
                {turn.response.citations.map((c) => (
                  <Pressable key={c.lessonId} accessibilityRole="link" onPress={() => router.push(`/lesson/${c.lessonId}`)}>
                    <T color={theme.accent}>→ {c.title}</T>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Card>
        </Animated.View>
      ))}
    </Screen>
  );
}
