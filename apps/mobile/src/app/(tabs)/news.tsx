import { contentPack, lessonById } from '@laas/content';
import { pickDaily } from '@laas/shared';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Info, RefreshCw, ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { NewsCard } from '@/components/NewsCard';
import { Appear, Card, Chip, Row, Screen, T, Tag } from '@/components/ui';
import { relativeDate, useNews } from '@/state/news';
import { useProgress } from '@/state/progress';
import { useStudySession } from '@/state/tracker';
import { useTheme } from '@/theme/ThemeProvider';

function Briefings() {
  const { theme } = useTheme();
  const { today } = useProgress();
  const daily = pickDaily(contentPack.threats, today, 'threat');
  const ordered = daily ? [daily, ...contentPack.threats.filter((t) => t.id !== daily.id)] : contentPack.threats;
  return (
    <>
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
                <Pressable accessibilityRole="link" hitSlop={8} onPress={() => WebBrowser.openBrowserAsync(t.reference.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
    </>
  );
}

export default function NewsTab() {
  const { theme } = useTheme();
  const news = useNews();
  const [tab, setTab] = useState<'latest' | 'briefings'>(news.available ? 'latest' : 'briefings');
  useStudySession('news', tab);

  return (
    <Screen title="Security news" subtitle="Verified sources, clearly separated from our interpretation.">
      {news.available ? (
        <Row style={{ gap: 8 }}>
          <Chip label="Latest news" selected={tab === 'latest'} onPress={() => setTab('latest')} />
          <Chip label="Threat briefings" selected={tab === 'briefings'} onPress={() => setTab('briefings')} />
        </Row>
      ) : (
        <Card>
          <Row style={{ alignItems: 'flex-start' }}>
            <Info size={18} color={theme.info} style={{ marginTop: 2 }} />
            <T v="caption" muted style={{ flex: 1 }}>
              Live news needs the cloud-enabled build. Meanwhile, here are curated offline briefings.
            </T>
          </Row>
        </Card>
      )}

      {tab === 'latest' && news.available ? (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="caption" muted>
              {news.loading ? 'Updating…' : news.fetchedAt ? `Updated ${relativeDate(new Date(news.fetchedAt).toISOString()).toLowerCase()}` : ''}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel="Refresh news" hitSlop={10} onPress={news.refresh} disabled={news.loading}>
              <RefreshCw size={18} color={theme.accent} />
            </Pressable>
          </Row>
          {news.error ? <T v="caption" color={theme.warning}>{news.error}</T> : null}
          {news.articles.length === 0 && !news.loading ? (
            <Card>
              <T muted>No verified AI-security news yet. Sources are checked every few hours, and items with high-impact claims wait for a human review.</T>
            </Card>
          ) : null}
          {news.articles.map((a, i) => (
            <Appear key={a.id} index={i}>
              <NewsCard a={a} />
            </Appear>
          ))}
          <T v="caption" muted style={{ textAlign: 'center' }}>
            Excerpts are short quotes with links to the original. Interpretations are generated from rules, not by AI, and are labelled.
          </T>
        </>
      ) : (
        <Briefings />
      )}
    </Screen>
  );
}
