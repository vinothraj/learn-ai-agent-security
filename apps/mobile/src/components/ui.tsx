import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHaptics, useTheme } from '@/theme/ThemeProvider';
import { font, radius, space } from '@/theme/tokens';

type Variant = keyof typeof font;

export function T({
  v = 'body',
  muted,
  color,
  style,
  children,
  ...rest
}: {
  v?: Variant;
  muted?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  accessibilityRole?: 'header';
}) {
  const { theme } = useTheme();
  return (
    <Text
      {...rest}
      style={[font[v], { color: color ?? (muted ? theme.textMuted : theme.text) }, style]}
      maxFontSizeMultiplier={1.6}>
      {children}
    </Text>
  );
}

/** Scrollable page with safe-area padding and a large title. */
export function Screen({
  title,
  subtitle,
  right,
  children,
  scroll = true,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const header = title ? (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <T v="display" accessibilityRole="header">
          {title}
        </T>
        {subtitle ? <T muted>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  ) : null;
  const pad = { paddingTop: insets.top + space.md, paddingHorizontal: space.lg };
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: theme.bg }, pad]}>
        {header}
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={[pad, { paddingBottom: space.xxl * 2, gap: space.lg }]}>
      {header}
      {children}
    </ScrollView>
  );
}

/** Staggered entrance, skipped when motion is reduced. */
export function Appear({ index = 0, children }: { index?: number; children: ReactNode }) {
  const { animate } = useTheme();
  if (!animate) return <>{children}</>;
  return <Animated.View entering={FadeInDown.duration(380).delay(index * 60)}>{children}</Animated.View>;
}

export function Card({
  children,
  onPress,
  style,
  accent,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  const haptic = useHaptics();
  const base: ViewStyle = {
    backgroundColor: accent ? theme.accentSoft : theme.surface,
    borderColor: accent ? theme.accent + '66' : theme.border,
    borderWidth: StyleSheet.hairlineWidth * (theme.mode === 'contrast' ? 4 : 2),
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptic('tap');
        onPress();
      }}
      style={({ pressed }) => [base, style, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}>
      {children}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon: Icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: LucideIcon;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const haptic = useHaptics();
  const bg =
    kind === 'primary' ? theme.accent : kind === 'secondary' ? theme.surfaceAlt : kind === 'danger' ? theme.danger : 'transparent';
  const fg = kind === 'primary' ? theme.onAccent : kind === 'danger' ? '#FFFFFF' : kind === 'ghost' ? theme.accent : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic('tap');
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        kind === 'secondary' && { borderWidth: 1, borderColor: theme.border },
        style,
      ]}>
      {Icon ? <Icon size={18} color={fg} /> : null}
      <Text style={[font.heading, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const { theme } = useTheme();
  const haptic = useHaptics();
  const c = color ?? theme.accent;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={() => {
        haptic('select');
        onPress?.();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c : theme.surfaceAlt,
          borderColor: selected ? c : theme.border,
        },
      ]}>
      <Text style={[font.label, { color: selected ? theme.onAccent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, color }: { label: string; color?: string }) {
  const { theme } = useTheme();
  const c = color ?? theme.accent;
  return (
    <View style={[styles.tag, { backgroundColor: c + '22', borderColor: c + '55' }]}>
      <Text style={[font.caption, { color: c }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const { theme } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ height, borderRadius: height, backgroundColor: theme.surfaceAlt, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          height: '100%',
          borderRadius: height,
          backgroundColor: color ?? theme.accent,
        }}
      />
    </View>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <T v="title" accessibilityRole="header">
        {children}
      </T>
      {action}
    </View>
  );
}

export function IconBadge({ icon: Icon, color, size = 40 }: { icon: LucideIcon; color?: string; size?: number }) {
  const { theme } = useTheme();
  const c = color ?? theme.accent;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        backgroundColor: c + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon size={size * 0.5} color={c} />
    </View>
  );
}

export function Row({
  children,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessible={accessibilityLabel ? true : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
});
