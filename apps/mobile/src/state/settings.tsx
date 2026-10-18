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
  /** Evening recap of today's activity (only sent on days with activity). */
  recapEnabled: boolean;
  /** Sunday summary of the week. */
  weeklyReportEnabled: boolean;
  recapHour: number;
  recapMinute: number;
  /** Quiet hours [start, end) in local hours; equal values turn quiet hours off. */
  quietStart: number;
  quietEnd: number;
  /** Server push for human-approved, high-impact advisories (needs an account and a store build). */
  advisoriesPush: boolean;
  /** Server push when new lessons are published. */
  contentPush: boolean;
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
  recapEnabled: false,
  weeklyReportEnabled: false,
  recapHour: 21,
  recapMinute: 0,
  quietStart: 22,
  quietEnd: 7,
  advisoriesPush: false,
  contentPush: false,
  targetRole: 'ai-security-engineer',
};

interface SettingsCtx {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  /** Re-read from the database (after cloud sync changed profile fields). */
  reload: () => Promise<void>;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings | null>(null);

  const read = useCallback(async (): Promise<Settings> => {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', 'settings');
    let stored: Partial<Settings> = {};
    try {
      stored = row ? (JSON.parse(row.value) as Partial<Settings>) : {};
    } catch {
      // Corrupt settings fall back to defaults rather than blocking app start.
    }
    return { ...DEFAULT_SETTINGS, ...stored };
  }, [db]);

  useEffect(() => {
    read().then(setSettings);
  }, [read]);

  const reload = useCallback(async () => setSettings(await read()), [read]);

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
  return <Ctx.Provider value={{ settings, update, reload }}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
