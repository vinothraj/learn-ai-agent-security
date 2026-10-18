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
   | `ANALYTICS_SALT` | random secret (32+ chars) for pseudonymous analytics ids |
   | `PUSH` | `on` to send push notifications through Expo (default `off`) |
   | `EXPO_ACCESS_TOKEN` | optional, if "enhanced push security" is enabled in your Expo account |

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
| PUT | `/v1/devices` | signed in (register push token and topics) |
| DELETE | `/v1/devices/:token` | signed in (own tokens only) |
| POST | `/v1/notifications/:id/tapped` | signed in (records a real open) |
| POST | `/v1/events` | signed in, opted in (30/min, 500 events per batch) |
| DELETE | `/v1/me/analytics` | signed in (withdraw consent: deletes shared events) |
| GET | `/v1/admin/analytics?days=7..90` | admin+ |
| POST | `/v1/ai/tutor` | signed in (20/min, per-user daily cap) |
| POST | `/v1/ai/interview-feedback` | signed in (10/min, answers never cached) |
| POST | `/v1/admin/ai/quiz` | editor+ (drafts go to the review queue) |
| GET | `/v1/admin/ai/suggestions` | editor+ |
| POST | `/v1/admin/ai/suggestions/:id/review` | admin+ (four-eyes, audited) |
| POST | `/v1/admin/news/:id/ai-summary` | admin+ (draft only, not saved) |
| GET | `/v1/admin/ai/usage` | admin+ |

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

## Notifications

**Local (no server, no account):** the app plans its own schedule with `planLocalNotifications()`
(`packages/shared/src/notifications.ts`): at most one reminder a day (skipped once the daily goal is
met), an evening recap only on days with activity, and a Sunday weekly report. Nothing fires in quiet
hours. The schedule is recomputed whenever progress or settings change, using stable ids, so it never
duplicates. Taps open the matching screen and are logged on the device (`notification_log`).

**Server push (opt-in, needs an account and an installed build):**

- Topics: `advisories` (sent when an admin publishes a **high-impact** news item) and `content`
  (sent when a content version is published).
- Each user gets each event at most once (unique dedupe key), within a daily cap
  (2 advisories, 1 content alert). Tokens Expo reports as `DeviceNotRegistered` are deleted.
- Kill switch: the `push` feature flag (Admin → Settings). Sending also needs `PUSH=on`.
- Taps are recorded only from the OS "notification opened" event.

**Setup:** run `eas init` in `apps/mobile` (adds `extra.eas.projectId` to the app config), add an
FCM V1 service-account key with `eas credentials` (Android), build with EAS, and set `PUSH=on` on the
API. Expo Go cannot receive remote push; local reminders work everywhere except the web preview.

## Engagement analytics

**Opt-in only.** A learner turns on "Share anonymous usage statistics" in Settings (signed-in users
only; guests keep statistics on the device). While it is on, SQLite triggers queue structured events
(`packages/shared/src/analytics.ts`): daily active seconds, lesson started/completed, first quiz
score, lab started/result, notification taps. There is no free text, no answers and no device
fingerprint. Events upload with sync, idempotently (one key per event). Turning it off clears the queue
and deletes everything shared (`DELETE /v1/me/analytics`). Account deletion and data export include them.

**Pseudonymous storage:** events are stored under `HMAC-SHA256(ANALYTICS_SALT, user id)`, never the
user id. Keep the salt secret and stable; changing it disconnects old events.

**Metrics (MASTER_PROMPT §16), computed in SQL by `apps/api/src/analytics.ts`:**

| Metric | Definition used |
|---|---|
| DAU / WAU / MAU | Distinct learners with active time on the day / last 7 / last 30 days |
| Learning minutes | Sum of active seconds ÷ 60 (also per active learner) |
| Lesson completion | Lessons completed within 7 days of starting ÷ lessons started |
| Quiz average | Mean first-attempt score |
| Lab completion | Labs that reached a pass/fail result ÷ labs started |
| D1 / D7 / D30 retention | Weekly cohorts by first active day; % active exactly N days after their first day (only learners for whom day N has passed) |
| Roadmap drop-off | Of learners who started a roadmap's first lesson, % who started each lesson |
| Push tap rate | Taps ÷ pushes accepted by Expo |
| Content freshness | Lessons with `reviewedOn` in the last 180 days; ingestion success per source |

Any figure covering fewer than **5** learners is returned as `null` and shown as hidden. Days are the
learner's local calendar day. Queries run on demand with indexes; add materialized daily rollups if the
event table grows past a few million rows.

## Optional AI

AI is **off by default** and never required: with `AI_PROVIDER=none` every feature works with its
deterministic fallback. Keys stay on the server; the app never talks to a model directly.

| Variable | Meaning |
|---|---|
| `AI_PROVIDER` | `none` (default), `anthropic`, `openai-compatible` or `ollama` |
| `AI_API_KEY` | provider key (Anthropic, or an OpenAI-compatible service) |
| `AI_BASE_URL` | for `openai-compatible` (e.g. `https://api.openai.com/v1`) or `ollama` (`http://127.0.0.1:11434`) |
| `AI_MODEL` | defaults: `claude-haiku-5-5` (Anthropic), `llama3.2` (Ollama) |
| `AI_DAILY_TOKEN_BUDGET` | total tokens per UTC day across everyone (default 200 000) |
| `AI_USER_DAILY_REQUESTS` | AI requests per learner per day (default 20) |
| `AI_TIMEOUT_MS` | per call (default 20 000); one retry on 429/5xx |

Then turn on the `ai` feature flag in Admin → Feature flags. `/v1/config` reports `features.ai` only
when both are on.

**Zero-cost option:** run [Ollama](https://ollama.com) on a machine you control and set
`AI_PROVIDER=ollama`. Hosted providers (Anthropic, OpenAI) are pay-per-use; the daily budget caps spend.

**What uses AI, and the fallback for each:**

| Feature | With AI | Without AI |
|---|---|---|
| Ask the tutor (app) | Model phrases an answer from the top 3 matching lessons, with citations limited to those lessons; labelled "AI-generated" | The app answers from lesson summaries (works offline) |
| Interview feedback | Optional second opinion, on request; answer sent once, not stored or cached | Rubric coverage score (always shown) |
| Quiz drafting (admin) | Questions from one lesson's text → review queue; approver must differ from requester | Write questions in the content editor |
| News summary (admin) | Draft for the reviewer; published summaries are labelled AI-assisted | Template summary or editor text |

**Safety:** refusals (attacking real systems, malware, evasion) and off-topic checks run
deterministically before any model call. Lesson text, questions, answers and article text are passed
inside delimiters and declared as data. Output must match a JSON schema or it is discarded. Responses
are cached for 7 days (except interview answers). Provider error messages never include response bodies.
