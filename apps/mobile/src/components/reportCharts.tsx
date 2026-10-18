import {
  addDays,
  DAY_PARTS,
  minutes,
  parseDayKey,
  startOfWeek,
  type DailyStat,
  type DayPart,
} from '@laas/shared';
import { useRef } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { ProgressBar, Row, T } from './ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * GitHub-style calendar of the last 26 weeks (Mon–Sun rows). Intensity is relative to the
 * daily goal; frozen streak days are outlined. Horizontally scrollable, opens at today.
 */
export function StudyHeatmap({
  stats,
  today,
  goalMinutes,
  frozenDays,
  selected,
  onSelect,
  weeks = 26,
}: {
  stats: Map<string, DailyStat>;
  today: string;
  goalMinutes: number;
  frozenDays: readonly string[];
  selected: string | null;
  onSelect: (day: string) => void;
  weeks?: number;
}) {
  const { theme } = useTheme();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const cell = 14;
  const gap = 4;
  const firstMonday = addDays(startOfWeek(today), -7 * (weeks - 1));
  const frozen = new Set(frozenDays);

  const level = (sec: number) => {
    if (sec <= 0) return 0;
    const r = sec / 60 / Math.max(1, goalMinutes);
    return r >= 1.5 ? 4 : r >= 1 ? 3 : r >= 0.5 ? 2 : 1;
  };
  const fill = (l: number) => (l === 0 ? theme.surfaceAlt : theme.accent + ['', '40', '80', 'BF', 'FF'][l]);

  const columns = Array.from({ length: weeks }, (_, w) => {
    const monday = addDays(firstMonday, w * 7);
    return Array.from({ length: 7 }, (_, d) => addDays(monday, d));
  });

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ marginTop: 16, marginRight: 6, gap }}>
          {['M', '', 'W', '', 'F', '', 'S'].map((l, i) => (
            <T key={i} v="caption" muted style={{ height: cell, lineHeight: cell, fontSize: 10 }}>
              {l}
            </T>
          ))}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          <View>
            <View style={{ flexDirection: 'row', gap, height: 16 }}>
              {columns.map((col, w) => {
                const first = parseDayKey(col[0]!);
                const showMonth = w === 0 || first.getDate() <= 7;
                return (
                  <View key={w} style={{ width: cell }}>
                    {showMonth ? (
                      <T v="caption" muted style={{ fontSize: 10, width: 30 }}>
                        {MONTHS[first.getMonth()]}
                      </T>
                    ) : null}
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap }}>
              {columns.map((col, w) => (
                <View key={w} style={{ gap }}>
                  {col.map((day) => {
                    if (day > today) return <View key={day} style={{ width: cell, height: cell }} />;
                    const s = stats.get(day)?.activeSeconds ?? 0;
                    const isSel = selected === day;
                    return (
                      <Pressable
                        key={day}
                        onPress={() => onSelect(day)}
                        hitSlop={2}
                        accessibilityRole="button"
                        accessibilityLabel={`${day}: ${minutes(s)} minutes${frozen.has(day) ? ', streak freeze used' : ''}`}
                        style={{
                          width: cell,
                          height: cell,
                          borderRadius: 4,
                          backgroundColor: fill(level(s)),
                          borderWidth: isSel || frozen.has(day) || day === today ? 1.5 : 0,
                          borderColor: isSel ? theme.text : frozen.has(day) ? theme.info : theme.accent,
                        }}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <Row style={{ justifyContent: 'flex-end', gap: 4, marginTop: space.sm }}>
        <T v="caption" muted style={{ marginRight: 4 }}>
          Less
        </T>
        {[0, 1, 2, 3, 4].map((l) => (
          <View key={l} style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: fill(l) }} />
        ))}
        <T v="caption" muted style={{ marginLeft: 4 }}>
          More
        </T>
      </Row>
    </View>
  );
}

/** Radar of skill mastery (0–100) across the six skill areas. */
/** Splits a label at the space nearest its middle so it fits beside the radar. */
function wrapLabel(label: string): string[] {
  if (label.length <= 10 || !label.includes(' ')) return [label];
  const mid = label.length / 2;
  const spaces = [...label.matchAll(/ /g)].map((m) => m.index!);
  const cut = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best));
  return [label.slice(0, cut), label.slice(cut + 1)];
}

export function SkillRadar({ skills }: { skills: { id: string; label: string; score: number }[] }) {
  const { theme } = useTheme();
  const w = 360;
  const h = 300;
  const cx = w / 2;
  const cy = h / 2;
  const r = 92;
  const n = skills.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v] as const;
  };
  const poly = (v: (i: number) => number) => skills.map((_, i) => pt(i, v(i)).join(',')).join(' ');

  return (
    <View
      accessible
      accessibilityLabel={`Skill mastery: ${skills.map((s) => `${s.label} ${s.score} percent`).join(', ')}`}>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <Polygon key={f} points={poly(() => f)} fill="none" stroke={theme.border} strokeWidth={1} />
        ))}
        {skills.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={theme.border} strokeWidth={1} />;
        })}
        <Polygon
          points={poly((i) => Math.max(0.02, skills[i]!.score / 100))}
          fill={theme.accent + '40'}
          stroke={theme.accent}
          strokeWidth={2}
        />
        {skills.map((s, i) => {
          const [x, y] = pt(i, Math.max(0.02, s.score / 100));
          return <Circle key={s.id} cx={x} cy={y} r={3.5} fill={theme.accent} />;
        })}
        {skills.map((s, i) => {
          const [x, y0] = pt(i, 1.16);
          const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
          const lines = wrapLabel(s.label);
          // Top labels grow upward, bottom labels downward, side labels are centred on the axis.
          const blockH = lines.length * 14 + 13;
          const y = y0 < cy - 20 ? y0 - blockH + 12 : y0 > cy + 20 ? y0 + 6 : y0 - blockH / 2 + 10;
          return (
            <G key={`l-${s.id}`}>
              {lines.map((line, li) => (
                <SvgText key={li} x={x} y={y + li * 14} fill={theme.text} fontSize={12.5} fontWeight="600" textAnchor={anchor}>
                  {line}
                </SvgText>
              ))}
              <SvgText x={x} y={y + lines.length * 14} fill={theme.accent} fontSize={12} fontWeight="700" textAnchor={anchor}>
                {`${s.score}%`}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/** Minutes studied per part of the day. */
export function TimeOfDayBars({ totals }: { totals: Record<DayPart, number> }) {
  const { theme } = useTheme();
  const max = Math.max(1, ...Object.values(totals));
  return (
    <View style={{ gap: space.md }}>
      {DAY_PARTS.map((p) => (
        <View key={p.id} style={{ gap: 4 }} accessible accessibilityLabel={`${p.label}: ${minutes(totals[p.id])} minutes`}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="label">{p.label}</T>
            <T v="caption" muted>
              {minutes(totals[p.id])} min
            </T>
          </Row>
          <ProgressBar value={totals[p.id] / max} color={theme.info} height={10} />
        </View>
      ))}
    </View>
  );
}

/** Weekly overall mastery trend (quiz and game evidence). */
export function TrendLine({ points }: { points: { at: number; score: number }[] }) {
  const { theme } = useTheme();
  const w = 320;
  const h = 130;
  const padX = 16;
  const top = 12;
  const bottom = 24;
  const x = (i: number) => padX + (i * (w - 2 * padX)) / Math.max(1, points.length - 1);
  const y = (v: number) => top + (1 - v / 100) * (h - top - bottom);
  const last = points[points.length - 1];

  return (
    <View
      accessible
      accessibilityLabel={`Mastery over the last ${points.length} weeks: ${points.map((p) => `${p.score}%`).join(', ')}`}>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        {[0, 50, 100].map((v) => (
          <G key={v}>
            <Line x1={padX} x2={w - padX} y1={y(v)} y2={y(v)} stroke={theme.border} strokeDasharray="3 5" />
            <SvgText x={w - padX} y={y(v) - 3} fill={theme.textMuted} fontSize={9} textAnchor="end">
              {`${v}%`}
            </SvgText>
          </G>
        ))}
        <Polyline
          points={points.map((p, i) => `${x(i)},${y(p.score)}`).join(' ')}
          fill="none"
          stroke={theme.ringPractice}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <Circle key={p.at} cx={x(i)} cy={y(p.score)} r={i === points.length - 1 ? 5 : 3} fill={theme.ringPractice} />
        ))}
        <SvgText x={padX} y={h - 6} fill={theme.textMuted} fontSize={10}>
          {`${points.length - 1}w ago`}
        </SvgText>
        <SvgText x={w - padX} y={h - 6} fill={theme.textMuted} fontSize={10} textAnchor="end">
          {last ? `Now ${last.score}%` : 'Now'}
        </SvgText>
      </Svg>
    </View>
  );
}

export function StatPill({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.surfaceAlt, borderRadius: radius.md, padding: space.md, gap: 2 }}>
      <T v="heading">{value}</T>
      <T v="caption" muted>
        {label}
      </T>
    </View>
  );
}
