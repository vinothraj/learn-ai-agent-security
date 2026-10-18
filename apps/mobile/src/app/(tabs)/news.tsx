import { contentPack, lessonById } from '@laas/content';
import { pickDaily } from '@laas/shared';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Info, ShieldAlert } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Appear, Card, Row, Screen, T, Tag } from '@/components/ui';
import { useProgress } from '@/state/progress';
import { useStudySession } from '@/state/tracker';
import { useTheme } from '@/theme/ThemeProvider';

export default function Threats() {
  const { theme } = useTheme();
  const { today } = useProgress();
  useStudySession('news', 'threat-briefings');
  const daily = pickDaily(contentPack.threats, today, 'threat');
  const ordered = daily ? [daily, ...contentPack.threats.filter((t) => t.id !== daily.id)] : contentPack.threats;

  return (
    <Screen title="Threat briefings" subtitle="Well-documented AI risk patterns, each with a defense and a source.">
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Info size={18} color={theme.info} style={{ marginTop: 2 }} />
          <T v="caption" muted style={{ flex: 1 }}>
            These are curated, offline briefings, not live news. A verified, source-linked daily news feed (OWASP, CISA,
            NIST, vendor advisories) arrives with the next major update.
          </T>
        </Row>
      </Card>
      {ordered.map((t, i) => {
        const lesson = t.lessonId ? lessonById.get(t.lessonId) : undefined;
        return (
          <Appear key={t.id} index={i}>
            <Card accent={i === 0}>
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                {i === 0 ? <Tag label="TODAY" color={theme.danger} /> : null}
                <Tag label={t.category} color={theme.ringPractice} />
              </Row>
              <Row>
                <ShieldAlert size={20} color={theme.danger} />
                <T v="heading" style={{ flex: 1 }}>
                  {t.title}
                </T>
              </Row>
              <T>{t.summary}</T>
              <View style={{ backgroundColor: theme.success + '18', padding: 12, borderRadius: 12 }}>
                <T v="label" color={theme.success}>
                  DEFENSE
                </T>
                <T>{t.defense}</T>
              </View>
              <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <Pressable
                  accessibilityRole="link"
                  hitSlop={8}
                  onPress={() => WebBrowser.openBrowserAsync(t.reference.url)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ExternalLink size={14} color={theme.textMuted} />
                  <T v="caption" muted>
                    {t.reference.publisher}
                  </T>
                </Pressable>
                {lesson ? (
                  <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push(`/lesson/${lesson.id}`)}>
                    <T v="label" color={theme.accent}>
                      Learn it →
                    </T>
                  </Pressable>
                ) : null}
              </Row>
            </Card>
          </Appear>
        );
      })}
    </Screen>
  );
}
