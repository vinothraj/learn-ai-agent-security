import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { SyncResponse } from '@laas/shared';

import { resetAllProgress } from '@/db/repo';
import { api, ApiError, cloud, cloudConfigured, devSignIn, freshSession, loadSession, requestCode, saveSession, verifyCode, type Session } from '@/sync/auth';
import { uploadAnalytics } from '@/sync/analytics';
import { enqueueAll, lastSyncAt as readLastSync, resetSyncState, runSync } from '@/sync/engine';
import { useProgress } from './progress';
import { useSettings } from './settings';

const AUTO_SYNC_MS = 5 * 60_000;
const OWNER_KEY = 'sync_owner_id';

export interface Profile {
  id: string;
  email: string | null;
  role: 'learner' | 'editor' | 'admin' | 'super_admin';
  displayName: string;
}

interface SyncCtx {
  configured: boolean;
  authMode: 'dev' | 'supabase';
  session: Session | null;
  profile: Profile | null;
  syncing: boolean;
  lastSyncAt: number | null;
  error: string | null;
  sendCode: (email: string) => Promise<void>;
  /** Supabase: verifies the emailed code. Dev mode: signs in directly (code ignored). */
  signIn: (email: string, code: string, opts?: { replaceLocal?: boolean }) => Promise<'ok' | 'other-account'>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  exportData: () => Promise<unknown>;
  /** Authenticated API call; throws if signed out. */
  call: <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;
  deleteAccount: (eraseLocal: boolean) => Promise<{ authAccountDeleted: boolean }>;
}

const Ctx = createContext<SyncCtx | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { refresh } = useProgress();
  const { reload } = useSettings();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const sessionRef = useRef<Session | null>(null);

  const withSession = useCallback(async () => {
    if (!sessionRef.current) throw new Error('Not signed in');
    const s = await freshSession(sessionRef.current);
    sessionRef.current = s;
    return s;
  }, []);

  const syncNow = useCallback(async () => {
    if (!cloudConfigured || !sessionRef.current || busy.current) return;
    busy.current = true;
    setSyncing(true);
    setError(null);
    try {
      const s = await withSession();
      const result = await runSync(db, (body) => api<SyncResponse>(s, '/v1/sync', { method: 'POST', body }));
      setLastSync(result.lastSyncAt);
      // Opt-in usage statistics ride along with sync; failures never affect progress sync.
      await uploadAnalytics(db, (path, init) => api(s, path, init)).catch(() => 0);
      if (result.pulled > 0) {
        await reload();
        await refresh();
      }
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Your session expired. Please sign in again.' : 'Sync failed. Your progress is safe on this device and will sync later.');
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [db, refresh, reload, withSession]);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await api<Profile>(await withSession(), '/v1/me'));
    } catch {
      // Offline: keep the cached session, profile stays unknown until next try.
    }
  }, [withSession]);

  // Restore the session on start; sync on resume and periodically while active.
  useEffect(() => {
    if (!cloudConfigured) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    loadSession().then(async (s) => {
      setLastSync(await readLastSync(db));
      if (!s) return;
      sessionRef.current = s;
      setSession(s);
      loadProfile();
      syncNow();
      timer = setInterval(() => AppState.currentState === 'active' && syncNow(), AUTO_SYNC_MS);
    });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') syncNow();
    });
    return () => {
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, [db, loadProfile, syncNow]);

  const sendCode = useCallback(async (email: string) => {
    if (cloud.authMode === 'supabase') await requestCode(email.trim().toLowerCase());
  }, []);

  const signIn = useCallback(
    async (email: string, code: string, opts: { replaceLocal?: boolean } = {}) => {
      const s = cloud.authMode === 'dev' ? await devSignIn(email.trim()) : await verifyCode(email.trim().toLowerCase(), code.trim());
      // Never merge one person's local progress into another person's account.
      const owner = (await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', OWNER_KEY))?.value;
      if (owner && owner !== s.userId) {
        if (!opts.replaceLocal) return 'other-account';
        await resetAllProgress(db);
        await resetSyncState(db);
      }
      await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', OWNER_KEY, s.userId);
      await saveSession(s);
      sessionRef.current = s;
      setSession(s);
      await enqueueAll(db); // first sign-in: back up everything already on this device
      await loadProfile();
      await syncNow();
      return 'ok';
    },
    [db, loadProfile, syncNow],
  );

  const signOut = useCallback(async () => {
    await saveSession(null);
    sessionRef.current = null;
    setSession(null);
    setProfile(null);
  }, []);

  const exportData = useCallback(async () => api<unknown>(await withSession(), '/v1/me/export'), [withSession]);
  const call = useCallback(async <T,>(path: string, init?: { method?: string; body?: unknown }) => api<T>(await withSession(), path, init), [withSession]);

  const deleteAccount = useCallback(
    async (eraseLocal: boolean) => {
      const r = await api<{ authAccountDeleted: boolean }>(await withSession(), '/v1/me', { method: 'DELETE' });
      await resetSyncState(db);
      await db.runAsync('DELETE FROM kv WHERE key = ?', OWNER_KEY);
      if (eraseLocal) {
        await resetAllProgress(db);
        await refresh();
      }
      await signOut();
      return r;
    },
    [db, refresh, signOut, withSession],
  );

  return (
    <Ctx.Provider
      value={{
        configured: cloudConfigured,
        authMode: cloud.authMode,
        session,
        profile,
        syncing,
        lastSyncAt: lastSync,
        error,
        sendCode,
        signIn,
        signOut,
        syncNow,
        exportData,
        call,
        deleteAccount,
      }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSync() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
}
