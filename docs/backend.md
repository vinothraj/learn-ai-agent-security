# Backend: API, auth and sync

The app works fully offline. The backend adds accounts, cloud backup and cross-device sync,
plus the admin and analytics features in later phases.

## Architecture

```
Phone (SQLite + outbox triggers) ──HTTPS──> Fastify API ──> PostgreSQL
        │                                    │
        └── email one-time code ──> Supabase Auth (issues JWTs, verified by the API via JWKS)
```

- **Offline-first sync.** SQLite triggers record every local change in an `outbox`. `POST /v1/sync`
  pushes up to 500 changes and pulls everything newer than the device's cursor. Server and
  devices use the **same merge rules** (`packages/shared/src/sync.ts`): lesson completion is
  sticky, logs are immutable, flashcards and profile use last-write-wins.
- **Auth.** Supabase Auth (email one-time code, no passwords). The API verifies the JWT
  signature, issuer, audience and expiry, then loads the role from its own `users` table.
- **RBAC** (server-enforced): `learner` < `editor` < `admin` < `super_admin`. Admins manage
  learner/editor roles; only super-admins grant or revoke admin roles; nobody changes their own role.
- **Audit log** is append-only, enforced by a database trigger.
- **Privacy:** data export (`GET /v1/me/export`) and account deletion (`DELETE /v1/me`, which also
  deletes the Supabase auth user when the service key is configured).

## Run locally (no accounts needed)

```bash
npm install
npm run dev --workspace apps/api
```

With no `DATABASE_URL`, the API uses embedded PGlite (real Postgres compiled to WebAssembly) in
`apps/api/.data/pglite`. `AUTH_MODE=dev` enables `POST /dev/token` for local sign-in.

To point the app at it, create `apps/mobile/.env.local`:

```
EXPO_PUBLIC_API_URL=http://<your-laptop-LAN-IP>:4000
EXPO_PUBLIC_AUTH_MODE=dev
```

(On a phone, use the laptop's LAN IP, not `localhost`.) API docs are served at `/docs`.

Optional real Postgres via Docker:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Then run with `DATABASE_URL=postgres://laas:laas@localhost:5432/laas`, or run the test suite
against Postgres with `TEST_DATABASE_URL=postgres://laas:laas@localhost:5432/laas_test npm test --workspace apps/api`.

## Production setup (Supabase + any container host)

1. Create a Supabase project (free tier).
2. **Auth → Providers → Email:** enable it, and turn on **Email OTP**. In **Auth → Email Templates →
   Magic Link**, include `{{ .Token }}` so emails contain the 6-digit code the app asks for.
3. Use the project's Postgres connection string (Settings → Database) as `DATABASE_URL`.
4. Deploy the API container (`apps/api/Dockerfile`) to Google Cloud Run, Render, Fly.io or your own
   server. Set these environment variables:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `AUTH_MODE` | `supabase` |
   | `SUPABASE_URL` | `https://<project>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key (**server only**, enables auth-user deletion) |
   | `DATABASE_URL` | Supabase Postgres connection string |
   | `CORS_ORIGINS` | admin panel origin(s), comma-separated |
   | `SUPER_ADMIN_EMAILS` | your email (bootstraps the first super-admin) |

   The server refuses to start in production without these, and never enables dev tokens there.
5. Run migrations: `npm run db:migrate --workspace apps/api` (or let the server apply them on boot).
6. Build the app with `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_MODE=supabase`,
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (EAS environment variables).

**Costs:** Supabase and Cloud Run free tiers cover early usage. Free tiers have limits, and some
pause or sleep when idle (Supabase pauses inactive free projects). An always-on paid tier is
recommended once real users depend on sync.

## Endpoints

| Method | Path | Who |
|---|---|---|
| GET | `/health`, `/ready` | public |
| GET | `/v1/config` | public |
| GET / PATCH / DELETE | `/v1/me` | signed in |
| GET | `/v1/me/export` | signed in |
| POST | `/v1/sync` | signed in (60/min) |
| GET | `/v1/admin/stats`, `/v1/admin/users` | admin+ (user listing is audit-logged) |
| PATCH | `/v1/admin/users/:id/role` | admin+ (admin roles: super-admin) |
| GET | `/v1/admin/audit` | super-admin |

Example:

```bash
curl -X POST $API/v1/sync -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"cursor":0,"changes":[]}'
```

## Backups

Supabase takes daily backups on paid plans; on the free tier, schedule `pg_dump`:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=laas-$(date +%F).dump
pg_restore --clean --dbname "$RESTORE_URL" laas-YYYY-MM-DD.dump   # test restores regularly
```

## Corporate networks

If outbound internet access goes through a proxy, set `HTTPS_PROXY` (and optionally `NO_PROXY`)
for the API process. All server-side requests (news feeds, Supabase admin API) then use it.
Without the variable, the API connects directly.

## Admin panel (`apps/admin`)

React + Vite web app for staff. Run locally with `npm run admin` (port 5173) next to `npm run api`.
Configure with `apps/admin/.env.local` (`VITE_API_URL`, `VITE_AUTH_MODE`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`). Build static files with `npm run build --workspace apps/admin` and host them
on any static host (add that origin to the API's `CORS_ORIGINS`).

| Area | Who | Notes |
|---|---|---|
| Dashboard | admin+ | Aggregates only |
| Content | editor+ | Draft, edit lessons/flashcards/quizzes, live validation, submit |
| Content review / publish | admin+ | Four-eyes: you cannot publish your own version (super-admin can) |
| News review, sources, ingestion runs | admin+ | Verify high-impact claims before publishing |
| Users & roles | admin+ | Listing is audited; admin roles need super-admin; CSV export super-admin |
| Audit log | super-admin | Append-only |
| Feature flags | admin+ view, super-admin change | Apps read flags from `/v1/config` |

Staff sign in with Supabase email codes (`create_user: false`, so accounts must already exist). Grant
roles from **Users & roles**, or bootstrap the first super-admin with `SUPER_ADMIN_EMAILS`.

## Content publishing (over the air)

Published packs are served at `/v1/content/manifest` and `/v1/content/packs/:id`. The app downloads a
newer pack in the background, checks its SHA-256 checksum and runs the same `packIssues()` validation,
and applies it on the **next launch**. Packs that are invalid, tampered with or not newer than the
bundled content are ignored. Set a higher pack version (e.g. `2026.11.1`) before publishing.
