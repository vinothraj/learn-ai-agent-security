# Security review (Phase 11)

Scope: the Android app (`apps/mobile`), the API (`apps/api`), the admin panel (`apps/admin`) and the
build pipeline. Reviewed against OWASP ASVS 4.0 Level 2 and the OWASP Mobile Top 10. Last review:
2026-10-18. Re-review before each Play release and whenever auth, sync, payments or the community change.

**Result: no open high or critical findings.** Two accepted build-time dependency advisories are listed
at the end with their review date.

## Threat model (summary)

| Asset | Threats | Main controls |
|---|---|---|
| Learner progress and account | Account takeover, cross-account data mixing, data loss | Supabase OTP auth, JWT verification (issuer, audience, expiry, algorithms), per-user row scoping, `sync_owner_id` guard, export and deletion |
| Admin and content integrity | Privilege escalation, malicious or wrong content | Server-side RBAC, four-eyes publishing, append-only audit log, `packIssues()` gate, checksum on OTA packs |
| News feed | Malicious feed content, SSRF via admin-added feeds | Plain-text storage, no HTML rendering, domain allow-lists, XXE-safe parser, SSRF guard on every hop |
| Optional AI | Prompt injection, cost abuse, data leakage | Delimited untrusted input, no tools, schema-validated output, token budget and per-user caps, interview answers never cached |
| Analytics | Re-identification | Opt-in only, HMAC pseudonyms, no free text, cohort suppression under 5 |

## ASVS Level 2 checklist (condensed)

| Area | Status | Evidence |
|---|---|---|
| V1 Architecture | ✅ | Deterministic core; AI, push and analytics optional and flag-gated; secrets only server-side (`config.ts` refuses unsafe production settings) |
| V2 Authentication | ✅ | Email OTP via Supabase; no passwords stored by us; dev tokens impossible in production (`/dev/token` not registered) |
| V3 Session management | ✅ | Short-lived access JWTs, refresh token in Android Keystore-backed SecureStore; admin session in `sessionStorage` (cleared on tab close) |
| V4 Access control | ✅ | `requireAuth`/`requireRole` on every protected route; RBAC test matrix; four-eyes for publishing and AI drafts; users only see their own sync records |
| V5 Validation and encoding | ✅ | zod strict schemas on every body/query/param; parameterised SQL only; lab report HTML escaped (unit-tested); CSV formula neutralisation |
| V7 Errors and logging | ✅ | 500s return a generic message; `authorization`/`cookie` redacted from logs; AI and push errors never log request bodies or provider responses |
| V8 Data protection | ✅ | Data minimisation; export (`/v1/me/export`) and deletion (`DELETE /v1/me`) incl. analytics; no ads or third-party trackers |
| V9 Communications | ✅ | HTTPS only for feeds, AI and Expo push; deploy the API behind TLS (Cloud Run/Render/Fly terminate TLS) |
| V10 Malicious code | ✅ | Dependency audit gate and gitleaks secret scan in CI; lockfile committed |
| V11 Business logic | ✅ | Rate limits (global and per route), daily caps for push and AI, idempotent XP and analytics keys |
| V12 Files and resources | ✅ | 1 MB body limit (5 MB for content packs), feed size cap 2 MB, SSRF guard (`net.ts`) with manual redirect checks |
| V13 API | ✅ | OpenAPI documented; CORS allow-list; native app sends no Origin |
| V14 Configuration | ✅ | helmet headers, admin CSP in production builds, production config guard, `.env*` git-ignored |

## Mobile (OWASP Mobile Top 10)

- **M1 credentials:** refresh token in `expo-secure-store`; no API keys in the app (the Supabase anon key is public by design and is used only for email sign-in; all data goes through our API).
- **M3 auth/authorization:** never trusted client-side; every role check is enforced by the API.
- **M4 input/output:** deep links and notification payloads only open allow-listed in-app routes (`safeRoute`); external links must be `https://` (`openExternal`); feed text is never rendered as HTML.
- **M5 communication:** HTTPS API in production builds (`EXPO_PUBLIC_API_URL`).
- **M6 privacy:** analytics opt-in; interview answers stay on the device unless the learner asks for AI feedback.
- **M8 misconfiguration:** sensitive Android permissions blocked in `app.json` (`RECORD_AUDIO`, location, contacts).
- **M9 data storage:** progress in app-private SQLite; Android auto-backup is allowed for progress only (SecureStore keys are not restorable, so a restored device signs in again).

## Fixed in this review

1. **SSRF via admin-configured feeds:** feeds could target internal addresses or redirect to them. Now `assertPublicHttpsUrl` resolves the host and rejects loopback, private, link-local (incl. cloud metadata) and other non-public ranges on every redirect hop; feed URLs are shape-checked on creation. Residual risk: DNS rebinding between check and connect (low; admin-only input).
2. **External links:** all go through `openExternal`, which only opens `https://` URLs.
3. **Admin panel CSP:** production builds ship a strict Content Security Policy (`script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `connect-src` limited to the API and Supabase).
4. **Dependency:** `uuid` forced to 11.1.1 (advisory in the iOS prebuild tool chain).

## Hosting requirements

- Serve the admin panel with `Content-Security-Policy: frame-ancestors 'none'` (or `X-Frame-Options: DENY`), `Strict-Transport-Security`, and `X-Content-Type-Options: nosniff` headers; a meta tag cannot set `frame-ancestors`.
- Set `ANALYTICS_SALT`, `CORS_ORIGINS`, `SUPABASE_URL` and `DATABASE_URL`; the server refuses to start in production without them.
- Keep `AI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `EXPO_ACCESS_TOKEN` in the host's secret manager.

## Accepted risks

| Advisory | Where | Why accepted | Review by |
|---|---|---|---|
| `node-forge` (signature verification) | `@expo/cli` only: dev-server and code-signing certificates at build time | Not shipped in the app or API; no patched version exists | 2027-01-31 |
| `braces` (ReDoS) | Metro file watching via `micromatch` | Patterns come from our own config, not users; not shipped; no patched version exists | 2027-01-31 |

`npm run audit:deps` fails CI on any other high or critical advisory, and on these once their review date passes.

## Accessibility (WCAG 2.2 AA)

- Colour contrast is unit-tested for all 4 theme modes × 6 accents (`src/theme/contrast.test.ts`): text, muted text, accent links and status colours ≥ 4.5:1; the high-contrast theme ≥ 7:1.
- Touch targets ≥ 48dp (buttons 52dp; chips 40dp + hit slop).
- Every pressable has an accessibility role and label; charts have text equivalents (heatmap cells announce date and minutes).
- Font scaling honoured up to 1.6×; reduced motion respected (system setting and in-app switch).
- The home-screen widget sets an accessibility label describing its content.
