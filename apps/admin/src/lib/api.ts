/**
 * Admin API client. Tokens live in memory plus sessionStorage (cleared when the tab closes), never
 * localStorage. Every permission is enforced by the API; the UI only hides what a role cannot use.
 */
export const env = {
  apiUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, ''),
  authMode: (import.meta.env.VITE_AUTH_MODE === 'dev' ? 'dev' : 'supabase') as 'dev' | 'supabase',
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
};

export type Role = 'learner' | 'editor' | 'admin' | 'super_admin';
const RANK: Record<Role, number> = { learner: 0, editor: 1, admin: 2, super_admin: 3 };
export const atLeast = (role: Role | undefined, min: Role) => !!role && RANK[role] >= RANK[min];

export interface Session {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  email: string;
}

const KEY = 'laas.admin.session';
let session: Session | null = (() => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
})();

export const getSession = () => session;
export function setSession(s: Session | null) {
  session = s;
  if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
  else sessionStorage.removeItem(KEY);
}

/**
 * Supabase's default email (no custom SMTP) holds a sign-in link, not a code. The link lands here with
 * `#access_token=…&refresh_token=…&expires_in=…` (or `#error=…`). Take the tokens, then clear them from
 * the address bar before the hash router runs. Returns an error message if the link was rejected.
 */
function consumeMagicLink(): string | null {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('access_token');
  const error = params.get('error_description') ?? params.get('error');
  if (!token && !error) return null;
  history.replaceState(null, '', `${location.pathname}${location.search}#/`);
  if (!token) return error;
  try {
    const payload = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload)) as { email?: string };
    setSession({ accessToken: token, refreshToken: params.get('refresh_token'), expiresAt: Date.now() + Number(params.get('expires_in') ?? 3600) * 1000, email: claims.email ?? '' });
    return null;
  } catch {
    return 'The sign-in link was not valid. Request a new one.';
  }
}

/** Runs once at load, before the router reads the hash. */
export const magicLinkError = consumeMagicLink();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; details?: unknown; error_description?: string; msg?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? body.error_description ?? body.msg ?? `Request failed (${res.status})`, body.details);
  return body;
}

async function supabase<T>(path: string, body: unknown) {
  return json<T>(await fetch(`${env.supabaseUrl}/auth/v1/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.anonKey }, body: JSON.stringify(body) }));
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { email: string };
}
const fromSupabase = (r: TokenResponse): Session => ({ accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: Date.now() + r.expires_in * 1000, email: r.user.email });

export const auth = {
  requestCode: (email: string) => supabase('otp', { email, create_user: false }),
  verify: async (email: string, code: string) => setSession(fromSupabase(await supabase<TokenResponse>('verify', { type: 'email', email, token: code }))),
  /** Local development only: the dev API mints a token for any email/role. */
  devSignIn: async (email: string, role: Role) => {
    const sub = await uuidFromEmail(email);
    const r = await json<{ accessToken: string; expiresIn: number }>(
      await fetch(`${env.apiUrl}/dev/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub, email, role }) }),
    );
    setSession({ accessToken: r.accessToken, refreshToken: null, expiresAt: Date.now() + r.expiresIn * 1000, email });
  },
  signOut: () => setSession(null),
};

async function uuidFromEmail(email: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase()));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function fresh(): Promise<Session> {
  if (!session) throw new ApiError(401, 'Not signed in');
  if (session.expiresAt - 60_000 > Date.now() || !session.refreshToken) return session;
  setSession(fromSupabase(await supabase<TokenResponse>('token?grant_type=refresh_token', { refresh_token: session.refreshToken })));
  return session!;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const s = await fresh();
  const res = await fetch(`${env.apiUrl}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${s.accessToken}`, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401) setSession(null);
  return json<T>(res);
}

/** Authenticated file download (e.g. CSV export) without putting the token in a URL. */
export async function download(path: string, filename: string) {
  const s = await fresh();
  const res = await fetch(`${env.apiUrl}${path}`, { headers: { Authorization: `Bearer ${s.accessToken}` } });
  if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
