import { contentPack } from '@laas/content';
import { router } from 'expo-router';
import { Brain, CalendarCheck, ChevronRight, FlaskConical, MessageSquareText, Target, Zap, type LucideIcon } from '@/components/icons';
import { View } from 'react-native';

import { GAME_ICONS } from '@/components/games';
import { Appear, Card, IconBadge, Row, Screen, SectionTitle, T, Tag } from '@/components/ui';
import { dailyGame, reviewMinutes } from '@/lib/daily';
import { useProgress } from '@/state/progress';
import { useTheme } from '@/theme/ThemeProvider';

function Item({
  icon,
  color,
  title,
  detail,
  onPress,
  badge,
  soon,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  detail: string;
  onPress?: () => void;
  badge?: string;
  soon?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={title} style={soon ? { opacity: 0.75 } : undefined}>
      <Row>
        <IconBadge icon={icon} color={color} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="heading">{title}</T>
          <T v="caption" muted>
            {detail}
          </T>
        </View>
        {badge ? <Tag label={badge} color={soon ? theme.textMuted : color} /> : <ChevronRight size={20} color={theme.textMuted} />}
      </Row>
    </Card>
  );
}

export default function Practice() {
  const { theme } = useTheme();
  const { today, dailyToday, dueCards, cards, labBests } = useProgress();
  const labsPassed = [...labBests.values()].filter((b) => b.passed).length;
  const game = dailyGame(today);
  let i = 0;

  return (
    <Screen title="Practice" subtitle="Short, safe exercises on fictional systems.">
      <Appear index={i++}>
        <Item
          icon={dailyToday ? CalendarCheck : GAME_ICONS[game.icon] ?? Target}
          color={dailyToday ? theme.success : theme.warning}
          title={`Daily challenge: ${game.title}`}
          detail={dailyToday ? `Done today: ${dailyToday.correct}/${dailyToday.total}. Replays are practice.` : 'Same puzzle for everyone today · +20 XP bonus'}
          badge={dailyToday ? 'Done' : 'Today'}
          onPress={() => router.push(`/game/${game.id}?daily=1`)}
        />
      </Appear>
      <Appear index={i++}>
        <Item
          icon={Brain}
          color={theme.ringLessons}
          title="Flashcards"
          detail={
            cards.length === 0
              ? 'Finish a lesson to unlock its cards'
              : dueCards.length > 0
                ? `${dueCards.length} due · ≈ ${reviewMinutes(dueCards.length)} min · spaced repetition (FSRS)`
                : `All ${cards.length} cards caught up`
          }
          badge={dueCards.length > 0 ? String(dueCards.length) : undefined}
          onPress={() => router.push('/review')}
        />
      </Appear>
      <Appear index={i++}>
        <Item
          icon={Zap}
          color={theme.ringPractice}
          title="Quick quiz"
          detail="5 questions, prioritising lessons you've studied"
          onPress={() => router.push('/quiz')}
        />
      </Appear>

      <Appear index={i++}>
        <SectionTitle>Mini-games</SectionTitle>
      </Appear>
      {contentPack.games.map((g) => (
        <Appear key={g.id} index={i++}>
          <Item
            icon={GAME_ICONS[g.icon] ?? Target}
            color={theme.ringPractice}
            title={g.title}
            detail={g.tagline}
            onPress={() => router.push(`/game/${g.id}`)}
          />
        </Appear>
      ))}

      <Appear index={i++}>
        <SectionTitle>Labs & interviews</SectionTitle>
      </Appear>
      <Appear index={i++}>
        <Item
          icon={MessageSquareText}
          color={theme.info}
          title="Interview prep"
          detail={`${contentPack.interview.items.length} questions · 7 role plans · timed mock interviews`}
          onPress={() => router.push('/interview')}
        />
      </Appear>
      <Appear index={i++}>
        <Item
          icon={FlaskConical}
          color={theme.success}
          title="Security labs"
          detail={`${labsPassed}/${contentPack.labs.length} passed · attack, harden and report on fictional systems`}
          onPress={() => router.push('/labs')}
        />
      </Appear>
    </Screen>
  );
}
