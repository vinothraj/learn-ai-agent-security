import { flashcardById, lessonById } from '@laas/content';
import { dayKey, formatInterval, GRADES, previewIntervals, Rating, REVIEW_XP, reviewCard, type Grade } from '@laas/shared';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Brain, Layers, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconBadge, ProgressBar, Row, T, Tag } from '@/components/ui';
import { awardXp, saveReview, type StoredCard } from '@/db/repo';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useStudySession } from '@/state/tracker';
import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const SESSION_MAX = 20;
const REQUEUE_WITHIN_MS = 10 * 60_000;
const MAX_SEEN_PER_SESSION = 3;

export default function Review() {
  const db = useSQLiteContext();
  const { theme, animate } = useTheme();
  const haptic = useHaptics();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { dueCards, cards, refresh } = useProgress();
  useStudySession('review', 'flashcards');

  const [queue, setQueue] = useState<StoredCard[]>(() => dueCards.slice(0, SESSION_MAX));
  const [initial] = useState(() => Math.min(dueCards.length, SESSION_MAX));
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [done, setDone] = useState(0);
  const [recalled, setRecalled] = useState(0);
  const [xp, setXp] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const flip = useSharedValue(0);
  const [openedAt] = useState(() => Date.now());

  const current = queue[0];
  const content = current ? flashcardById.get(current.cardId) : undefined;
  const lesson = current ? lessonById.get(current.lessonId) : undefined;
  const intervals = current ? previewIntervals(current.card, new Date()) : null;

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: flip.value >= 0.5 ? 1 : 0,
  }));

  const reveal = () => {
    haptic('select');
    setFlipped(true);
    flip.set(animate ? withTiming(1, { duration: 380 }) : 1);
  };

  const grade = async (g: Grade) => {
    if (!current) return;
    haptic(g === Rating.Again ? 'error' : 'success');
    const now = new Date();
    const day = dayKey(now);
    const updated = reviewCard(current.card, g, now);
    await saveReview(db, { cardId: current.cardId, lessonId: current.lessonId, card: updated, rating: g, day });
    const gained = await awardXp(db, day, REVIEW_XP, 'card_review', `${current.cardId}:${day}`);
    setXp((x) => x + gained);

    const timesSeen = (seen[current.cardId] ?? 0) + 1;
    setSeen((s) => ({ ...s, [current.cardId]: timesSeen }));
    const rest = queue.slice(1);
    // Short learning steps come back later in this session, like a real study deck.
    const requeue = updated.due.getTime() - now.getTime() < REQUEUE_WITHIN_MS && timesSeen < MAX_SEEN_PER_SESSION;
    setQueue(requeue ? [...rest, { ...current, card: updated, due: updated.due.getTime() }] : rest);
    setDone((d) => d + 1);
    if (g !== Rating.Again) setRecalled((r) => r + 1);
    setFlipped(false);
    flip.set(0);
    refresh();
  };

  const nextDue = cards.length ? Math.min(...cards.map((c) => c.due)) : null;

  const header = (
    <Row style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close review" hitSlop={12} onPress={() => router.back()}>
        <X size={26} color={theme.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <ProgressBar value={initial ? Math.min(1, done / initial) : 1} color={theme.ringLessons} />
      </View>
      <T v="caption" muted>
        {queue.length} left
      </T>
    </Row>
  );

  if (!current || !content) {
    const empty = done === 0;
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + space.sm }}>
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg }}>
          <Animated.View entering={animate ? ZoomIn.springify().damping(12) : undefined}>
            <IconBadge icon={empty ? Layers : Brain} size={88} color={theme.ringLessons} />
          </Animated.View>
          {empty ? (
            <>
              <T v="title" style={{ textAlign: 'center' }}>
                {cards.length === 0 ? 'Your deck is empty' : 'All caught up'}
              </T>
              <T muted style={{ textAlign: 'center' }}>
                {cards.length === 0
                  ? 'Finish a lesson to add its flashcards to your spaced-repetition deck.'
                  : `Next card is due in ${formatInterval(Math.max(0, (nextDue ?? openedAt) - openedAt))}.`}
              </T>
            </>
          ) : (
            <>
              <T v="display">Session complete</T>
              <T muted style={{ textAlign: 'center' }}>
                {done} reviews · recalled {recalled} ({Math.round((recalled / done) * 100)}%)
                {settings.gamification ? ` · +${xp} XP` : ''}
              </T>
              <T v="caption" muted style={{ textAlign: 'center' }}>
                Cards you found hard come back sooner; easy ones are spaced further apart.
              </T>
            </>
          )}
        </View>
        <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg }}>
          <Button label="Done" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const face = {
    position: 'absolute' as const,
    inset: 0,
    backfaceVisibility: 'hidden' as const,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.xl,
    justifyContent: 'center' as const,
    gap: space.md,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + space.sm }}>
      {header}
      <View style={{ flex: 1, padding: space.lg }}>
        <Pressable
          style={{ flex: 1 }}
          disabled={flipped}
          onPress={reveal}
          accessibilityRole="button"
          accessibilityLabel={flipped ? `Answer: ${content.back}` : `Question: ${content.front}. Tap to reveal the answer.`}>
          <Animated.View style={[face, front]}>
            {lesson ? <Tag label={lesson.title} color={theme.ringLessons} /> : null}
            <T v="title" style={{ fontSize: 22, lineHeight: 30 }}>
              {content.front}
            </T>
            <T v="caption" muted>
              Recall the answer, then tap to check.
            </T>
          </Animated.View>
          <Animated.View style={[face, back, { borderColor: theme.ringLessons + '88' }]}>
            <T v="label" color={theme.ringLessons}>
              ANSWER
            </T>
            <T style={{ fontSize: 18, lineHeight: 27 }}>{content.back}</T>
          </Animated.View>
        </Pressable>
      </View>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg, gap: space.sm }}>
        {flipped && intervals ? (
          <>
            <T v="caption" muted style={{ textAlign: 'center' }}>
              How well did you recall it?
            </T>
            <Row style={{ gap: space.sm }}>
              {GRADES.map(({ grade: g, label }) => {
                const color = g === Rating.Again ? theme.danger : g === Rating.Hard ? theme.warning : g === Rating.Good ? theme.success : theme.info;
                return (
                  <Pressable
                    key={g}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}, next review in ${formatInterval(intervals[g])}`}
                    onPress={() => grade(g)}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 60,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderColor: color,
                      backgroundColor: color + '1A',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.8 : 1,
                    })}>
                    <T v="label" color={color}>
                      {label}
                    </T>
                    <T v="caption" muted>
                      {formatInterval(intervals[g])}
                    </T>
                  </Pressable>
                );
              })}
            </Row>
          </>
        ) : (
          <Button label="Show answer" onPress={reveal} />
        )}
      </View>
    </View>
  );
}
