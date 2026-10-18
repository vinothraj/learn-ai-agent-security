# Learn AI & Agent Security

Offline-first Android learning app for AI, GenAI and AI-agent security. The full product spec is in
[MASTER_PROMPT.md](MASTER_PROMPT.md); build it phase by phase (§21) and report with the §22 template.

## Status

- **Phase 0 (setup): done.** npm workspaces monorepo, shared logic and content packages, CI.
- **Phase 1 (offline MVP app): done.** Onboarding, theming, roadmaps, lesson player, quizzes, interview
  bank, threat briefings, XP/levels/streaks, active-time tracking, Today rings, weekly chart, insights,
  local daily reminder, settings.
- **Phase 2 (learning depth): done.** 13 lessons (A–D, F), 52 FSRS flashcards, mastery model and
  weak topics with "Fix in 5 min", 7 mini-games (choice/spot/match engines), deterministic daily
  challenge, streak freezes, badges, Revise ring, 26-week heatmap, skill radar, mastery trend,
  time-of-day analysis with reminder suggestion, shareable weekly report image, Maestro flows.
- **Phase 3 (security labs): done.** Data-driven simulation engine (`packages/shared/src/labs.ts`),
  10 labs (one per required category), interactive architecture diagrams, attack → defend → report
  flow with decoy controls and 0–3 stars, OWASP-style severity, PDF report export (expo-print).
- **Phase 4 (interview prep): done.** 40-question bank (27 curated + 13 from lessons), 7 role plans
  with auto-ticking weekly tasks, practice mode with transparent rubric scoring, self-rating and
  bookmarks, timed 10/20/30-min mock interviews with per-topic scorecards and revision links.
- **Phase 5 (backend, auth, sync): done.** `apps/api` (Fastify 5 + Postgres/PGlite), Supabase JWT
  verification (JWKS), server-side RBAC, append-only audit log, `/v1/sync` with shared merge rules,
  data export and account deletion; app outbox triggers, sync engine, Account screen. See docs/backend.md.
- **Phase 6 (news ingestion): done.** 7 verified feeds (OWASP GenAI, CISA, NIST, NCSC, Google, GitHub, arXiv),
  HTTPS-only bounded fetches, XXE-safe parsing, domain allow-lists, whole-word AI relevance filter,
  canonical-URL + SimHash dedupe, rule-based classification, auto-publish only for official non-high-impact
  items, admin review queue (audited), public `/v1/news`, News tab with offline cache.
- **Next: Phase 7.** Admin web panel (apps/admin).
- **Plan:** 13 phases total (see MASTER_PROMPT §21); Phase 13 = Pro community, built last (§25).

## Layout

```
apps/mobile        Expo SDK 58 app (Expo Router, routes in src/app)
apps/api           Fastify API, SQL migrations in src/db/migrations.ts, tests use in-memory PGlite
packages/shared    Pure TS: zod schemas, dates, XP, streaks, stats, insights, tracking, recommender (+ vitest)
packages/content   Seed content pack (roadmaps, lessons, threats) + schema/integrity tests
MASTER_PROMPT.md   Product spec and phase plan
```

## Commands (from repo root)

```
npm install                 # all workspaces
npm run check               # typecheck + unit tests + content validation
npm run lint                # expo lint (mobile)
npm run mobile              # start Expo dev server (scan QR with Expo Go)
```

From `apps/mobile`: `npx expo install <pkg>` (always use this to add Expo/RN packages), `npx expo-doctor`,
`npx eas-cli@latest build -p android --profile preview` (installable APK).

## Conventions and decisions

- **Package manager:** npm workspaces (pnpm was not installed on the dev machine). Turborepo was deferred.
- **Expo changes fast:** before touching an Expo API, check the docs for the installed SDK major
  (https://docs.expo.dev/versions/v58.0.0/, https://docs.expo.dev/llms.txt). Don't rely on memory.
- Never create or edit `android/` or `ios/` by hand. Configure through `app.json` and config plugins (CNG).
- Stay Expo Go compatible until a native module truly requires a dev build.
- Pure logic goes in `packages/shared` with vitest tests; the app only wires UI to it.
- Content is TypeScript validated by zod (`ContentPack`). New lessons must pass `npm run validate:content`.
  Seed content is AI-assisted and stays `status: 'needs_review'` until a human reviews it.
- Local DB: expo-sqlite with append-only migrations in `src/db/migrations.ts`; never edit a released one.
- XP is idempotent via `xp_ledger UNIQUE(reason, ref)`; `awardXp` returns what was actually granted.
- expo-sqlite transactions are NOT exclusive. Wrap multi-statement writes in `inTransaction()` (queued);
  prefer single atomic statements. Overlapping raw `withTransactionAsync` calls fail ("transaction within a transaction").
- Multiple-choice options are shuffled at display time (`QuizQuestionView`), so author content in any
  order; callers always use original indices. Labelled "A: …/B: …" options keep their order and are
  balance-checked by a content test.
- Badges, mastery, streak freezes and insights are derived from recorded data, never stored.
- Daily challenge = `pickDaily` + `seededShuffle` on the date: identical for every learner that day;
  first completion counts (`daily_challenges` PK on day).
- Labs: outcomes are pure functions of enabled controls (`blockedBy` = OR of AND-groups). Every lab must
  pass `labIssues()` (decoy present, recommended set blocks all, nothing blocked with no controls or with
  decoys only). Labs simulate FICTIONAL systems only; never add real-target execution here.
- Report HTML (`buildLabReportHtml`) lives in shared and escapes every string; it is unit-tested for escaping.
- Interview scoring (`scoreAnswer`) is deterministic keyword/concept coverage with a small stemmer;
  4+ char keyword stems match as prefixes. Content tests require every model answer to score ≥80% on its
  own rubric and a vague answer ≤40%, so add rubric keywords that the model answer actually uses.
  Always present the score as a coverage signal, never a hiring verdict.
- News: feed text is untrusted and stored as plain text only; the app never renders feed HTML. Source
  excerpts and our interpretation are separate fields and are labelled separately in the UI. Thresholds
  (NEAR_DUPLICATE_BITS=12) were measured on real headline pairs; keep the CVE-id equality rule.
  Behind a corporate proxy set HTTPS_PROXY for the API (undici EnvHttpProxyAgent).
- E2E: Maestro flows in `apps/mobile/.maestro/` target an installed preview/dev build
  (`maestro test .maestro/`); they can't run in Expo Go.
- Time tracking: credited only while foregrounded on a learning screen and within 60 s of the last
  touch (`activeMsForTick`). Every learning screen calls `useStudySession(activity, contentId)`.
- Insight sentences are deterministic rules over recorded data (`buildInsights`); never invent numbers.
- API: raw parameterized SQL through the tiny `Db` interface (pg in production, PGlite in dev/tests) instead
  of an ORM. Append-only migrations in `apps/api/src/db/migrations.ts`. Every route validates input with zod
  (`parse`) and protected routes use `requireRole`. Never trust role checks in the app alone.
- Sync: every new syncable local table needs an outbox trigger (db/migrations.ts), an adapter
  (src/sync/collections.ts), a zod schema and merge rule (shared/sync.ts). Compare records with `sameRecord`
  (jsonb reorders keys). Local progress is never merged into a different account (sync_owner_id guard).
- Theming: all colours come from `useTheme().theme`; respect `animate` for motion. Five modes, six accents.
- The React Compiler is on. Lint enforces its rules (no ref reads during render, no sync setState in effects).
- Android package id `com.vinoth.aiagentsecurity` is a placeholder; confirm it before the first Play upload,
  because it can never change after that.
- The web preview (`metro.config.js` headers, `.claude/launch.json`) is for UI checks only; Android is the target.
