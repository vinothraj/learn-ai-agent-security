import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * Build-time configuration (public values only; the Supabase anon key is designed to be public).
 * Privileged keys never ship in the app.
 */
export const cloud = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, ''),
  authMode: (process.env.EXPO_PUBLIC_AUTH_MODE === 'dev' ? 'dev' : 'supabase') as 'dev' | 'supabase',
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, ''),
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

/**
 * Release builds only talk to an https API with real (Supabase) sign-in. A misconfigured store build
 * (localhost API or dev tokens) falls back to offline mode instead of shipping a test login.
 */
const releaseSafe = __DEV__ || (cloud.apiUrl.startsWith('https://') && cloud.authMode === 'supabase' && cloud.supabaseUrl.startsWith('https://'));

export const cloudConfigured = releaseSafe && !!cloud.apiUrl && (cloud.authMode === 'dev' || (!!cloud.supabaseUrl && !!cloud.anonKey));

export interface Session {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  userId: string;
  email: string;
}

const STORE_KEY = 'laas.session';

// Web has no secure enclave; the web build is a developer preview only.
const store = {
  get: (k: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v)),
  del: (k: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k)),
};

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await store.get(STORE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: Session | null) {
  if (s) await store.set(STORE_KEY, JSON.stringify(s));
  else await store.del(STORE_KEY);
}

async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error_description?: string; msg?: string; error?: string };
  if (!res.ok) throw new Error(json.error_description ?? json.msg ?? json.error ?? `Request failed (${res.status})`);
  return json;
}

interface SupabaseTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string; user_metadata?: { full_name?: string; name?: string } };
}

const toSession = (r: SupabaseTokenResponse): Session => ({
  accessToken: r.access_token,
  refreshToken: r.refresh_token,
  expiresAt: Date.now() + r.expires_in * 1000,
  userId: r.user.id,
  email: r.user.email,
});

/** Step 1: email a one-time code (Supabase "Email OTP"). */
export async function requestCode(email: string): Promise<void> {
  await postJson(`${cloud.supabaseUrl}/auth/v1/otp`, { email, create_user: true }, { apikey: cloud.anonKey });
}

/** Step 2: exchange the code for a session. */
export async function verifyCode(email: string, code: string): Promise<Session> {
  return toSession(await postJson<SupabaseTokenResponse>(`${cloud.supabaseUrl}/auth/v1/verify`, { type: 'email', email, token: code }, { apikey: cloud.anonKey }));
}

/** Query and fragment parameters of a redirect URL (React Native's URLSearchParams is incomplete). */
function redirectParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of url.split(/[?#]/).slice(1).join('&').split('&')) {
    const [k, v = ''] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

/**
 * Google sign-in through Supabase OAuth with PKCE, in the system browser (no native Google SDK, so it also
 * works in Expo Go). Supabase links it to the email-code account with the same address.
 * Returns null if the person closes the browser. `name` is Google's display name, if shared.
 */
export async function googleSignIn(): Promise<{ session: Session; name: string } | null> {
  const verifier = (Crypto.randomUUID() + Crypto.randomUUID()).replace(/-/g, '');
  const challenge = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const redirect = Linking.createURL('auth-callback');
  const query = [`provider=google`, `redirect_to=${encodeURIComponent(redirect)}`, `code_challenge=${challenge}`, `code_challenge_method=s256`].join('&');
  const result = await WebBrowser.openAuthSessionAsync(`${cloud.supabaseUrl}/auth/v1/authorize?${query}`, redirect);
  if (result.type !== 'success') return null;
  const params = redirectParams(result.url);
  if (params.error_description || params.error) throw new Error(params.error_description || params.error);
  if (!params.code) throw new Error('Google sign-in did not complete. Please try again.');
  const r = await postJson<SupabaseTokenResponse>(`${cloud.supabaseUrl}/auth/v1/token?grant_type=pkce`, { auth_code: params.code, code_verifier: verifier }, { apikey: cloud.anonKey });
  return { session: toSession(r), name: (r.user.user_metadata?.full_name ?? r.user.user_metadata?.name ?? '').trim() };
}

/** Local development: a stable user id derived from the email, so two devices share an account. */
export async function devSignIn(email: string): Promise<Session> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, email.toLowerCase());
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  const r = await postJson<{ accessToken: string; expiresIn: number }>(`${cloud.apiUrl}/dev/token`, { sub: uuid, email: email.toLowerCase() });
  return { accessToken: r.accessToken, refreshToken: null, expiresAt: Date.now() + r.expiresIn * 1000, userId: uuid, email: email.toLowerCase() };
}

/** Returns a non-expired session, refreshing it when needed (and persisting the new tokens). */
export async function freshSession(s: Session): Promise<Session> {
  if (s.expiresAt - 60_000 > Date.now()) return s;
  const next =
    cloud.authMode === 'dev'
      ? await devSignIn(s.email)
      : toSession(
          await postJson<SupabaseTokenResponse>(
            `${cloud.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
            { refresh_token: s.refreshToken },
            { apikey: cloud.anonKey },
          ),
        );
  await saveSession(next);
  return next;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(session: Session, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${cloud.apiUrl}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${session.accessToken}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, j.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}
