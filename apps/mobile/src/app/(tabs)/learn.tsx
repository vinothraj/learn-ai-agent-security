import { contentPack } from '@laas/content';
import { roadmapProgress } from '@laas/shared';
import { router } from 'expo-router';
import { ChevronRight, MessageCircleQuestion } from 'lucide-react-native';
import { View } from 'react-native';

import { Appear, Card, ProgressBar, Row, Screen, T, Tag } from '@/components/ui';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

export default function Learn() {
  const { theme } = useTheme();
  const { completed } = useProgress();
  const { settings } = useSettings();

  return (
    <Screen title="Learn" subtitle="Security roadmaps first; supporting AI topics when you need them.">
      <Card onPress={() => router.push('/tutor')} accessibilityLabel="Ask the tutor">
        <Row>
          <MessageCircleQuestion size={24} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <T v="heading">Ask the tutor</T>
            <T v="caption" muted>
              Questions answered from these lessons, with links.
            </T>
          </View>
          <ChevronRight size={20} color={theme.textMuted} />
        </Row>
      </Card>
      {contentPack.roadmaps.map((r, i) => {
        const p = roadmapProgress(r, completed);
        const empty = r.lessonIds.length === 0;
        return (
          <Appear key={r.id} index={i}>
            <Card
              accent={r.id === settings.focusRoadmapId}
              onPress={() => router.push(`/roadmap/${r.id}`)}
              accessibilityLabel={`${r.title}, ${p.done} of ${p.total} lessons complete`}>
              <Row>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: theme.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <T v="title" color={theme.accent}>
                    {r.code}
                  </T>
                </View>
                <View style={{ flex: 1 }}>
                  <T v="heading">{r.title}</T>
                  <T v="caption" muted>
                    {r.tagline}
                  </T>
                </View>
                <ChevronRight size={20} color={theme.textMuted} />
              </Row>
              {empty ? (
                <Tag label="Coming in the next content pack" color={theme.textMuted} />
              ) : (
                <>
                  <ProgressBar value={p.ratio} />
                  <T v="caption" muted>
                    {p.done} of {p.total} lessons complete
                    {r.kind === 'supporting' ? ' · supporting knowledge' : ''}
                  </T>
                </>
              )}
            </Card>
          </Appear>
        );
      })}
    </Screen>
  );
}
