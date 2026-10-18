import type { Lab } from '@laas/shared';
import { Bot, Database, Globe, Server, Skull, UserRound, Wrench, type LucideIcon } from '@/components/icons';
import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Row, T } from './ui';

const KIND_ICON: Record<Lab['nodes'][number]['kind'], LucideIcon> = {
  user: UserRound,
  attacker: Skull,
  app: Server,
  model: Bot,
  tool: Wrench,
  data: Database,
  external: Globe,
};

const COLS = 4;
const ROW_H = 96;
const NODE_H = 58;

/**
 * Data-flow diagram of a fictional lab system. Nodes sit on a 4x3 grid; each node's left
 * stripe shows its trust zone, and untrusted flows are drawn dashed in red.
 * Tap a node to read what it does.
 */
export function ArchitectureDiagram({ lab, highlight }: { lab: Lab; highlight?: string[] }) {
  const { theme } = useTheme();
  const haptic = useHaptics();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const trustColor = (trust: string) =>
    trust === 'untrusted' ? theme.danger : trust === 'external' ? theme.warning : theme.success;
  const zoneById = new Map(lab.zones.map((z) => [z.id, z]));
  const rows = Math.max(...lab.nodes.map((n) => n.y)) + 1;
  const cellW = width / COLS;
  const nodeW = Math.max(0, cellW - 16);
  const center = (n: { x: number; y: number }) => ({ x: n.x * cellW + cellW / 2, y: n.y * ROW_H + ROW_H / 2 });
  const byId = new Map(lab.nodes.map((n) => [n.id, n]));
  const sel = selected ? byId.get(selected) : undefined;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={{ gap: space.sm }}>
      <View
        onLayout={onLayout}
        style={{ height: rows * ROW_H }}
        accessible={false}
        accessibilityLabel={`Architecture of ${lab.system}`}>
        {width > 0 ? (
          <>
            <Svg width={width} height={rows * ROW_H} style={{ position: 'absolute' }}>
              {lab.edges.map((e, i) => {
                const a = byId.get(e.from)!;
                const b = byId.get(e.to)!;
                const p = center(a);
                const q = center(b);
                const dx = q.x - p.x;
                const dy = q.y - p.y;
                const len = Math.hypot(dx, dy) || 1;
                // Clip the line to both (equal-sized) boxes so the arrowhead stays visible.
                const t = Math.min(dx ? nodeW / 2 / Math.abs(dx) : Infinity, dy ? NODE_H / 2 / Math.abs(dy) : Infinity);
                const end = { x: q.x - dx * t, y: q.y - dy * t };
                const start = { x: p.x + dx * t, y: p.y + dy * t };
                const ux = dx / len;
                const uy = dy / len;
                const head = `${end.x},${end.y} ${end.x - ux * 9 - uy * 5},${end.y - uy * 9 + ux * 5} ${end.x - ux * 9 + uy * 5},${end.y - uy * 9 - ux * 5}`;
                const color = e.untrusted ? theme.danger : theme.textMuted;
                const hot = highlight?.includes(e.from) && highlight?.includes(e.to);
                return (
                  <G key={i}>
                    <Line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke={hot ? theme.danger : color}
                      strokeWidth={hot ? 3 : e.untrusted ? 2 : 1.4}
                      strokeDasharray={e.untrusted ? '6 4' : undefined}
                      opacity={hot || !highlight ? 1 : 0.55}
                    />
                    <Polygon points={head} fill={hot ? theme.danger : color} />
                    {e.label && Math.hypot(end.x - start.x, end.y - start.y) >= 56 ? (
                      <SvgText
                        // Offset to the side of the line so the label never sits on it.
                        x={(start.x + end.x) / 2 - uy * 9}
                        y={(start.y + end.y) / 2 + ux * 9 + 3}
                        fill={e.untrusted ? theme.danger : theme.textMuted}
                        fontSize={9}
                        textAnchor="middle">
                        {e.label}
                      </SvgText>
                    ) : null}
                  </G>
                );
              })}
            </Svg>
            {lab.nodes.map((n) => {
              const c = center(n);
              const Icon = KIND_ICON[n.kind];
              const zone = zoneById.get(n.zone);
              const isSel = selected === n.id;
              const isHot = highlight?.includes(n.id);
              return (
                <Pressable
                  key={n.id}
                  onPress={() => {
                    haptic('select');
                    setSelected(isSel ? null : n.id);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={`${n.label}, ${zone?.label ?? ''}. ${n.info}`}
                  style={{
                    position: 'absolute',
                    left: c.x - nodeW / 2,
                    top: c.y - NODE_H / 2,
                    width: nodeW,
                    height: NODE_H,
                    borderRadius: radius.sm,
                    backgroundColor: n.kind === 'attacker' ? theme.danger + '22' : theme.surfaceAlt,
                    borderWidth: isSel || isHot ? 2 : 1,
                    borderColor: isSel ? theme.accent : isHot ? theme.danger : theme.border,
                    borderLeftWidth: 4,
                    borderLeftColor: trustColor(zone?.trust ?? 'trusted'),
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 2,
                    gap: 2,
                  }}>
                  <Icon size={16} color={n.kind === 'attacker' ? theme.danger : theme.accent} />
                  <T v="caption" numberOfLines={2} style={{ textAlign: 'center', fontSize: 10, lineHeight: 12 }}>
                    {n.label}
                  </T>
                </Pressable>
              );
            })}
          </>
        ) : null}
      </View>
      <Row style={{ flexWrap: 'wrap', gap: space.md }}>
        {lab.zones.map((z) => (
          <Row key={z.id} style={{ gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: trustColor(z.trust) }} />
            <T v="caption" muted>
              {z.label}
            </T>
          </Row>
        ))}
        <Row style={{ gap: 6 }}>
          <View style={{ width: 16, borderTopWidth: 2, borderStyle: 'dashed', borderColor: theme.danger }} />
          <T v="caption" muted>
            Untrusted data
          </T>
        </Row>
      </Row>
      {sel ? (
        <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: radius.md, padding: space.md, gap: 2 }}>
          <T v="label">{sel.label}</T>
          <T v="caption" muted>
            {zoneById.get(sel.zone)?.label}
          </T>
          <T>{sel.info}</T>
        </View>
      ) : (
        <T v="caption" muted>
          Tap any component to inspect it.
        </T>
      )}
    </View>
  );
}
