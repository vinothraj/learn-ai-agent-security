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
- **Next: Phase 3.** Simulated security labs engine (10 labs) with interactive diagrams and PDF reports.

## Layout

```
apps/mobile        Expo SDK 58 app (Expo Router, routes in src/app)
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
- E2E: Maestro flows in `apps/mobile/.maestro/` target an installed preview/dev build
  (`maestro test .maestro/`); they can't run in Expo Go.
- Time tracking: credited only while foregrounded on a learning screen and within 60 s of the last
  touch (`activeMsForTick`). Every learning screen calls `useStudySession(activity, contentId)`.
- Insight sentences are deterministic rules over recorded data (`buildInsights`); never invent numbers.
- Theming: all colours come from `useTheme().theme`; respect `animate` for motion. Five modes, six accents.
- The React Compiler is on. Lint enforces its rules (no ref reads during render, no sync setState in effects).
- Android package id `com.vinoth.aiagentsecurity` is a placeholder; confirm it before the first Play upload,
  because it can never change after that.
- The web preview (`metro.config.js` headers, `.claude/launch.json`) is for UI checks only; Android is the target.
