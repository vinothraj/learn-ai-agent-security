# Performance (Phase 11)

Measured 2026-10-18 on the development laptop (Windows 11, Node 22). Re-run after changes to sync,
analytics or bundle dependencies.

## API

`npx tsx scripts/bench.ts` (in `apps/api`) runs the hot paths in-process against embedded PGlite.
PGlite is single-threaded WebAssembly, so production Postgres will be faster; treat these as ceilings.

| Path | p50 | p95 | Notes |
|---|---|---|---|
| `POST /v1/sync` with 500 new changes (max batch) | 70 ms | 92 ms | Was 519 / 725 ms: batched into one locking read + one bulk upsert |
| `POST /v1/sync` full pull (one 1,000-record page) | 27 ms | 30 ms | |
| `GET /v1/config`, `/v1/news`, `/v1/content/manifest` | 1–1.5 ms | ≤ 2 ms | |
| `POST /v1/ai/tutor` with AI off (lesson answer) | 2.6 ms | 20 ms | BM25 index built once per content pack |
| `GET /v1/admin/analytics?days=30`, 1,000 learners / 8,131 events | 78 ms | 99 ms | On-demand SQL with `(type, day)` index |

Budget: interactive endpoints under 200 ms p95 at the API. Add daily rollup tables for analytics once
the event table passes a few million rows.

## Android app

| Metric | Before | After |
|---|---|---|
| JS bundle (`expo export`, no bytecode) | 5.83 MB | 4.02 MB |
| Hermes bytecode shipped in the APK | 7.94 MB | 5.86 MB |

The win came from importing icons one file each (`src/components/icons.ts`); importing from
`lucide-react-native` pulled in every icon because Metro does not tree-shake. A lint rule now blocks
root imports. Largest remaining modules: React Native, Expo Router, Reanimated, zod (needed on device
to validate over-the-air content packs).

Other measures already in place: SQLite in WAL mode with indexes on every date column used in reports,
derived data (badges, mastery, insights) computed in memory from one load, the news list paginated
(20 per page) with an offline cache, notification re-planning debounced (1 s) and widget updates
debounced (1.5 s).

**To measure on a phone** (needs an installed preview build): cold start with
`adb shell am start -W com.vinoth.aiagentsecurity/.MainActivity`, and frame drops with the
React Native performance monitor. Targets: cold start under 2.5 s on a mid-range device, 60 fps
scrolling on Home and Learn.

## Admin panel

Initial load is 90 kB gzip. The CMS editor (42 kB) and the content pack (53 kB) load only when a
content page opens.
