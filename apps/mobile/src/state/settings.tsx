import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import type { AccentKey, ThemeMode } from '@/theme/tokens';

export interface Settings {
  onboarded: boolean;
  displayName: string;
  themeMode: ThemeMode;
  accent: AccentKey;
  motion: 'full' | 'reduced';
  haptics: boolean;
  gamification: boolean;
  goalMinutes: number;
  focusRoadmapId: string;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  /** Interview prep target role id. */
  targetRole: string;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  displayName: '',
  themeMode: 'dark',
  accent: 'teal',
  motion: 'full',
  haptics: true,
  gamification: true,
  goalMinutes: 10,
  focusRoadmapId: 'genai-llm-security',
  reminderEnabled: false,
  reminderHour: 20,
  reminderMinute: 0,
  targetRole: 'ai-security-engineer',
};

interface SettingsCtx {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', 'settings').then((row) => {
      let stored: Partial<Settings> = {};
      try {
        stored = row ? (JSON.parse(row.value) as Partial<Settings>) : {};
      } catch {
        // Corrupt settings fall back to defaults rather than blocking app start.
      }
      setSettings({ ...DEFAULT_SETTINGS, ...stored });
    });
  }, [db]);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...(settings ?? DEFAULT_SETTINGS), ...patch };
      setSettings(next);
      await db.runAsync(
        'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        'settings',
        JSON.stringify(next),
      );
    },
    [db, settings],
  );

  if (!settings) return null; // splash screen stays visible until settings load
  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
