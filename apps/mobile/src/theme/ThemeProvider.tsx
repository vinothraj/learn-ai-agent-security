import * as Haptics from 'expo-haptics';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useSettings } from '@/state/settings';
import { buildTheme, type Theme } from './tokens';

interface ThemeCtx {
  theme: Theme;
  /** False when the learner or the OS asked for reduced motion. */
  animate: boolean;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const system = useColorScheme();
  const osReduced = useReducedMotion();

  const value = useMemo<ThemeCtx>(() => {
    const mode =
      settings.themeMode === 'system' ? (system === 'light' ? 'light' : 'dark') : settings.themeMode;
    return {
      theme: buildTheme(mode, settings.accent),
      animate: settings.motion === 'full' && !osReduced,
    };
  }, [settings.themeMode, settings.accent, settings.motion, system, osReduced]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

type HapticKind = 'tap' | 'select' | 'success' | 'error';

export function useHaptics() {
  const { settings } = useSettings();
  return (kind: HapticKind) => {
    if (!settings.haptics) return;
    switch (kind) {
      case 'tap':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'select':
        return Haptics.selectionAsync();
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
}
