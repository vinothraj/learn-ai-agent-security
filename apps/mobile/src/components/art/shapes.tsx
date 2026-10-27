import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

/**
 * Small vector building blocks for the topic illustrations (scenes.tsx). Every scene uses a 120 x 80 canvas,
 * so coordinates here are in that space. Shapes take colours as arguments: scenes stay theme-aware.
 */

export function Doc({ x, y, w = 26, h = 32, fill, ink, lines = 4 }: { x: number; y: number; w?: number; h?: number; fill: string; ink: string; lines?: number }) {
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} rx={3} fill={fill} stroke={ink} strokeWidth={1.2} />
      {Array.from({ length: lines }, (_, i) => (
        <Line key={i} x1={x + 4} y1={y + 7 + i * 6} x2={x + w - (i % 2 ? 8 : 4)} y2={y + 7 + i * 6} stroke={ink} strokeWidth={1.4} strokeLinecap="round" opacity={0.55} />
      ))}
    </G>
  );
}

export function Bubble({ x, y, w = 34, h = 20, fill, tailLeft = true }: { x: number; y: number; w?: number; h?: number; fill: string; tailLeft?: boolean }) {
  const tx = tailLeft ? x + 6 : x + w - 6;
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} rx={6} fill={fill} />
      <Polygon points={`${tx - 3},${y + h - 1} ${tx + 5},${y + h - 1} ${tailLeft ? tx - 3 : tx + 5},${y + h + 6}`} fill={fill} />
    </G>
  );
}

export function Db({ x, y, w = 24, h = 26, fill, ink }: { x: number; y: number; w?: number; h?: number; fill: string; ink: string }) {
  const rx = w / 2;
  return (
    <G>
      <Rect x={x} y={y + 4} width={w} height={h - 8} fill={fill} />
      <Ellipse cx={x + rx} cy={y + h - 4} rx={rx} ry={4} fill={fill} />
      <Ellipse cx={x + rx} cy={y + 4} rx={rx} ry={4} fill={fill} stroke={ink} strokeWidth={1.2} />
      <Path d={`M${x} ${y + h / 2} q${rx} 7 ${w} 0`} stroke={ink} strokeWidth={1.2} fill="none" opacity={0.6} />
    </G>
  );
}

export function Robot({ x, y, s = 1, fill, ink }: { x: number; y: number; s?: number; fill: string; ink: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Line x1={12} y1={0} x2={12} y2={5} stroke={ink} strokeWidth={1.5} />
      <Circle cx={12} cy={0} r={2} fill={ink} />
      <Rect x={0} y={5} width={24} height={18} rx={6} fill={fill} />
      <Circle cx={8} cy={14} r={2.6} fill={ink} />
      <Circle cx={16} cy={14} r={2.6} fill={ink} />
      <Rect x={4} y={25} width={16} height={9} rx={3} fill={fill} opacity={0.8} />
    </G>
  );
}

export function Person({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Circle cx={10} cy={7} r={6} fill={fill} />
      <Path d="M0 30 Q0 16 10 16 Q20 16 20 30 Z" fill={fill} />
    </G>
  );
}

export function Shield({ x, y, s = 1, fill, ink }: { x: number; y: number; s?: number; fill: string; ink?: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Path d="M12 0 L24 5 V13 C24 21 18 27 12 30 C6 27 0 21 0 13 V5 Z" fill={fill} />
      {ink ? <Path d="M7 15 L11 19 L18 10" stroke={ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </G>
  );
}

export function Lock({ x, y, s = 1, fill, ink }: { x: number; y: number; s?: number; fill: string; ink: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Path d="M4 10 V7 a6 6 0 0 1 12 0 V10" stroke={fill} strokeWidth={2.6} fill="none" />
      <Rect x={0} y={10} width={20} height={14} rx={3} fill={fill} />
      <Circle cx={10} cy={16} r={2} fill={ink} />
      <Rect x={9.2} y={16} width={1.6} height={5} fill={ink} />
    </G>
  );
}

export function Key({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Circle cx={6} cy={6} r={6} fill="none" stroke={fill} strokeWidth={3} />
      <Line x1={12} y1={6} x2={26} y2={6} stroke={fill} strokeWidth={3} strokeLinecap="round" />
      <Line x1={21} y1={6} x2={21} y2={11} stroke={fill} strokeWidth={3} strokeLinecap="round" />
      <Line x1={25} y1={6} x2={25} y2={10} stroke={fill} strokeWidth={3} strokeLinecap="round" />
    </G>
  );
}

export function Gear({ cx, cy, r = 8, fill, hole }: { cx: number; cy: number; r?: number; fill: string; hole: string }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={fill} strokeWidth={4} strokeDasharray="3.2 3" />
      <Circle cx={cx} cy={cy} r={r} fill={fill} />
      <Circle cx={cx} cy={cy} r={r * 0.38} fill={hole} />
    </G>
  );
}

export function Terminal({ x, y, w = 40, h = 28, fill, bar, ink }: { x: number; y: number; w?: number; h?: number; fill: string; bar: string; ink: string }) {
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} rx={4} fill={fill} />
      <Rect x={x} y={y} width={w} height={6} rx={3} fill={bar} />
      <Path d={`M${x + 5} ${y + 12} l4 3 l-4 3`} stroke={ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Line x1={x + 12} y1={y + 18} x2={x + 22} y2={y + 18} stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={x + 5} y1={y + 23} x2={x + w - 10} y2={y + 23} stroke={ink} strokeWidth={1.2} opacity={0.5} strokeLinecap="round" />
    </G>
  );
}

export function Arrow({ x1, y1, x2, y2, color, dashed }: { x1: number; y1: number; x2: number; y2: number; color: string; dashed?: boolean }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 5;
  const p1 = `${x2 - h * Math.cos(a - 0.5)},${y2 - h * Math.sin(a - 0.5)}`;
  const p2 = `${x2 - h * Math.cos(a + 0.5)},${y2 - h * Math.sin(a + 0.5)}`;
  return (
    <G>
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeDasharray={dashed ? '3 3' : undefined} />
      <Polygon points={`${x2},${y2} ${p1} ${p2}`} fill={color} />
    </G>
  );
}

export function Warn({ x, y, s = 1, fill, ink }: { x: number; y: number; s?: number; fill: string; ink: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Polygon points="10,0 20,18 0,18" fill={fill} />
      <Rect x={9} y={5} width={2} height={7} rx={1} fill={ink} />
      <Circle cx={10} cy={14.5} r={1.2} fill={ink} />
    </G>
  );
}

export function Check({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return <Path d={`M${x} ${y + 5 * s} l${4 * s} ${4 * s} l${8 * s} ${-9 * s}`} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

export function Cross({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return (
    <G>
      <Line x1={x} y1={y} x2={x + 9 * s} y2={y + 9 * s} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={x + 9 * s} y1={y} x2={x} y2={y + 9 * s} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </G>
  );
}

export function Magnifier({ cx, cy, r = 8, color }: { cx: number; cy: number; r?: number; color: string }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3} />
      <Line x1={cx + r * 0.7} y1={cy + r * 0.7} x2={cx + r * 1.6} y2={cy + r * 1.6} stroke={color} strokeWidth={3.4} strokeLinecap="round" />
    </G>
  );
}

export function Globe({ cx, cy, r = 9, color }: { cx: number; cy: number; r?: number; color: string }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.8} />
      <Ellipse cx={cx} cy={cy} rx={r * 0.45} ry={r} fill="none" stroke={color} strokeWidth={1.4} />
      <Line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={color} strokeWidth={1.4} />
    </G>
  );
}

export function Drop({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return <Path transform={`translate(${x} ${y}) scale(${s})`} d="M5 0 C5 0 10 7 10 10 a5 5 0 0 1 -10 0 C0 7 5 0 5 0 Z" fill={fill} />;
}
