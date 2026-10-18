# MASTER BUILD PROMPT — "Learn AI & Agent Security" (v2, refined)

> **How to use:** Paste this whole file into Claude Code in an empty project folder, followed by:
> *"Build Phase 0 and Phase 1 now. Stop after Phase 1 and report."*
> Then go one phase at a time. Each phase has to run, pass its tests and work on a real phone before the next one starts.

---

## 0. Working agreement (read first)

You are acting as a senior product owner, mobile architect, TypeScript full-stack engineer, PostgreSQL designer, AI-security specialist, learning-experience designer and release engineer.

1. **Phase-gated delivery.** Build one phase at a time. At the end of each phase, run lint, type-check and tests, fix failures, and report using the template in §22. Never dump the whole app in one unverified pass.
2. **Always runnable.** After every phase, the mobile app must build and run on a physical Android phone.
3. **Inspect before you change anything.** Check the repo, tool versions and existing code first. Do not overwrite working code without asking.
4. **Create and maintain `CLAUDE.md`** with the architecture, commands, conventions and current phase status, so later sessions can resume cleanly.
5. **Don't fabricate.** No invented news, CVEs, test results, metrics, testimonials or interview feedback. When unsure, say so and mark the content `needs_review`.
6. **Zero paid dependencies for the MVP.** Paid or quota-limited items must be optional, behind a feature flag, and clearly labelled (see §19).
7. **Ask only when blocked** on a real product decision, such as the app name, package ID or brand colour. Otherwise pick sensible defaults and record them in `CLAUDE.md`.

---

## 1. Mission

Build **Learn AI & Agent Security**: a production-quality Android app (iOS-ready later) that teaches **AI security, GenAI/LLM security and AI-agent security** in 5–10 minute daily sessions. It includes safe simulated labs, interview preparation, a source-linked daily security news feed, adaptive revision and rich personal progress reports that make learners want to come back every day.

It must be a real learning product: offline-capable, adaptive and measurable. It must not be a static news reader or a mock-up.

**Product principles**
- **Security first.** Security roadmaps are the default. General AI/ML topics are recommended only when a learner needs the prerequisite.
- **Offline first.** Lessons, quizzes, labs, flashcards, interview practice, progress and reports all work with no network and no backend.
- **Ethical engagement.** Motivate with progress, mastery and personal bests. No guilt-tripping, fake urgency, infinite feeds or notification spam.
- **Safe by design.** Labs use only fictional systems. The app gives no real-world exploitation tooling, which also keeps it within Google Play policy.
- **Deterministic core, optional AI.** Every core feature works without an AI API key.

---

## 2. Technology stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) everywhere | One language across mobile, API, admin and shared packages |
| Monorepo | **pnpm workspaces + Turborepo** | Shared types, content and validation |
| Mobile | **React Native + Expo (latest SDK) + Expo Router** | Fastest route to Play Store; cloud builds (no Android Studio needed); OTA updates; iOS later from the same code |
| Mobile UI | **Tamagui** (or NativeWind v4 if simpler) + **React Native Reanimated** + **Moti** + **Lottie** + **expo-haptics** | Smooth 60/120 fps animations, themeable design tokens |
| Charts / graphics | **Victory Native (XL, Skia-based)** + **@shopify/react-native-skia** for custom rings, heatmaps and radar | GPU-rendered, fluid, animated charts |
| Local data | **expo-sqlite + Drizzle ORM** (FTS5 for offline search), **react-native-mmkv** for preferences | Fast offline store; same ORM as the backend |
| State / data | **TanStack Query** (server cache, offline persistence) + **Zustand** (UI state) | Simple and well tested |
| Validation | **Zod** schemas in `packages/shared` | One source of truth for API, content and forms |
| Backend API | **Node.js LTS + Fastify + Drizzle ORM + PostgreSQL** | Fast, typed, SQL-first migrations |
| Jobs / queues | **pg-boss** (PostgreSQL-backed queue + cron) | Meets the "queues in Postgres" requirement with no Redis |
| Auth | **Supabase Auth** (email OTP / magic link + Google sign-in); the API verifies the JWT via JWKS; roles live in our DB and are enforced server-side | Free tier, secure, no home-made password storage |
| Database hosting | **Supabase Postgres (free tier)**; Docker Postgres for local development | Free managed Postgres with backups |
| API hosting | Google Cloud Run free tier, or Render/Fly free tier, or an existing VPS (Dockerfile provided) | Zero cost at MVP scale; note cold starts |
| Admin panel | **React + Vite + shadcn/ui + TanStack Table/Query + Apache ECharts** | Fast CRUD and good dashboards |
| Notifications | **expo-notifications**: local scheduled reminders in the MVP; Expo Push / FCM for server pushes later | Reminders need no server |
| Reports / PDF | **expo-print** (on-device PDF) + **react-native-view-shot** (share cards) | Free and private |
| Text-to-speech | **expo-speech** (on-device "listen to lesson") | Free accessibility feature |
| Optional AI | Server-side provider adapter: **Anthropic Claude** (default `claude-haiku-4-5` for cheap tasks, `claude-sonnet-5-5` for quality), any OpenAI-compatible endpoint, or **Ollama** (local) | Never required; never called from the app with a key |
| Testing | Jest + React Native Testing Library, **Maestro** (mobile end-to-end), Vitest + Supertest (API), Playwright (admin) | All free |
| Quality | ESLint, Prettier, `tsc --noEmit`, Husky + lint-staged, `pnpm audit`, license-checker, GitHub Actions CI | |
| Builds / release | **EAS Build** (cloud AAB/APK) + **EAS Update** (OTA) + **EAS Submit** to Google Play | No local Android toolchain required |
| Crash reporting (optional) | Sentry free tier, behind a flag and disclosed in Data safety | |

If the repo already contains a stack, justify any deviation before you change it.

---

## 3. Architecture

```
/apps
  /mobile        Expo app (Expo Router, offline-first)
  /api           Fastify API + pg-boss workers (ingestion, recommendations, reports)
  /admin         React + Vite admin panel
/packages
  /shared        Zod schemas, types, constants, scoring algorithms (FSRS, mastery, XP)
  /content       Version-controlled seed content (lessons, quizzes, labs, interview Qs) as YAML/MDX + validator + build-to-JSON
  /ui-tokens     Design tokens shared by mobile and admin (colours, spacing, typography, motion)
/infra           docker-compose (Postgres), Dockerfiles, CI workflows
/docs            Architecture, API (OpenAPI), privacy policy, Play Store assets, runbooks
```

- **Content packs.** Seed content is compiled into a versioned JSON pack that ships inside the app. Later, the app downloads updated packs from the API (signed with a checksum) without needing a new release.
- **Sync model.** The local SQLite store is the source of truth on the device. Once signed in, progress, attempts and time logs sync to the server through an idempotent `/sync` endpoint (last-write-wins per record, with server timestamps). Guests stay fully local.
- **Feature flags.** Remote config (`/config` endpoint, cached) toggles AI, news, push and leaderboards.

---

## 4. Design system and theme ("smooth and futuristic")

**Visual direction: "Calm Cyber".** Dark-first, deep navy/graphite surfaces, a neon-teal primary, violet secondary and amber for warnings. Subtle glass cards (blur and translucency used sparingly), soft glows on progress elements and clean geometric typography (Inter or Space Grotesk for headings, JetBrains Mono for code and payload snippets).

**Configurable by the user (Settings → Appearance)**
- Theme: **Dark (default) / Light / AMOLED black / High-contrast / System**
- Accent colour picker (6 presets plus Material You dynamic colour on Android 12+)
- Font size (follows system scale), dyslexia-friendly font option
- Motion: Full / Reduced (respects the OS "reduce motion" setting) / Off
- Haptics on/off; sound effects on/off
- Gamification on/off (hides XP, badges and streaks for focus-only learners)
- Compact or comfortable density

**Motion and feel**
- Shared-element transitions between a lesson card and the lesson screen; spring-based micro-interactions; animated progress rings; confetti/Lottie only on real milestones; skeleton loaders (no spinners); pull-to-refresh with haptic tick.
- Target 60 fps minimum on a mid-range Android phone. Profile list screens with FlashList.

**Accessibility (required):** WCAG 2.2 AA contrast in every theme, TalkBack labels on every control, 48dp touch targets, no information conveyed by colour alone, captions/transcripts for audio, full screen-reader pass in Phase 11.

**Futuristic extras (in phases, all free)**
- Android **home-screen widget**: streak, today's ring progress and "Threat of the Day" (`react-native-android-widget`).
- **App shortcuts** (long-press icon): Continue lesson, Daily challenge, Flashcards.
- **Listen mode**: on-device text-to-speech of any lesson, with speed control.
- **Interactive architecture diagrams** in labs (Skia canvas: tap a node to inspect its trust boundary).
- **Offline full-text search** across lessons, glossary and interview questions.
- **Deep links and share cards**: share a badge or weekly report as an image.
- **Focus mode**: a distraction-free lesson player with a Pomodoro-style 5/10-minute timer.

---

## 5. User roles (enforced server-side)

| Role | Capabilities |
|---|---|
| **Guest** (no account, fully local) | All bundled lessons in Roadmaps A–C intro levels, limited quizzes, roadmap view, local progress and reports. Prompted (not forced) to sign up to sync and back up. |
| **Learner** | Full content, progress sync across devices, bookmarks, reminders, interview practice, recommendations, personal reports, optional opt-in leaderboard. |
| **Editor** | Create and edit content and submit it for review. Cannot publish, manage users or see analytics. |
| **Admin** | Everything: publish, schedule, archive, sources, ingestion, notifications, users and roles, aggregate analytics, audit logs, settings. |
| **Super-admin** | Role assignment for admins, secrets/config, data export and deletion. |

Every API route declares the role it requires, and that is checked server-side. Frontend checks are for UX only. Admin views show aggregate analytics only. Individual learner data needs Super-admin rights and is audit-logged.

---

## 6. Navigation and screens

**Bottom tabs (5):** Home · Learn · Practice · News · Me
- **Learn:** roadmaps, lessons, flashcards, glossary
- **Practice:** Security Labs, Games, Interview Prep, Daily Challenge
- **Me:** progress and reports, bookmarks, badges, settings, account
- **Admin:** a separate web panel (`/apps/admin`) plus a read-only "Admin glance" screen in the app for admins

**Home: one scroll, in priority order**
1. Greeting + **Today Ring** (minutes / practice / revision vs. goal) + streak flame
2. **Continue learning** (one big card)
3. **Today's lesson** (≤10 min)
4. **Threat of the Day** (from verified news or the curated list)
5. **Daily challenge** (60-second game)
6. **Revision due** ("8 flashcards · 3 min")
7. **Interview question of the day**
8. **Latest verified news** (3 items, then "See all")
9. Weekly mini-chart ("You've studied 47 min this week, 12 more than last week")

Rules: no more than one promotional or nudge card at a time, and nothing auto-plays.

---

## 7. Learning engine

### 7.1 Roadmaps (configurable, prerequisite graph)
- **A. AI Security Foundations:** AI app security concepts, threat modelling and trust boundaries, security and privacy basics, authN/authZ and least privilege, security testing and risk assessment.
- **B. GenAI and LLM Security:** prompt injection (direct and indirect), jailbreaks, sensitive-information disclosure, improper output handling, training/retrieval data poisoning, RAG security and tenant isolation, system-prompt leakage, guardrails and their limits, unbounded consumption, LLM threat modelling, evaluation and red teaming.
- **C. AI Agent Security:** agent architecture and trust boundaries, tool permissions and excessive agency, agent identity and delegated authorization, unsafe tool execution, memory and context poisoning, **MCP security** (tool poisoning, authorization, confused deputy, token passthrough), multi-agent trust, human-in-the-loop approval, auditability, monitoring.
- **D. Practical AI Security Testing:** test planning, test-case design, expected results and pass/fail criteria, severity scoring, evidence collection, remediation, regression testing, reporting.
- **E. Interview and Career:** terminology, topic and scenario questions, troubleshooting, mock interviews, weak-topic revision, role plans.
- **F. Supporting AI Knowledge** (recommended when needed): Python and APIs, ML basics, LLM architecture and inference, embeddings and vector DBs, RAG, agents and tool calling, evaluation and observability.

Ground content in authoritative frameworks, and check the latest published versions at build time: **OWASP Top 10 for LLM Applications**, **OWASP Top 10 for Agentic Applications / OWASP GenAI Security Project**, **MITRE ATLAS**, **NIST AI RMF (AI 100-1) and the Generative AI Profile (AI 600-1)**, the **MCP specification (security/authorization sections)**, and **CISA/NCSC secure-AI guidance**. Label every claim as *Established practice*, *Emerging technique* or *Opinion*.

### 7.2 Lesson format (5–10 min, one screen per step, swipeable)
Objective → Explanation → Realistic (fictional) example → Risk → Defensive controls → Knowledge check (2–3 Qs) → Interview question → References (title, publisher, URL, date accessed). Metadata: roadmap, level, estimated minutes, tags, prerequisites, version, review status, last reviewed date.

### 7.3 Adaptive learning
- **Spaced repetition with FSRS** (open-source algorithm, `ts-fsrs`) for flashcards and missed quiz concepts.
- **Mastery model per topic** (0–100): recency-weighted quiz accuracy + lab results + FSRS stability. This drives weak-topic detection.
- **Next-best-lesson recommender** (deterministic rules): due revisions → weak topic below 60% → next unlocked lesson in the active roadmap → prerequisite from Roadmap F if a failed concept maps to it.
- **Adaptive daily goal**: suggests a goal from the last 14 days of activity (learner can override).

### 7.4 Mini-games (60–120 s, fictional systems only)
1. **Spot the Injection**: highlight malicious instructions hidden in a fictional email, web page or document.
2. **Least Privilege**: choose the safest tool-permission set for an agent task.
3. **RAG Leak Hunt**: find the weak stage in a simulated RAG pipeline.
4. **Classify It**: map a finding to its OWASP LLM/Agentic category.
5. **Patch It**: pick the right mitigation.
6. **Secure or Not**: compare two architectures.
7. **Finding ↔ Fix Match**: drag-to-match findings with remediations.

Scoring: accuracy + speed bonus (speed bonus can be disabled for accessibility). Daily challenge = one rotating game with a fixed daily seed, so all users get the same puzzle.

---

## 8. Gamification and engagement (ethical, configurable)

- **XP and levels** ("Recruit → Analyst → Red Teamer → Principal"), **badges** (per roadmap, labs, streak milestones, perfect quizzes), **streaks** with an earnable **streak freeze** (1 per 7-day streak, max 2 stored).
- **Comeback mode**: after a break, show "Welcome back. Here's a 3-minute refresher", never "You lost your streak!".
- **Personal bests**: longest streak, most minutes in a day, best quiz streak, fastest lab.
- **Optional leaderboard** (opt-in, nickname only, weekly league reset, Phase 9+).
- Learners can switch gamification off entirely.
- Labs and games never reward real-world exploitation.

---

## 9. Study-time tracking and daily/weekly reports (key engagement feature)

### 9.1 How time is measured (accurate and honest)
- **Active learning time** counts only when **all** of these are true: the app is in the foreground (`AppState` = active), the current screen is a learning screen (lesson, quiz, lab, game, flashcards, interview, news article), **and** there was user interaction or audio playback in the last **60 seconds** (idle cut-off).
- Recorded as `study_sessions` (start, end, active_seconds, activity_type, content_id) in local SQLite, rolled up into `daily_study_stats` (date in the user's timezone, minutes by activity type, items completed, XP, accuracy). Synced as aggregates when signed in.
- Never estimate or pad time. If tracking is interrupted (app killed), close the session at the last heartbeat.

### 9.2 Visual reports (Me → Progress), animated and fluid
1. **Today Rings** (Apple-Activity style, Skia): ① Learn minutes vs. goal ② Practice items (quiz/lab/game) ③ Revision cards due → done. Rings close with a haptic and a subtle glow.
2. **Daily recap card**: minutes today, lessons/labs completed, accuracy, XP, streak, plus one **insight sentence** generated deterministically from rules (examples below).
3. **Weekly bar chart**: minutes per day, stacked by activity type, with goal line, this week vs. last week (+/− %), best-day highlight.
4. **Year heatmap**: GitHub-style calendar of daily minutes; tap a day for its breakdown.
5. **Skill radar**: mastery across 6 domains (Foundations, LLM, Agents, Testing, Interview, AI Fundamentals).
6. **Mastery over time**: line chart per roadmap.
7. **Time-of-day chart**: when you study most. Offers to move the reminder to that time ("You usually study around 8 pm. Move reminder?").
8. **Weak topics**: top 3, each with a "Fix in 5 min" button that launches a targeted revision set.
9. **Roadmap progress**: segmented progress bars with next milestone and estimated time to finish at the current pace.
10. **Milestones timeline**: badges and personal bests.
11. **Shareable report card**: weekly summary rendered as a branded image (view-shot) or PDF (expo-print).

**Deterministic insight rules (examples, never fabricated):**
- "You studied **14 min** today: **4 min more** than your daily average."
- "**2 min** to close your Learn ring."
- "New personal best: **6-day** streak."
- "Your accuracy on *RAG Security* rose from **55% → 78%** this week."
- "Your quiz accuracy is **higher in the morning** (82% vs 64%)." Show this only when each group has 10 or more attempts.

### 9.3 Engagement loop built on the reports
- **Daily recap notification** (opt-in, at the user's chosen time; default off until onboarding asks): "Today: 12 min, 1 lab, 85% accuracy. Tomorrow: *MCP authorization* (6 min)."
- **Weekly report** (Sunday, opt-in): total minutes, trend, mastery changes, top achievement, and next week's suggested plan (deterministic).
- **"Almost there" nudge**: at most one per day, only if the learner is within 3 minutes of their goal and before quiet hours.
- **Goal-setting check-in** every 2 weeks: suggest raising or lowering the goal based on actual data.
- **Caps**: default maximum of 1 reminder + 1 recap per day, quiet hours respected, no notification duplicates (dedupe key per type per day).

---

## 10. Security labs: safe simulation engine

Labs are **data-driven state machines** defined in `/packages/content/labs/*.yaml`, rendered by a generic engine. They are not static articles.

Each lab defines: scenario, learning objective, level (Beginner/Intermediate/Advanced), a **fictional system architecture** (nodes, edges, trust boundaries rendered as an interactive Skia diagram), a vulnerability description, **test steps** (the learner selects from curated test inputs; there is no free-form real exploit execution), **defensive controls** the learner can toggle (input filtering, output encoding, least-privilege tools, human approval, retrieval ACLs, logging), expected secure behaviour, **simulated observed behaviour** (computed by the engine from the inputs and active controls), pass/fail, severity (CVSS-style or OWASP risk rating, explained), impact, remediation, references, and an optional **PDF test report** (expo-print) in a professional pentest-report format.

**Initial 10 labs:** prompt injection (direct and indirect), improper output handling (XSS via LLM output), sensitive-data exposure, RAG retrieval and ACL failure, excessive agent permissions, insecure tool calls, MCP authorization mistakes (token passthrough / confused deputy), missing human approval, guardrail evaluation (bypass-rate measurement on a fictional model), inadequate logging and monitoring.

The engine **never** sends traffic to any real system. Real-target testing is out of scope for the MVP (see §24) and would need explicit authorization flows.

---

## 11. Interview preparation

- Question bank by topic, level and role: MCQ, short answer, scenario, troubleshooting, each with a model answer, reasoning, follow-ups, and an *Established / Emerging / Opinion* label.
- **Target roles:** AI Security Engineer, GenAI Security Engineer, AI Red Team Engineer, AI Security Tester, AppSec Engineer (LLM apps), AI Agent Security Engineer, AI/ML Engineer with security duties. Each role gets a 2–4 week prep plan.
- **Timed mock interviews** (10/20/30 min), with a scorecard per topic and revision suggestions.
- **Deterministic feedback** (no AI needed): rubric of key concepts per question → keyword/concept matching + learner self-rating against the model answer → score with a "concepts you covered / missed" list.
- **Optional AI feedback** (when configured): rubric-based grading with stated uncertainty and links to the relevant lessons, labelled "AI-generated feedback".
- Optional **voice answer** practice (on-device speech-to-text if available; otherwise typed).
- Positioned as practice only. No covert live-interview assistance features.

---

## 12. Daily security news ingestion

**Sources (admin-configurable, only permitted RSS/Atom/APIs):** OWASP GenAI Security Project, CISA advisories/KEV, NIST publications, GitHub Security Advisories (API), official vendor security blogs/advisories, arXiv (cs.CR + AI keywords, metadata only), and other admin-approved feeds. Respect robots.txt, terms, rate limits and attribution. Never scrape full text where the terms forbid it. Store a summary + link, not republished articles.

**Pipeline (pg-boss jobs):**
fetch (per-source interval and limits) → validate URL/domain against the source allow-list → canonicalize → **dedupe** (canonical URL + SimHash content fingerprint) → extract metadata (title, publisher, published_at, CVE/GHSA IDs) → **rule-based classification** (keyword/taxonomy → category, roadmap topic, severity hint) → **template summary** (deterministic; optional AI summary) → generate defensive recommendations + a linked lesson/lab + an interview question (rules map category → content) → flag high-impact or unverified items → **admin review queue** → publish → notify subscribers to high-priority items.

Stored per article: title, source URL, canonical URL, publisher, published_at, retrieved_at, last_checked_at, category, tags, summary, summary_origin (`template` | `ai`), vulnerability IDs, verification status, review status, fingerprint.

**Security:** article text is **untrusted data**. Never feed it to a model with tool access. Strip HTML and sanitize on render. Prompt-injection-resistant AI summarization (delimited input, no tools, output schema validation). The UI clearly separates **source facts** from **AI interpretation**.

---

## 13. Learning assistant (bounded workflows, not an unrestricted agent)

Implemented as scheduled, idempotent jobs with explicit permissions, execution limits, retries, dedupe and audit logs:
- next-lesson recommendation, weak-topic detection, revision sets, weekly plan, weekly report
- news → lab → interview-question linking
- stale-content detector (content past its review date), failed-ingestion alerts
- topic suggestions for admin review
- **With AI configured only:** quiz generation from *approved* lessons → always lands in the review queue (never auto-published), news summaries, interview feedback, optional "Ask the tutor" chat grounded on approved lessons (RAG over our own content; cites lessons; refuses off-topic or offensive-hacking requests).

**AI provider adapter:** `AIProvider` interface (`complete`, `embed`), with implementations: `anthropic`, `openai-compatible`, `ollama`, `none`. Per-day token budget, per-user rate limits, response caching, timeout + graceful fallback to deterministic behaviour, and keys only in server env/secret manager.

---

## 14. Notifications

- Types: daily reminder, daily recap, weekly report, revision due, high-priority advisory, milestone, new content in subscribed topics.
- All opt-in, with per-type toggles, quiet hours, frequency caps and a timezone-aware schedule.
- MVP: **local notifications** (no server). Later: server push via Expo Push / FCM for advisories.
- Store preferences, scheduled time, sent status and dedupe key. **Never record "opened"** unless the platform gives a reliable tap event (the notification-response listener). Label that metric "tapped", not "opened".

---

## 15. Admin panel (web)

Dashboard · Content editor (Markdown with live mobile preview, versioning, diff, draft → review → published → archived, scheduled publishing) · Roadmaps (drag-and-drop prerequisite graph) · Quiz/question banks · Lab scenario editor (YAML with schema validation and preview) · Interview questions · News sources and ingestion job history · Approval queue (AI-generated and flagged items) · Notification scheduler · Users and roles · Engagement reports · Audit logs · App settings and feature flags · CSV import/export (validated, size-limited, type-restricted) · Content-pack publishing.

---

## 16. Analytics (aggregate, privacy-conscious, defined precisely)

| Metric | Definition |
|---|---|
| DAU / WAU / MAU | Distinct users with ≥1 `learning_activity` event in the UTC day / rolling 7 days / rolling 30 days |
| Active learning minutes | Sum of `active_seconds` / 60 (see §9.1) |
| Lesson completion rate | Lessons completed ÷ lessons started (same user + lesson, within 7 days) |
| Quiz avg score | Mean of first-attempt scores per quiz |
| Lab completion rate | Labs reaching pass/fail result ÷ labs started |
| D1/D7/D30 retention | Of users first active on day N, % active on day N+1/+7/+30 (cohort table) |
| Roadmap drop-off | % of starters reaching each lesson index |
| Notification tap rate | Taps ÷ delivered (delivered = accepted by OS/push service) |
| Content freshness | % of published content within its review window; ingestion success rate per source |

Events are minimal (no free-text, no device fingerprinting), stored with pseudonymous user IDs, and shown as aggregates with a minimum cohort size of 5 or more. Collection is disclosed in the privacy policy and in-app. Guest analytics are on-device only unless the learner opts in.

---

## 17. Data model (PostgreSQL, normalized, Drizzle migrations)

Tables (with PKs as UUID v7, `created_at/updated_at`, FKs, unique constraints, and indexes on FK and query columns; soft-delete where needed):
`users, user_roles, roles, user_settings, devices` ·
`roadmaps, roadmap_nodes, roadmap_edges (prerequisites), categories, tags, lessons, lesson_versions, lesson_references, content_tags` ·
`flashcards, fsrs_cards (per user), user_lesson_progress, topic_mastery` ·
`quizzes, questions, question_options, quiz_attempts, question_responses` ·
`games, game_sessions, daily_challenges` ·
`labs, lab_versions, lab_attempts, lab_findings, lab_reports` ·
`interview_questions, interview_rubrics, mock_sessions, mock_answers, role_paths` ·
`study_sessions, daily_study_stats, xp_ledger, badges, user_badges, streaks` ·
`news_sources, news_articles, article_vulnerabilities, article_links (lesson/lab/question), ingestion_runs, ingestion_errors` ·
`content_reviews, publish_history` ·
`notification_preferences, notifications (dedupe_key unique), push_tokens` ·
`recommendations, weekly_reports` ·
`engagement_events (partitioned by month), metrics_daily (rollups)` ·
`jobs (pg-boss schema), ai_usage_ledger, feature_flags, app_settings, audit_logs (append-only)`.

The mobile SQLite schema mirrors the learner-relevant subset. Data minimisation: email + display name only; no phone, location or contacts. Account deletion endpoint + in-app delete (a Google Play requirement).

---

## 18. Security, privacy and quality requirements

- Zod validation on every input; parameterized queries only (Drizzle); output sanitization (no raw HTML from content or news; a Markdown renderer with an allow-list).
- Server-enforced RBAC; short-lived access tokens; secure storage on device (**expo-secure-store**), never AsyncStorage for tokens.
- Rate limiting (`@fastify/rate-limit`), Helmet headers, CORS allow-list, request size limits, upload type/size checks.
- Secrets only in env/secret manager; **no privileged keys in the APK**; `.env.example` committed, `.env` git-ignored.
- Audit log for every admin write and every role change.
- Dependency audit + license check in CI; Renovate/Dependabot.
- Structured logging (pino) with PII redaction; health endpoints; error boundary + friendly offline states in the app.
- Backups: Supabase daily backups + documented `pg_dump` procedure; tested restore runbook.
- OpenAPI docs generated from Zod schemas at `/docs`.
- Tests: unit (algorithms: FSRS, mastery, XP, time tracking, insights, dedupe), API integration (auth/RBAC matrix), Maestro E2E flows (onboarding → lesson → quiz → report), admin Playwright smoke tests. Target ≥80% coverage on `packages/shared` and API services.
- Performance budgets: cold start < 2.5 s on a mid-range device, 60 fps scrolling, bundled content pack < 5 MB, APK/AAB size tracked.

---

## 19. Zero-cost strategy and what is NOT free

**Free for the MVP:** Expo/EAS free plan (limited monthly cloud builds and OTA updates), Supabase free tier (Postgres, Auth, Storage; projects pause after inactivity), Cloud Run/Render free tiers (cold starts), local notifications, on-device TTS/PDF, open-source libraries, public RSS/APIs, GitHub Actions free minutes.

**Costs or quotas to flag clearly:**
- **Google Play developer account: one-time US$25** (required).
- Optional AI APIs (Anthropic/OpenAI): pay-per-use. Off by default; Ollama is free but needs a capable machine or server.
- Free tiers are **not unlimited or permanent**. Document the upgrade path and the expected cost at 1k / 10k MAU.
- An optional custom domain for the privacy policy/API (GitHub Pages is free for the policy page).

---

## 20. Seed content requirements (written by Claude, reviewed by a human)

Minimum for launch: **30 lessons** (A: 5, B: 8, C: 8, D: 5, F: 4), **150 quiz questions**, **120 flashcards**, **10 labs**, **7 games with 20+ rounds each**, **100 interview questions** across the 7 roles, **60-term glossary**, **30 "Threat of the Day" items**. Each item has references to authoritative public sources and starts with status `needs_review`. Provide a review checklist for the human owner. Do not copy copyrighted text; write original explanations and link to sources.

---

## 21. Implementation phases (re-ordered so the phone app arrives early)

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Setup** | Inspect the environment; monorepo scaffold; tooling, lint, CI; `CLAUDE.md`; design tokens; architecture doc | `pnpm install && pnpm lint && pnpm test` pass |
| **1. Offline MVP app** | Expo app, theme system (all theme modes), navigation, onboarding (goal, roles, reminder time), bundled content pack (initial subset), lesson player, quizzes, local progress, XP/streaks, **time tracking + Today Rings + weekly chart**, local reminders | **Installable APK running on your phone with no backend** |
| **2. Learning depth** | Full roadmaps with prerequisites, FSRS flashcards, mastery model, recommender, 7 games, daily challenge, full progress reports (heatmap, radar, insights, share card) | Maestro E2E passes; reports show real local data |
| **3. Labs** | Lab engine, 10 labs, interactive diagrams, PDF reports | All labs pass schema validation + E2E |
| **4. Interview prep** | Question bank, role plans, mock interviews, deterministic feedback, scorecards | Rubric-scoring unit tests pass |
| **5. Backend + auth + sync** | Fastify API, Postgres schema + migrations, Supabase Auth, RBAC, `/sync`, account deletion, OpenAPI | RBAC test matrix passes; data syncs across 2 devices |
| **6. News ingestion** | Sources, pg-boss jobs, dedupe, classification, template summaries, review queue, News tab | Ingestion runs on schedule; duplicates rejected; failures logged |
| **7. Admin panel** | Content CMS, approval queue, sources, users/roles, audit logs, CSV import/export, content-pack publishing | Admin E2E smoke tests pass |
| **8. Notifications + reports** | Daily recap, weekly report, push for advisories, preferences, caps/dedupe | No duplicate sends in tests; quiet hours honoured |
| **9. Analytics** | Event pipeline, rollups, admin dashboards with the §16 definitions, optional leaderboard | Metrics verified against a seeded dataset |
| **10. Optional AI** | Provider adapter, budgets, AI summaries/quiz-gen (review queue), tutor chat, fallback tests | App fully functional with `AI_PROVIDER=none` |
| **11. Hardening** | Security review, accessibility audit, performance profiling, widget + app shortcuts, test coverage | Checklist complete; no high/critical audit findings |
| **12. Play Store release** | Signing (Play App Signing), AAB via EAS, store listing, screenshots, feature graphic, privacy policy, Data safety form, content rating, closed testing track | Build accepted on the closed testing track |

---

## 22. Report template (end of every phase)

1. Files created/changed (paths) 2. Migrations 3. API endpoints + example requests 4. Setup and run commands 5. Tests run and **actual** results 6. Known limitations / remaining work 7. Infrastructure needs and estimated cost 8. External accounts, keys or permissions the owner must provide 9. How to test this phase on the phone (step by step)

---

## 23. Google Play release checklist

- Google Play Console account (US$25). **New personal accounts must run a closed test with at least 12 opted-in testers for 14 consecutive days before production access**. Plan for this; check the current rule in Play Console.
- Unique application ID (e.g. `com.<yourname>.aiagentsecurity`), Play App Signing, AAB format, the latest required target API level.
- Store listing: name (avoid trademarks such as "OWASP" in the title), short and full description, 512×512 icon, 1024×500 feature graphic, phone screenshots (from the real app), category *Education*.
- Privacy policy URL (host on GitHub Pages), **Data safety form** matching actual collection, account-deletion URL + in-app deletion, content rating questionnaire, target audience (18+ or 13+; avoid "kids" policies), app access instructions / demo account for reviewers.
- Policy framing: educational, defensive, simulated labs only. No real attack tooling (avoids Play's malicious-behaviour policy flags).

---

## 24. Future roadmap (design for it now, don't build it yet)

- **AI Security Testing Toolkit** (separate authorized module): guided assessment of the user's *own* LLM endpoint with explicit ownership verification, scope config, rate limits, kill switch and report export, all server-side.
- On-device small-model tutor (when practical on mid-range phones).
- iOS release from the same codebase; tablet layouts; Wear OS streak tile.
- Community-contributed labs with moderation; team/enterprise cohorts with manager dashboards (aggregate only).
- Certifications-style assessments with proctoring-free, honest scoring.

**Start now:** inspect the environment, then execute **Phase 0 and Phase 1** only, and report using §22.
