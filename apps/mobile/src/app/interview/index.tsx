import { contentPack, gameById, labById, lessonById, roleById } from '@laas/content';
import { itemsForRole, parseDayKey, dayKey } from '@laas/shared';
import { router } from 'expo-router';
import { BookmarkCheck, ChevronLeft, ChevronRight, CircleCheck, Circle, Mic, Target } from '@/components/icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { topicLabel } from '@/components/interview';
import { Appear, Button, Card, Chip, IconBadge, ProgressBar, Row, Screen, SectionTitle, T, Tag } from '@/components/ui';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

const TOPIC_DONE_MIN = 3;

export default function InterviewHub() {
  const { theme } = useTheme();
  const { settings, update } = useSettings();
  const { completed, labBests, playedGames, questionStats, mocks, bookmarks } = useProgress();
  const [filter, setFilter] = useState<string>('role');
  const role = roleById.get(settings.targetRole) ?? contentPack.interview.roles[0]!;
  const items = contentPack.interview.items;

  const topicDone = (topic: string) =>
    items.filter((q) => q.topic === topic && (questionStats.get(q.id)?.best ?? 0) >= 60).length;

  /** Resolve a plan task to a label, completion state and destination, from real progress. */
  const task = (t: string) => {
    const [kind, ref] = t.split(':') as [string, string | undefined];
    switch (kind) {
      case 'lesson':
        return { label: `Lesson: ${lessonById.get(ref!)?.title}`, done: completed.has(ref!), go: () => router.push(`/lesson/${ref}`) };
      case 'lab':
        return { label: `Lab: ${labById.get(ref!)?.title}`, done: !!labBests.get(ref!)?.passed, go: () => router.push(`/lab/${ref}`) };
      case 'game':
        return { label: `Game: ${gameById.get(ref!)?.title}`, done: playedGames.has(ref!), go: () => router.push(`/game/${ref}`) };
      case 'topic':
        return {
          label: `Answer ${TOPIC_DONE_MIN} ${topicLabel(ref!)} questions well (${Math.min(topicDone(ref!), TOPIC_DONE_MIN)}/${TOPIC_DONE_MIN})`,
          done: topicDone(ref!) >= TOPIC_DONE_MIN,
          go: () => setFilter(ref!),
        };
      default:
        return { label: 'Complete a mock interview', done: mocks.some((m) => m.answered > 0), go: () => router.push('/interview/mock') };
    }
  };

  const allTasks = role.weeks.flatMap((w) => w.tasks);
  const doneTasks = allTasks.filter((t) => task(t).done).length;

  const visible =
    filter === 'role'
      ? itemsForRole(items, role)
      : filter === 'saved'
        ? items.filter((q) => bookmarks.has(q.id))
        : items.filter((q) => q.topic === filter);

  let i = 0;
  return (
    <Screen
      title="Interview prep"
      subtitle="Practice for AI security roles. For preparation, not for use during live interviews."
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
          <ChevronLeft size={28} color={theme.text} />
        </Pressable>
      }>
      <Appear index={i++}>
        <Card accent>
          <T v="caption" color={theme.accent}>
            TARGET ROLE
          </T>
          <T v="title">{role.title}</T>
          <T muted>{role.summary}</T>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {role.focusSkills.map((s) => (
              <Tag key={s} label={topicLabel(s)} color={theme.ringPractice} />
            ))}
          </Row>
          <Row style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {contentPack.interview.roles
              .filter((r) => r.id !== role.id)
              .map((r) => (
                <Chip key={r.id} label={r.title} onPress={() => update({ targetRole: r.id })} />
              ))}
          </Row>
        </Card>
      </Appear>

      <Appear index={i++}>
        <Button icon={Mic} label="Start a mock interview" onPress={() => router.push('/interview/mock')} />
      </Appear>

      <Appear index={i++}>
        <SectionTitle>{`${role.weeks.length}-week prep plan`}</SectionTitle>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="label">
              {doneTasks}/{allTasks.length} tasks done
            </T>
            <T v="caption" muted>
              Ticks update from your progress
            </T>
          </Row>
          <ProgressBar value={doneTasks / allTasks.length} />
          {role.weeks.map((w) => (
            <View key={w.title} style={{ gap: 6, marginTop: 8 }}>
              <T v="heading">{w.title}</T>
              <T v="caption" muted>
                {w.goal}
              </T>
              {w.tasks.map((t) => {
                const x = task(t);
                return (
                  <Pressable key={t} accessibilityRole="button" accessibilityState={{ checked: x.done }} onPress={x.go} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 4 }}>
                    {x.done ? <CircleCheck size={18} color={theme.success} /> : <Circle size={18} color={theme.textMuted} />}
                    <T style={{ flex: 1, textDecorationLine: x.done ? 'line-through' : 'none' }} muted={x.done}>
                      {x.label}
                    </T>
                    <ChevronRight size={16} color={theme.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>
      </Appear>

      {mocks.length > 0 ? (
        <Appear index={i++}>
          <SectionTitle>Recent mock interviews</SectionTitle>
          <Card>
            {mocks.slice(0, 5).map((m) => (
              <Row key={m.id} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                <View>
                  <T v="label">{roleById.get(m.roleId)?.title ?? m.roleId}</T>
                  <T v="caption" muted>
                    {parseDayKey(dayKey(new Date(m.completedAt))).toLocaleDateString()} · {m.minutes} min · {m.answered}/{m.questions} answered
                  </T>
                </View>
                <T v="title" color={m.score >= 60 ? theme.success : theme.warning}>
                  {m.score}%
                </T>
              </Row>
            ))}
          </Card>
        </Appear>
      ) : null}

      <Appear index={i++}>
        <SectionTitle>Question bank</SectionTitle>
        <Row style={{ flexWrap: 'wrap', gap: 6 }}>
          <Chip label="For my role" selected={filter === 'role'} onPress={() => setFilter('role')} />
          <Chip label={`★ Saved (${bookmarks.size})`} selected={filter === 'saved'} onPress={() => setFilter('saved')} />
          {contentPack.skills.map((s) => (
            <Chip key={s.id} label={s.label} selected={filter === s.id} onPress={() => setFilter(s.id)} />
          ))}
        </Row>
      </Appear>
      {visible.length === 0 ? (
        <T muted>{filter === 'saved' ? 'Save questions from the feedback screen to revise them here.' : 'No questions yet.'}</T>
      ) : null}
      {visible.map((q) => {
        const st = questionStats.get(q.id);
        return (
          <Card key={q.id} onPress={() => router.push(`/interview/q/${q.id}`)} accessibilityLabel={q.question}>
            <Row style={{ alignItems: 'flex-start' }}>
              <IconBadge icon={st ? (st.best >= 60 ? CircleCheck : Target) : Mic} size={34} color={st ? (st.best >= 60 ? theme.success : theme.warning) : theme.info} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="caption" muted>
                  {topicLabel(q.topic)} · {q.type} · {q.level}
                  {st ? ` · best ${st.best}%` : ''}
                </T>
                <T v="label">{q.question}</T>
              </View>
              {bookmarks.has(q.id) ? <BookmarkCheck size={16} color={theme.warning} /> : null}
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
