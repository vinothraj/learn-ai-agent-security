import { contentPack, roadmapById } from '@laas/content';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Appear, Card, Row, Screen, T, Tag } from '@/components/ui';
import { useStudySession } from '@/state/tracker';
import { useTheme } from '@/theme/ThemeProvider';

const EVIDENCE = { established: 'Established', emerging: 'Emerging', opinion: 'Opinion' } as const;

export default function InterviewBank() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { theme } = useTheme();
  const [open, setOpen] = useState<string | null>(focus ?? null);
  useStudySession('interview', 'question-bank');

  return (
    <Screen
      title="Interview practice"
      subtitle="Answer out loud first, then compare. Scored mock interviews arrive in a later update."
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
          <ChevronLeft size={28} color={theme.text} />
        </Pressable>
      }>
      {contentPack.lessons.map((l, i) => {
        const q = l.interview;
        const isOpen = open === q.id;
        const roadmap = roadmapById.get(l.roadmapId);
        return (
          <Appear key={q.id} index={i}>
            <Card onPress={() => setOpen(isOpen ? null : q.id)} accessibilityLabel={q.question} accent={isOpen}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    <Tag label={roadmap ? `Roadmap ${roadmap.code}` : 'General'} color={theme.info} />
                    <Tag label={EVIDENCE[q.evidence]} color={theme.ringPractice} />
                  </Row>
                  <T v="heading">{q.question}</T>
                </View>
                {isOpen ? <ChevronUp size={20} color={theme.textMuted} /> : <ChevronDown size={20} color={theme.textMuted} />}
              </Row>
              {isOpen ? (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <T>{q.modelAnswer}</T>
                  <T v="label" muted>
                    KEY CONCEPTS
                  </T>
                  <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                    {q.keyConcepts.map((k) => (
                      <Tag key={k} label={k} />
                    ))}
                  </Row>
                  <Pressable accessibilityRole="link" onPress={() => router.push(`/lesson/${l.id}`)}>
                    <T v="label" color={theme.accent}>
                      Study the lesson: {l.title} →
                    </T>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          </Appear>
        );
      })}
    </Screen>
  );
}
