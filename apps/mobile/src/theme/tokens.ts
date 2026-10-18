export type ThemeMode = 'system' | 'dark' | 'light' | 'amoled' | 'contrast';
export type ResolvedMode = Exclude<ThemeMode, 'system'>;
export type AccentKey = 'teal' | 'violet' | 'blue' | 'green' | 'amber' | 'pink';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  ringPractice: string;
  ringLessons: string;
  overlay: string;
}

const palettes: Record<ResolvedMode, Palette> = {
  dark: {
    bg: '#0B1020',
    surface: '#121A33',
    surfaceAlt: '#1A2347',
    border: '#26315C',
    text: '#E8ECF8',
    textMuted: '#9AA4C7',
    success: '#34D399',
    danger: '#F87171',
    warning: '#FBBF24',
    info: '#60A5FA',
    ringPractice: '#A78BFA',
    ringLessons: '#FBBF24',
    overlay: 'rgba(5,8,20,0.7)',
  },
  light: {
    bg: '#F4F6FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EBEFF8',
    border: '#D7DDEC',
    text: '#0E1430',
    textMuted: '#525C80',
    success: '#047857',
    danger: '#B91C1C',
    warning: '#B45309',
    info: '#1D4ED8',
    ringPractice: '#7C3AED',
    ringLessons: '#D97706',
    overlay: 'rgba(14,20,48,0.4)',
  },
  amoled: {
    bg: '#000000',
    surface: '#0B0B12',
    surfaceAlt: '#15151F',
    border: '#24243A',
    text: '#EDEDF7',
    textMuted: '#9C9CB5',
    success: '#34D399',
    danger: '#F87171',
    warning: '#FBBF24',
    info: '#60A5FA',
    ringPractice: '#A78BFA',
    ringLessons: '#FBBF24',
    overlay: 'rgba(0,0,0,0.75)',
  },
  contrast: {
    bg: '#000000',
    surface: '#000000',
    surfaceAlt: '#111111',
    border: '#FFFFFF',
    text: '#FFFFFF',
    textMuted: '#E6E6E6',
    success: '#5CFF9D',
    danger: '#FF6B6B',
    warning: '#FFD60A',
    info: '#7CC4FF',
    ringPractice: '#D0B3FF',
    ringLessons: '#FFD60A',
    overlay: 'rgba(0,0,0,0.85)',
  },
};

/** Accent shades tuned for WCAG AA contrast against each background family. */
export const ACCENTS: Record<AccentKey, { label: string; onDark: string; onLight: string }> = {
  teal: { label: 'Cyber teal', onDark: '#2DD4BF', onLight: '#0F766E' },
  violet: { label: 'Violet', onDark: '#A78BFA', onLight: '#6D28D9' },
  blue: { label: 'Signal blue', onDark: '#60A5FA', onLight: '#1D4ED8' },
  green: { label: 'Matrix green', onDark: '#4ADE80', onLight: '#15803D' },
  amber: { label: 'Amber', onDark: '#FBBF24', onLight: '#B45309' },
  pink: { label: 'Neon pink', onDark: '#F472B6', onLight: '#BE185D' },
};

export interface Theme extends Palette {
  mode: ResolvedMode;
  isDark: boolean;
  accent: string;
  /** Text/icon color on top of a solid accent fill. */
  onAccent: string;
  accentSoft: string;
}

export function buildTheme(mode: ResolvedMode, accent: AccentKey): Theme {
  const p = palettes[mode];
  const isDark = mode !== 'light';
  const a = isDark ? ACCENTS[accent].onDark : ACCENTS[accent].onLight;
  return {
    ...p,
    mode,
    isDark,
    accent: a,
    onAccent: isDark ? '#04111A' : '#FFFFFF',
    accentSoft: a + (isDark ? '26' : '1A'),
  };
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const font = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  mono: { fontSize: 13, lineHeight: 19, fontFamily: 'monospace' },
};
