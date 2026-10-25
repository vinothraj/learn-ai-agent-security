import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import type { Config } from './config';

export const ROLES = ['learner', 'editor', 'admin', 'super_admin'] as const;
export type Role = (typeof ROLES)[number];
export const roleRank = (r: Role) => ROLES.indexOf(r);

export interface Identity {
  id: string;
  email: string | null;
  /** Name from the sign-in provider (Supabase `user_metadata`, e.g. Google); used only to fill an empty display name. */
  name?: string;
}

export type Verifier = (token: string) => Promise<Identity>;

const DEV_ISSUER = 'laas-dev';
const AUDIENCE = 'authenticated';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function identityFrom(payload: JWTPayload): Identity {
  if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) throw new Error('token subject must be a UUID');
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  const meta = (payload.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const raw = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : '';
  const name = raw.replace(/\p{C}/gu, '').trim().slice(0, 40);
  return { id: payload.sub.toLowerCase(), email, ...(name ? { name } : {}) };
}

/**
 * Supabase mode verifies tokens against the project's JWKS (asymmetric keys), or the legacy
 * HS256 secret when configured. Issuer, audience and expiry are always checked.
 */
export function createVerifier(config: Config): Verifier {
  if (config.AUTH_MODE === 'dev') {
    const key = new TextEncoder().encode(config.DEV_JWT_SECRET);
    return async (token) => {
      const { payload } = await jwtVerify(token, key, { issuer: DEV_ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
      return identityFrom(payload);
    };
  }
  const issuer = `${config.SUPABASE_URL!.replace(/\/$/, '')}/auth/v1`;
  if (config.SUPABASE_JWT_SECRET) {
    const key = new TextEncoder().encode(config.SUPABASE_JWT_SECRET);
    return async (token) => identityFrom((await jwtVerify(token, key, { issuer, audience: AUDIENCE, algorithms: ['HS256'] })).payload);
  }
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return async (token) => identityFrom((await jwtVerify(token, jwks, { issuer, audience: AUDIENCE, algorithms: ['ES256', 'RS256'] })).payload);
}

/** Development/test only: mint a short-lived token. Never registered when AUTH_MODE=supabase. */
export async function mintDevToken(config: Config, sub: string, email: string): Promise<string> {
  if (config.AUTH_MODE !== 'dev') throw new Error('dev tokens are disabled');
  return new SignJWT({ email, role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer(DEV_ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(config.DEV_JWT_SECRET));
}
