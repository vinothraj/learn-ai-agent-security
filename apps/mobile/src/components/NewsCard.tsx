import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BadgeCheck, ExternalLink, Quote, ShieldAlert, Sparkles, TriangleAlert } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { relativeDate, type NewsArticle } from '@/state/news';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Card, Row, T, Tag } from './ui';

/** One article. The source's words and our interpretation are visually and textually separated. */
export function NewsCard({ a, compact }: { a: NewsArticle; compact?: boolean }) {
  const { theme } = useTheme();
  const verified = a.verification === 'source_verified';
  return (
    <Card>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Tag label={a.categoryLabel} color={theme.ringPractice} />
        {a.highImpact ? <Tag label="HIGH IMPACT" color={theme.danger} /> : null}
        {a.vulnIds.slice(0, 2).map((id) => (
          <Tag key={id} label={id} color={theme.warning} />
        ))}
      </Row>
      <T v="heading">{a.title}</T>
      <Row style={{ gap: 6 }}>
        {verified ? <BadgeCheck size={14} color={theme.success} /> : <TriangleAlert size={14} color={theme.warning} />}
        <T v="caption" color={verified ? theme.success : theme.warning}>
          {a.publisher} · {verified ? 'verified source' : 'unverified (preprint)'}
        </T>
        <T v="caption" muted>
          · {relativeDate(a.publishedAt ?? a.retrievedAt)}
        </T>
      </Row>
      {a.sourceExcerpt ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: theme.border, paddingLeft: space.md, gap: 2 }}>
          <Row style={{ gap: 6 }}>
            <Quote size={12} color={theme.textMuted} />
            <T v="caption" muted>
              FROM THE SOURCE
            </T>
          </Row>
          <T>{a.sourceExcerpt}</T>
        </View>
      ) : null}
      {!compact ? (
        <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: radius.sm, padding: space.md, gap: 4 }}>
          <Row style={{ gap: 6 }}>
            <Sparkles size={12} color={theme.accent} />
            <T v="caption" color={theme.accent}>
              {a.interpretation.origin === 'editor' ? 'EDITOR NOTE' : 'OUR INTERPRETATION (NOT FROM THE SOURCE)'}
            </T>
          </Row>
          <T v="caption">{a.interpretation.summary}</T>
          <Row style={{ gap: 6, alignItems: 'flex-start' }}>
            <ShieldAlert size={14} color={theme.success} style={{ marginTop: 2 }} />
            <T v="caption" style={{ flex: 1 }}>
              {a.interpretation.defense}
            </T>
          </Row>
        </View>
      ) : null}
      <Row style={{ flexWrap: 'wrap', gap: space.md }}>
        <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(a.url)} hitSlop={8} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <ExternalLink size={14} color={theme.accent} />
          <T v="label" color={theme.accent}>
            Read original
          </T>
        </Pressable>
        {!compact && a.links.lessonId ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/lesson/${a.links.lessonId}`)} hitSlop={8}>
            <T v="label" color={theme.accent}>
              Lesson →
            </T>
          </Pressable>
        ) : null}
        {!compact && a.links.labId ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/lab/${a.links.labId}`)} hitSlop={8}>
            <T v="label" color={theme.accent}>
              Lab →
            </T>
          </Pressable>
        ) : null}
        {!compact && a.links.interviewId ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/interview/q/${a.links.interviewId}`)} hitSlop={8}>
            <T v="label" color={theme.accent}>
              Interview Q →
            </T>
          </Pressable>
        ) : null}
      </Row>
    </Card>
  );
}
