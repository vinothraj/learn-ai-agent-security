import type { ReactElement } from 'react';
import { Circle, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { Arrow, Bubble, Check, Cross, Db, Doc, Drop, Gear, Globe, Key, Lock, Magnifier, Person, Robot, Shield, Terminal, Warn } from './shapes';

/** Colours a scene may use. `hue` is the section colour; everything else comes from the active theme. */
export interface ArtPalette {
  hue: string;
  hue2: string;
  ink: string;
  paper: string;
  muted: string;
  ok: string;
  bad: string;
  warn: string;
}

type Scene = (p: ArtPalette) => ReactElement;

// ---- Roadmaps (section heroes) ----
const roadmaps: Record<string, Scene> = {
  'ai-security-foundations': (p) => (
    <G>
      <Rect x={14} y={14} width={56} height={52} rx={4} fill={p.paper} stroke={p.hue} strokeWidth={1.4} strokeDasharray="4 3" />
      <Line x1={14} y1={36} x2={70} y2={36} stroke={p.hue} strokeWidth={1} opacity={0.5} />
      <Line x1={38} y1={14} x2={38} y2={66} stroke={p.hue} strokeWidth={1} opacity={0.5} />
      <Circle cx={26} cy={25} r={4} fill={p.hue2} />
      <Circle cx={54} cy={52} r={4} fill={p.hue2} />
      <Shield x={76} y={18} s={1.5} fill={p.hue} ink={p.paper} />
    </G>
  ),
  'genai-llm-security': (p) => (
    <G>
      <Bubble x={12} y={14} w={50} h={24} fill={p.hue} />
      <Line x1={19} y1={23} x2={52} y2={23} stroke={p.paper} strokeWidth={2} strokeLinecap="round" />
      <Line x1={19} y1={30} x2={42} y2={30} stroke={p.paper} strokeWidth={2} strokeLinecap="round" />
      <Bubble x={44} y={46} w={40} h={18} fill={p.hue2} tailLeft={false} />
      <Shield x={88} y={20} s={1.2} fill={p.ok} ink={p.paper} />
      <Warn x={92} y={56} s={0.8} fill={p.warn} ink={p.paper} />
    </G>
  ),
  'agent-security': (p) => (
    <G>
      <Robot x={44} y={20} s={1.3} fill={p.hue} ink={p.paper} />
      <Gear cx={18} cy={26} r={7} fill={p.hue2} hole={p.paper} />
      <Globe cx={100} cy={26} r={9} color={p.hue2} />
      <Db x={8} y={48} w={20} h={22} fill={p.hue2} ink={p.paper} />
      <Lock x={92} y={48} s={0.9} fill={p.ok} ink={p.paper} />
      <Arrow x1={42} y1={36} x2={28} y2={30} color={p.muted} />
      <Arrow x1={78} y1={36} x2={90} y2={30} color={p.muted} />
      <Arrow x1={42} y1={50} x2={30} y2={56} color={p.muted} />
      <Arrow x1={78} y1={50} x2={90} y2={56} color={p.muted} />
    </G>
  ),
  'ai-security-testing': (p) => (
    <G>
      <Circle cx={44} cy={40} r={24} fill="none" stroke={p.hue} strokeWidth={3} />
      <Circle cx={44} cy={40} r={15} fill="none" stroke={p.hue} strokeWidth={3} opacity={0.7} />
      <Circle cx={44} cy={40} r={6} fill={p.bad} />
      <Magnifier cx={88} cy={32} r={12} color={p.hue2} />
      <Check x={82} y={58} s={1.2} color={p.ok} />
    </G>
  ),
  'interview-career': (p) => (
    <G>
      <Person x={14} y={30} s={1.3} fill={p.hue} />
      <Bubble x={46} y={12} w={44} h={22} fill={p.hue2} />
      <Line x1={53} y1={20} x2={82} y2={20} stroke={p.paper} strokeWidth={2} strokeLinecap="round" />
      <Line x1={53} y1={27} x2={74} y2={27} stroke={p.paper} strokeWidth={2} strokeLinecap="round" />
      <Rect x={58} y={46} width={40} height={22} rx={4} fill={p.hue} />
      <Rect x={70} y={42} width={16} height={6} rx={2} fill="none" stroke={p.hue} strokeWidth={2} />
      <Line x1={58} y1={56} x2={98} y2={56} stroke={p.paper} strokeWidth={1.4} />
    </G>
  ),
  'ai-fundamentals': (p) => {
    const cols = [
      [24, [22, 40, 58]],
      [60, [16, 32, 48, 64]],
      [96, [30, 50]],
    ] as const;
    return (
      <G>
        {cols[0][1].map((a) => cols[1][1].map((b) => <Line key={`${a}-${b}`} x1={24} y1={a} x2={60} y2={b} stroke={p.muted} strokeWidth={0.8} opacity={0.6} />))}
        {cols[1][1].map((a) => cols[2][1].map((b) => <Line key={`${a}-${b}`} x1={60} y1={a} x2={96} y2={b} stroke={p.muted} strokeWidth={0.8} opacity={0.6} />))}
        {cols.map(([x, ys], ci) => ys.map((y) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={5} fill={ci === 1 ? p.hue : p.hue2} />))}
      </G>
    );
  },
};

// ---- Lessons ----
const lessons: Record<string, Scene> = {
  // A: foundations
  'a-trust-boundaries': (p) => (
    <G>
      <Person x={14} y={26} s={1.1} fill={p.hue2} />
      <Line x1={60} y1={8} x2={60} y2={72} stroke={p.hue} strokeWidth={2.4} strokeDasharray="5 4" />
      <Shield x={50} y={28} s={0.85} fill={p.hue} ink={p.paper} />
      <Robot x={84} y={22} s={1.05} fill={p.hue2} ink={p.paper} />
      <Arrow x1={38} y1={22} x2={80} y2={22} color={p.muted} dashed />
    </G>
  ),
  'a-least-privilege': (p) => (
    <G>
      {[0, 1, 2].map((i) => (
        <G key={i} opacity={i === 1 ? 1 : 0.35}>
          <Rect x={14 + i * 34} y={14} width={26} height={36} rx={3} fill={p.paper} stroke={p.hue} strokeWidth={1.4} />
          <Lock x={20 + i * 34} y={22} s={0.7} fill={i === 1 ? p.ok : p.muted} ink={p.paper} />
        </G>
      ))}
      <Key x={44} y={60} s={0.9} fill={p.hue} />
    </G>
  ),
  'a-threat-modeling-llm': (p) => (
    <G>
      <Polyline points="18,58 40,24 70,40 100,18" fill="none" stroke={p.muted} strokeWidth={1.6} strokeDasharray="3 3" />
      <Polyline points="40,24 52,62 70,40" fill="none" stroke={p.muted} strokeWidth={1.6} strokeDasharray="3 3" />
      {[[18, 58], [40, 24], [70, 40], [100, 18], [52, 62]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={6} fill={i === 2 ? p.bad : p.hue} />
      ))}
      <Warn x={78} y={50} s={0.9} fill={p.warn} ink={p.paper} />
    </G>
  ),
  'a-secure-ai-lifecycle': (p) => (
    <G>
      <Path d="M60 14 A26 26 0 0 1 86 40" stroke={p.hue} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M86 40 A26 26 0 0 1 60 66" stroke={p.hue2} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M60 66 A26 26 0 0 1 34 40" stroke={p.hue} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
      <Path d="M34 40 A26 26 0 0 1 60 14" stroke={p.hue2} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
      <Polygon points="86,46 81,36 91,36" fill={p.hue} />
      <Polygon points="34,34 29,44 39,44" fill={p.hue} />
      <Shield x={50} y={26} s={0.85} fill={p.ok} ink={p.paper} />
    </G>
  ),
  'a-ai-risk-governance': (p) => (
    <G>
      <Line x1={60} y1={14} x2={60} y2={64} stroke={p.ink} strokeWidth={2} />
      <Line x1={30} y1={22} x2={90} y2={22} stroke={p.ink} strokeWidth={2} />
      <Path d="M22 42 L30 22 L38 42 Z" fill="none" stroke={p.muted} strokeWidth={1.2} />
      <Path d="M82 42 L90 22 L98 42 Z" fill="none" stroke={p.muted} strokeWidth={1.2} />
      <Rect x={18} y={42} width={24} height={5} rx={2} fill={p.hue} />
      <Rect x={78} y={42} width={24} height={5} rx={2} fill={p.hue2} />
      <Rect x={46} y={62} width={28} height={6} rx={2} fill={p.ink} />
    </G>
  ),

  // B: GenAI & LLM
  'b-prompt-injection': (p) => (
    <G>
      <Bubble x={10} y={12} w={52} h={26} fill={p.paper} />
      <Rect x={10} y={12} width={52} height={26} rx={6} fill="none" stroke={p.muted} strokeWidth={1} />
      <Line x1={17} y1={21} x2={50} y2={21} stroke={p.muted} strokeWidth={2} strokeLinecap="round" />
      <Line x1={17} y1={29} x2={44} y2={29} stroke={p.bad} strokeWidth={2.4} strokeLinecap="round" />
      <Arrow x1={50} y1={46} x2={78} y2={46} color={p.bad} />
      <Robot x={84} y={30} s={1.05} fill={p.hue} ink={p.paper} />
      <Warn x={88} y={8} s={0.8} fill={p.warn} ink={p.paper} />
    </G>
  ),
  'b-indirect-prompt-injection': (p) => (
    <G>
      <Rect x={10} y={10} width={44} height={56} rx={4} fill={p.paper} stroke={p.muted} strokeWidth={1.2} />
      <Globe cx={20} cy={18} r={4} color={p.hue2} />
      {[28, 36, 44].map((y) => <Line key={y} x1={16} y1={y} x2={48} y2={y} stroke={p.muted} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />)}
      <Line x1={16} y1={54} x2={44} y2={54} stroke={p.bad} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="2 2" />
      <Arrow x1={58} y1={54} x2={80} y2={44} color={p.bad} dashed />
      <Robot x={84} y={22} s={1.05} fill={p.hue} ink={p.paper} />
    </G>
  ),
  'b-sensitive-info-disclosure': (p) => (
    <G>
      <Rect x={16} y={10} width={48} height={60} rx={4} fill={p.paper} stroke={p.ink} strokeWidth={1.2} />
      {[20, 30, 40, 50, 60].map((y, i) => (
        <Rect key={y} x={22} y={y - 2} width={i % 2 ? 22 : 36} height={5} rx={1.5} fill={i % 2 ? p.ink : p.muted} opacity={i % 2 ? 0.9 : 0.4} />
      ))}
      <Lock x={74} y={26} s={1.4} fill={p.hue} ink={p.paper} />
    </G>
  ),
  'b-improper-output-handling': (p) => (
    <G>
      <Robot x={10} y={20} s={1} fill={p.hue} ink={p.paper} />
      <Path d="M44 34 l-6 6 l6 6 M56 34 l6 6 l-6 6 M53 32 l-6 16" stroke={p.hue2} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Rect x={70} y={14} width={42} height={48} rx={4} fill={p.paper} stroke={p.muted} strokeWidth={1.2} />
      <Rect x={70} y={14} width={42} height={8} rx={4} fill={p.muted} opacity={0.5} />
      <Warn x={81} y={32} s={1} fill={p.bad} ink={p.paper} />
    </G>
  ),
  'b-system-prompt-leakage': (p) => (
    <G>
      <Bubble x={22} y={10} w={60} h={30} fill={p.hue} />
      <Rect x={30} y={18} width={30} height={4} rx={2} fill={p.paper} />
      <Rect x={30} y={27} width={40} height={4} rx={2} fill={p.paper} opacity={0.7} />
      <Drop x={46} y={48} s={0.9} fill={p.bad} />
      <Drop x={60} y={56} s={0.7} fill={p.bad} />
      <Drop x={72} y={50} s={0.6} fill={p.bad} />
      <Doc x={88} y={42} w={22} h={28} fill={p.paper} ink={p.muted} lines={3} />
    </G>
  ),
  'b-data-poisoning': (p) => (
    <G>
      <Db x={44} y={30} w={34} h={40} fill={p.hue} ink={p.paper} />
      <Drop x={56} y={4} s={1.1} fill={p.bad} />
      <Arrow x1={61} y1={18} x2={61} y2={28} color={p.bad} />
      <Doc x={10} y={36} w={22} h={28} fill={p.paper} ink={p.muted} lines={3} />
      <Doc x={90} y={36} w={22} h={28} fill={p.paper} ink={p.muted} lines={3} />
    </G>
  ),
  'b-vector-embedding-weaknesses': (p) => (
    <G>
      {[[20, 20], [28, 28], [16, 32], [26, 16], [64, 50], [72, 58], [60, 60], [70, 46], [40, 54], [30, 60]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={3.4} fill={i < 4 ? p.hue : i < 8 ? p.hue2 : p.muted} />
      ))}
      <Circle cx={66} cy={24} r={4} fill={p.bad} />
      <Magnifier cx={92} cy={30} r={11} color={p.ink} />
    </G>
  ),
  'b-misinformation': (p) => (
    <G>
      <Doc x={14} y={12} w={40} h={54} fill={p.paper} ink={p.muted} lines={6} />
      <Circle cx={80} cy={30} r={16} fill={p.warn} />
      <Path d="M74 26 a6 6 0 1 1 8 5.6 v3" stroke={p.paper} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={82} cy={39.5} r={1.8} fill={p.paper} />
      <Check x={66} y={56} s={1} color={p.ok} />
      <Cross x={86} y={58} s={1} color={p.bad} />
    </G>
  ),
  'b-unbounded-consumption': (p) => (
    <G>
      <Path d="M24 60 A36 36 0 0 1 96 60" stroke={p.muted} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.35} />
      <Path d="M24 60 A36 36 0 0 1 60 24" stroke={p.ok} strokeWidth={8} fill="none" strokeLinecap="round" />
      <Path d="M60 24 A36 36 0 0 1 84 34" stroke={p.warn} strokeWidth={8} fill="none" />
      <Path d="M84 34 A36 36 0 0 1 96 60" stroke={p.bad} strokeWidth={8} fill="none" strokeLinecap="round" />
      <Line x1={60} y1={60} x2={88} y2={42} stroke={p.ink} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={60} cy={60} r={5} fill={p.ink} />
    </G>
  ),
  'b-supply-chain': (p) => (
    <G>
      {[0, 1, 2].map((i) => (
        <G key={i}>
          <Rect x={8 + i * 38} y={30} width={26} height={22} rx={3} fill={i === 1 ? p.bad : p.hue} />
          <Line x1={8 + i * 38} y1={38} x2={34 + i * 38} y2={38} stroke={p.paper} strokeWidth={1.4} opacity={0.7} />
        </G>
      ))}
      <Arrow x1={35} y1={41} x2={45} y2={41} color={p.muted} />
      <Arrow x1={73} y1={41} x2={83} y2={41} color={p.muted} />
      <Warn x={49} y={8} s={0.85} fill={p.warn} ink={p.paper} />
    </G>
  ),

  // C: agents
  'c-excessive-agency': (p) => (
    <G>
      <Robot x={48} y={22} s={1.05} fill={p.hue} ink={p.paper} />
      <Gear cx={16} cy={18} r={6} fill={p.hue2} hole={p.paper} />
      <Db x={6} y={50} w={18} h={20} fill={p.hue2} ink={p.paper} />
      <Globe cx={104} cy={18} r={8} color={p.hue2} />
      <Terminal x={92} y={48} w={24} h={20} fill={p.ink} bar={p.bad} ink={p.paper} />
      <Arrow x1={46} y1={30} x2={26} y2={20} color={p.muted} />
      <Arrow x1={46} y1={48} x2={28} y2={58} color={p.muted} />
      <Arrow x1={76} y1={30} x2={94} y2={20} color={p.muted} />
      <Arrow x1={76} y1={48} x2={90} y2={56} color={p.bad} />
    </G>
  ),
  'c-mcp-security': (p) => (
    <G>
      <Robot x={8} y={22} s={1} fill={p.hue} ink={p.paper} />
      <Rect x={84} y={18} width={28} height={40} rx={4} fill={p.hue2} />
      {[26, 34, 42].map((y) => <Circle key={y} cx={92} cy={y} r={2} fill={p.paper} />)}
      <Path d="M34 40 C50 40 50 30 60 30 S72 40 84 40" stroke={p.ink} strokeWidth={2.4} fill="none" />
      <Lock x={50} y={44} s={0.9} fill={p.ok} ink={p.paper} />
    </G>
  ),
  'c-human-approval': (p) => (
    <G>
      <Robot x={8} y={24} s={1} fill={p.hue} ink={p.paper} />
      <Doc x={44} y={18} w={28} h={36} fill={p.paper} ink={p.muted} lines={4} />
      <Arrow x1={34} y1={36} x2={42} y2={36} color={p.muted} />
      <Person x={86} y={26} s={1.1} fill={p.hue2} />
      <Circle cx={74} cy={58} r={9} fill={p.ok} />
      <Check x={68.5} y={53} s={0.9} color={p.paper} />
    </G>
  ),
  'c-agent-identity': (p) => (
    <G>
      <Rect x={22} y={14} width={64} height={46} rx={6} fill={p.paper} stroke={p.hue} strokeWidth={1.6} />
      <Rect x={22} y={14} width={64} height={10} rx={5} fill={p.hue} />
      <Robot x={30} y={28} s={0.75} fill={p.hue2} ink={p.paper} />
      {[34, 42, 50].map((y) => <Line key={y} x1={56} y1={y} x2={78} y2={y} stroke={p.muted} strokeWidth={1.8} strokeLinecap="round" />)}
      <Key x={84} y={58} s={0.9} fill={p.warn} />
    </G>
  ),
  'c-memory-poisoning': (p) => (
    <G>
      <Path d="M36 56 C18 56 18 34 32 32 C30 18 50 12 58 22 C66 10 90 16 86 32 C100 34 98 56 82 56 Z" fill={p.hue} />
      {[[44, 36], [60, 32], [74, 40], [52, 46]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={3} fill={p.paper} opacity={0.8} />)}
      <Drop x={64} y={42} s={1} fill={p.bad} />
      <Line x1={44} y1={36} x2={60} y2={32} stroke={p.paper} strokeWidth={1.2} opacity={0.7} />
      <Line x1={60} y1={32} x2={74} y2={40} stroke={p.paper} strokeWidth={1.2} opacity={0.7} />
    </G>
  ),
  'c-unsafe-tool-execution': (p) => (
    <G>
      <Terminal x={14} y={14} w={64} h={48} fill={p.ink} bar={p.hue} ink={p.paper} />
      <Line x1={20} y1={50} x2={56} y2={50} stroke={p.bad} strokeWidth={2} strokeLinecap="round" />
      <Warn x={84} y={22} s={1.4} fill={p.bad} ink={p.paper} />
      <Gear cx={96} cy={60} r={6} fill={p.hue2} hole={p.paper} />
    </G>
  ),
  'c-multi-agent-trust': (p) => (
    <G>
      <Robot x={4} y={24} s={0.85} fill={p.hue} ink={p.paper} />
      <Robot x={48} y={24} s={0.85} fill={p.bad} ink={p.paper} />
      <Robot x={92} y={24} s={0.85} fill={p.hue} ink={p.paper} />
      <Arrow x1={28} y1={38} x2={44} y2={38} color={p.muted} />
      <Arrow x1={72} y1={38} x2={88} y2={38} color={p.bad} dashed />
      <Shield x={50} y={58} s={0.6} fill={p.ok} ink={p.paper} />
    </G>
  ),
  'c-agent-monitoring': (p) => (
    <G>
      <Rect x={10} y={30} width={64} height={40} rx={4} fill={p.paper} stroke={p.muted} strokeWidth={1.2} />
      <Polyline points="16,60 28,52 38,56 50,40 60,46 68,36" fill="none" stroke={p.hue} strokeWidth={2.4} strokeLinejoin="round" />
      <Circle cx={50} cy={40} r={3} fill={p.bad} />
      <Path d="M80 26 Q96 10 112 26 Q96 42 80 26 Z" fill={p.hue2} />
      <Circle cx={96} cy={26} r={5} fill={p.paper} />
      <Circle cx={96} cy={26} r={2.4} fill={p.ink} />
    </G>
  ),

  // D: testing
  'd-test-planning': (p) => (
    <G>
      <Rect x={30} y={12} width={50} height={60} rx={5} fill={p.paper} stroke={p.ink} strokeWidth={1.2} />
      <Rect x={44} y={8} width={22} height={8} rx={3} fill={p.hue} />
      {[26, 40, 54].map((y, i) => (
        <G key={y}>
          {i < 2 ? <Check x={36} y={y - 4} s={0.8} color={p.ok} /> : <Rect x={36} y={y - 4} width={9} height={9} rx={2} fill="none" stroke={p.muted} strokeWidth={1.4} />}
          <Line x1={50} y1={y} x2={72} y2={y} stroke={p.muted} strokeWidth={1.8} strokeLinecap="round" />
        </G>
      ))}
      <Circle cx={96} cy={52} r={12} fill={p.hue2} opacity={0.9} />
      <Line x1={96} y1={52} x2={96} y2={45} stroke={p.paper} strokeWidth={2} strokeLinecap="round" />
      <Line x1={96} y1={52} x2={101} y2={55} stroke={p.paper} strokeWidth={2} strokeLinecap="round" />
    </G>
  ),
  'd-test-case-design': (p) => (
    <G>
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => (
        <Rect key={`${r}${c}`} x={20 + c * 21} y={14 + r * 19} width={18} height={16} rx={3} fill={p.paper} stroke={p.muted} strokeWidth={1} />
      )))}
      <Check x={24} y={17} s={0.8} color={p.ok} />
      <Check x={66} y={36} s={0.8} color={p.ok} />
      <Cross x={46} y={18} s={0.9} color={p.bad} />
      <Cross x={88} y={56} s={0.9} color={p.bad} />
      <Rect x={41} y={52} width={18} height={16} rx={3} fill={p.hue} />
    </G>
  ),
  'd-severity-reporting': (p) => (
    <G>
      {[p.ok, p.warn, p.hue2, p.bad].map((c, i) => (
        <Rect key={i} x={14 + i * 16} y={62 - (i + 1) * 11} width={11} height={(i + 1) * 11} rx={2} fill={c} />
      ))}
      <Line x1={10} y1={63} x2={80} y2={63} stroke={p.ink} strokeWidth={1.4} />
      <Doc x={86} y={18} w={26} h={36} fill={p.paper} ink={p.muted} lines={4} />
    </G>
  ),
  'd-red-teaming': (p) => (
    <G>
      <Circle cx={50} cy={42} r={26} fill={p.paper} stroke={p.bad} strokeWidth={4} />
      <Circle cx={50} cy={42} r={16} fill="none" stroke={p.bad} strokeWidth={4} />
      <Circle cx={50} cy={42} r={6} fill={p.bad} />
      <Line x1={102} y1={12} x2={54} y2={39} stroke={p.ink} strokeWidth={2.4} strokeLinecap="round" />
      <Polygon points="102,12 110,10 106,18" fill={p.hue} />
    </G>
  ),
  'd-guardrail-evals': (p) => (
    <G>
      {[[18, 10], [30, 14], [42, 8], [54, 14], [66, 10], [78, 14], [90, 8]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={3.2} fill={i % 3 === 1 ? p.bad : p.hue2} />
      ))}
      <Path d="M14 22 H96 L64 48 V66 L46 72 V48 Z" fill={p.hue} />
      <Circle cx={56} cy={76} r={3} fill={p.ok} />
      <Cross x={100} y={34} s={0.9} color={p.bad} />
      <Arrow x1={88} y1={30} x2={98} y2={36} color={p.bad} dashed />
    </G>
  ),

  // E: career
  'e-ai-security-roles': (p) => (
    <G>
      <Person x={16} y={30} s={1} fill={p.hue2} />
      <Person x={50} y={22} s={1.2} fill={p.hue} />
      <Person x={88} y={30} s={1} fill={p.ok} />
      <Shield x={56} y={4} s={0.5} fill={p.hue} />
    </G>
  ),
  'e-explaining-findings': (p) => (
    <G>
      <Rect x={10} y={10} width={66} height={44} rx={4} fill={p.paper} stroke={p.ink} strokeWidth={1.2} />
      <Line x1={43} y1={54} x2={43} y2={68} stroke={p.ink} strokeWidth={2} />
      {[0, 1, 2].map((i) => <Rect key={i} x={20 + i * 16} y={42 - (i + 1) * 8} width={10} height={(i + 1) * 8} rx={2} fill={i === 2 ? p.bad : p.hue} />)}
      <Person x={86} y={30} s={1.1} fill={p.hue2} />
      <Line x1={84} y1={40} x2={70} y2={30} stroke={p.hue2} strokeWidth={2.4} strokeLinecap="round" />
    </G>
  ),

  // F: supporting knowledge
  'f-llm-context': (p) => (
    <G>
      <Rect x={20} y={10} width={58} height={60} rx={5} fill={p.paper} stroke={p.hue} strokeWidth={2} />
      {[20, 28, 36, 44, 52, 60].map((y, i) => <Line key={y} x1={27} y1={y} x2={i % 2 ? 62 : 70} y2={y} stroke={i > 3 ? p.hue2 : p.muted} strokeWidth={2} strokeLinecap="round" opacity={i > 3 ? 1 : 0.5} />)}
      <Line x1={86} y1={10} x2={86} y2={70} stroke={p.warn} strokeWidth={2} strokeDasharray="3 3" />
      <Polygon points="86,10 96,15 86,20" fill={p.warn} />
    </G>
  ),
  'f-ml-lifecycle': (p) => (
    <G>
      <Db x={6} y={28} w={20} h={24} fill={p.hue2} ink={p.paper} />
      <Gear cx={52} cy={40} r={8} fill={p.hue} hole={p.paper} />
      <Rect x={84} y={28} width={28} height={24} rx={4} fill={p.ok} />
      <Check x={92} y={34} s={0.9} color={p.paper} />
      <Arrow x1={28} y1={40} x2={40} y2={40} color={p.muted} />
      <Arrow x1={64} y1={40} x2={82} y2={40} color={p.muted} />
    </G>
  ),
  'f-rag-basics': (p) => (
    <G>
      <Doc x={8} y={14} w={22} h={28} fill={p.paper} ink={p.muted} lines={3} />
      <Doc x={16} y={36} w={22} h={28} fill={p.paper} ink={p.muted} lines={3} />
      <Magnifier cx={54} cy={36} r={9} color={p.hue2} />
      <Arrow x1={70} y1={44} x2={80} y2={44} color={p.muted} />
      <Bubble x={82} y={30} w={32} h={22} fill={p.hue} />
      <Line x1={88} y1={39} x2={108} y2={39} stroke={p.paper} strokeWidth={2} strokeLinecap="round" />
    </G>
  ),
  'f-embeddings': (p) => (
    <G>
      <Line x1={20} y1={66} x2={104} y2={66} stroke={p.ink} strokeWidth={1.4} />
      <Line x1={20} y1={66} x2={20} y2={10} stroke={p.ink} strokeWidth={1.4} />
      <Arrow x1={20} y1={66} x2={74} y2={22} color={p.hue} />
      <Arrow x1={20} y1={66} x2={84} y2={32} color={p.hue2} />
      <Arrow x1={20} y1={66} x2={54} y2={60} color={p.muted} />
      <Path d="M40 50 A20 20 0 0 1 44 44" stroke={p.warn} strokeWidth={2} fill="none" />
    </G>
  ),
  'f-tool-calling': (p) => (
    <G>
      <Robot x={10} y={22} s={1.05} fill={p.hue} ink={p.paper} />
      <Bubble x={42} y={10} w={34} h={18} fill={p.hue2} />
      <Path d="M50 19 h18" stroke={p.paper} strokeWidth={2} strokeLinecap="round" />
      <Arrow x1={44} y1={46} x2={74} y2={46} color={p.muted} />
      <Path d="M86 34 a8 8 0 1 0 10 10 l12 12 l4 -4 l-12 -12 a8 8 0 0 0 -10 -10 l5 5 l-4 4 Z" fill={p.ink} />
    </G>
  ),
};

/** Labs reuse the scene of the lesson they practise. */
const labScene: Record<string, string> = {
  'lab-prompt-injection': 'b-prompt-injection',
  'lab-output-xss': 'b-improper-output-handling',
  'lab-sensitive-data': 'b-sensitive-info-disclosure',
  'lab-rag-access': 'b-vector-embedding-weaknesses',
  'lab-excessive-agency': 'c-excessive-agency',
  'lab-tool-calls': 'c-unsafe-tool-execution',
  'lab-mcp-authorization': 'c-mcp-security',
  'lab-human-approval': 'c-human-approval',
  'lab-guardrail-eval': 'd-guardrail-evals',
  'lab-logging-monitoring': 'c-agent-monitoring',
};

const roadmapByLetter: Record<string, string> = {
  a: 'ai-security-foundations',
  b: 'genai-llm-security',
  c: 'agent-security',
  d: 'ai-security-testing',
  e: 'interview-career',
  f: 'ai-fundamentals',
};

/**
 * The scene for a roadmap, lesson or lab id. Content added over the air without its own art falls back to its
 * roadmap's scene (by the lesson id's letter prefix), so every item still gets a picture.
 */
export function sceneFor(id: string): { scene: Scene; roadmapId: string } {
  const key = labScene[id] ?? id;
  if (roadmaps[key]) return { scene: roadmaps[key], roadmapId: key };
  const roadmapId = roadmapByLetter[key.charAt(0)] ?? 'ai-security-foundations';
  return { scene: lessons[key] ?? roadmaps[roadmapId]!, roadmapId };
}

export const SCENE_IDS = { roadmaps: Object.keys(roadmaps), lessons: Object.keys(lessons), labs: Object.keys(labScene) };
