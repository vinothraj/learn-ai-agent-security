import { z } from 'zod';

const list = z
  .string()
  .default('')
  .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),
  /** Postgres connection string. When empty (development only), an embedded PGlite database is used. */
  DATABASE_URL: z.string().default(''),
  /** Directory for the embedded PGlite database; "memory" keeps it in RAM. */
  PGLITE_DIR: z.string().default('.data/pglite'),
  /** "supabase" verifies Supabase Auth JWTs; "dev" mints local test tokens (never in production). */
  AUTH_MODE: z.enum(['supabase', 'dev']).default('dev'),
  SUPABASE_URL: z.string().url().optional(),
  /** Legacy HS256 projects only. Newer projects use asymmetric keys via JWKS. */
  SUPABASE_JWT_SECRET: z.string().min(32).optional(),
  /** Server-side only: lets the API delete the auth user on account deletion. Never ship to clients. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DEV_JWT_SECRET: z.string().min(32).default('dev-only-secret-change-me-0123456789abcdef'),
  CORS_ORIGINS: list,
  /** Emails promoted to super_admin on first sign-in (bootstrap). */
  SUPER_ADMIN_EMAILS: list,
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).default(300),
  /** Background feed ingestion. Off in tests; can be turned off per instance. */
  NEWS_INGESTION: z.enum(['on', 'off']).default('on'),
  /** Secret for pseudonymous analytics ids (HMAC of the user id). Required in production. */
  ANALYTICS_SALT: z.string().min(32).default('dev-only-analytics-salt-0123456789abcdef'),
  /** Server push via Expo. Off by default outside production; tests inject a fake sender. */
  PUSH: z.enum(['on', 'off']).default('off'),
  /** Optional Expo access token (enhanced push security). Server-side only. */
  EXPO_ACCESS_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = z.infer<typeof EnvSchema>;

/** Parses the environment and refuses unsafe production configurations. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const c = EnvSchema.parse(env);
  if (c.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (c.AUTH_MODE !== 'supabase') problems.push('AUTH_MODE must be "supabase" in production');
    if (!c.SUPABASE_URL) problems.push('SUPABASE_URL is required in production');
    if (!c.DATABASE_URL) problems.push('DATABASE_URL is required in production (embedded PGlite is for development only)');
    if (c.ANALYTICS_SALT.startsWith('dev-only')) problems.push('ANALYTICS_SALT must be set to a random secret in production');
    if (c.CORS_ORIGINS.length === 0) problems.push('CORS_ORIGINS must list allowed web origins in production');
    if (problems.length) throw new Error(`Unsafe production configuration:\n- ${problems.join('\n- ')}`);
  }
  if (c.AUTH_MODE === 'supabase' && !c.SUPABASE_URL) throw new Error('AUTH_MODE=supabase requires SUPABASE_URL');
  return c;
}
