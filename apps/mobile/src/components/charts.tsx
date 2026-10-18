import { minutes, weekdayShort, type DailyStat } from '@laas/shared';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { T } from './ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Ring({
  r,
  stroke,
  value,
  color,
  track,
  center,
  delay,
  animate,
}: {
  r: number;
  stroke: number;
  value: number;
  color: string;
  track: string;
  center: number;
  delay: number;
  animate: boolean;
}) {
  const c = 2 * Math.PI * r;
  const progress = useSharedValue(animate ? 0 : value);

  useEffect(() => {
    progress.value = animate
      ? withDelay(delay, withTiming(value, { duration: 900, easing: Easing.out(Easing.cubic) }))
      : value;
  }, [value, animate, delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - progress.value),
    opacity: progress.value > 0.001 ? 1 : 0,
  }));

  return (
    <>
      <Circle cx={center} cy={center} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${c} ${c}`}
        animatedProps={animatedProps}
      />
    </>
  );
}

export interface RingSpec {
  label: string;
  value: number; // 0..1
  color: string;
  detail: string;
}

/** Three concentric activity rings: Learn minutes, Practice questions, Lessons. */
export function ActivityRings({ rings, size = 150 }: { rings: RingSpec[]; size?: number }) {
  const { animate } = useTheme();
  const stroke = size * 0.1;
  const center = size / 2;
  const gap = stroke * 1.25;
  const summary = rings.map((r) => `${r.label}: ${r.detail}`).join(', ');

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}
      accessible
      accessibilityLabel={`Today's rings. ${summary}`}>
      {/* Rotated container so arcs start at 12 o'clock (portable across native and web). */}
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <G>
          {rings.map((ring, i) => (
            <Ring
              key={ring.label}
              r={center - stroke / 2 - i * gap}
              stroke={stroke}
              value={ring.value}
              color={ring.color}
              track={ring.color + '2A'}
              center={center}
              delay={i * 120}
              animate={animate}
            />
          ))}
        </G>
      </Svg>
      <View style={{ flex: 1, gap: 10 }}>
        {rings.map((ring) => (
          <View key={ring.label}>
            <T v="caption" color={ring.color} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              {ring.label}
            </T>
            <T v="heading">{ring.detail}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Last-7-days minutes, stacked by activity, with a dashed goal line. */
export function WeekBars({
  days,
  goalMinutes,
  today,
  height = 160,
}: {
  days: DailyStat[];
  goalMinutes: number;
  today: string;
  height?: number;
}) {
  const { theme } = useTheme();
  const width = 320;
  const labelH = 22;
  const topPad = 16;
  const chartH = height - labelH - topPad;
  const maxMin = Math.max(goalMinutes * 1.25, ...days.map((d) => d.activeSeconds / 60), 5);
  const slot = width / days.length;
  const barW = Math.min(26, slot * 0.55);
  const y = (min: number) => topPad + chartH - (min / maxMin) * chartH;

  const segments = (d: DailyStat) => {
    const a = d.byActivity;
    const lesson = (a.lesson ?? 0) / 60;
    const practice = ((a.quiz ?? 0) + (a.game ?? 0) + (a.interview ?? 0) + (a.lab ?? 0)) / 60;
    const revise = (a.review ?? 0) / 60;
    const other = Math.max(0, d.activeSeconds / 60 - lesson - practice - revise);
    return [
      { v: lesson, color: theme.accent },
      { v: practice, color: theme.ringPractice },
      { v: revise, color: theme.ringLessons },
      { v: other, color: theme.info },
    ];
  };

  const described = days.map((d) => `${weekdayShort(d.day)} ${minutes(d.activeSeconds)} minutes`).join(', ');

  return (
    <View accessible accessibilityLabel={`Minutes studied in the last 7 days: ${described}. Goal ${goalMinutes} minutes.`}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {days.map((d, i) => {
          const x = i * slot + (slot - barW) / 2;
          let acc = 0;
          const isToday = d.day === today;
          return (
            <G key={d.day}>
              <Rect x={x} y={topPad} width={barW} height={chartH} rx={barW / 2.5} fill={theme.surfaceAlt} />
              {segments(d).map((s, j) => {
                if (s.v <= 0) return null;
                const top = y(acc + s.v);
                const h = y(acc) - top;
                acc += s.v;
                return <Rect key={j} x={x} y={top} width={barW} height={Math.max(h, 2)} rx={4} fill={s.color} />;
              })}
              <SvgText
                x={x + barW / 2}
                y={height - 6}
                fill={isToday ? theme.accent : theme.textMuted}
                fontSize={11}
                fontWeight={isToday ? '700' : '400'}
                textAnchor="middle">
                {weekdayShort(d.day)}
              </SvgText>
            </G>
          );
        })}
        {/* Drawn last so it stays visible over the bars. */}
        <Line
          x1={0}
          x2={width}
          y1={y(goalMinutes)}
          y2={y(goalMinutes)}
          stroke={theme.text}
          strokeOpacity={0.55}
          strokeDasharray="4 5"
          strokeWidth={1.2}
        />
      </Svg>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
        <Legend color={theme.accent} label="Lessons" />
        <Legend color={theme.ringPractice} label="Practice" />
        <Legend color={theme.ringLessons} label="Revise" />
        <Legend color={theme.info} label="Other" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.textMuted }} />
          <T v="caption" muted>
            Goal {goalMinutes} min
          </T>
        </View>
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <T v="caption" muted>
        {label}
      </T>
    </View>
  );
}
