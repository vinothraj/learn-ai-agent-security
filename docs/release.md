# Releasing to Google Play

Everything in the repository is ready; these steps need your accounts. Commands run from `apps/mobile`
unless noted. Check Play Console for the current rules before you start: they change.

## 0. Decide once (cannot change later)

- **Application ID:** `com.vinoth.aiagentsecurity` in `app.json`. Change it now if you want another; it is
  permanent after the first upload.
- **Contact email:** set `LEGAL.contactEmail` in `packages/content/src/legal.ts` (shown in the app and on the
  privacy page). `npm run site` warns while it is a placeholder.

## 1. Accounts (one-time)

1. Google Play Console developer account (one-time US$25). New **personal** accounts must run a closed
   test with **at least 12 testers opted in for 14 consecutive days** before production access.
2. Expo account (free): `npx eas-cli@latest login`.
3. GitHub repository for the code; turn on **Pages** (Settings → Pages → Source: GitHub Actions). The
   `Pages` workflow then publishes `privacy.html` and `delete-account.html`.

## 2. Backend (needed for accounts, sync, news and push)

Follow docs/backend.md → Production setup (Supabase + a container host). Production requires
`ANALYTICS_SALT`, `CORS_ORIGINS`, `SUPABASE_URL`, `DATABASE_URL`; optional `PUSH=on`, `AI_PROVIDER`.
The app also works with no backend at all (offline mode); then skip sign-in and push.

## 3. Link the project and set build variables

```bash
npx eas-cli@latest init
```

This adds `extra.eas.projectId` to the app config (also enables push). Then set environment variables
for the **production** and **preview** environments (expo.dev → project → Environment variables, or):

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.your-domain.example --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_AUTH_MODE --value supabase --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_ANON_KEY --visibility plaintext
```

Release builds refuse a non-https API or dev sign-in and fall back to offline mode, so a wrong value
cannot ship a test login. For push on Android, upload an FCM V1 service-account key with
`npx eas-cli@latest credentials` (Android → Push notifications).

## 4. Test on your phone first

```bash
npx eas-cli@latest build -p android --profile preview
```

Install the APK from the link, then check: onboarding, a lesson, a lab, the widget (long-press the home
screen → Widgets → AI Agent Security), app shortcuts (long-press the icon), reminders, sign-in, sync on a
second device, news, account deletion. Optional end-to-end: `maestro test .maestro/`.

Replace the draft screenshots in `docs/play-store/screenshots/` with captures from this build.

## 5. Production build and first upload

```bash
npx eas-cli@latest build -p android --profile production
```

This produces an AAB. EAS generates and keeps the **upload key**; Play App Signing holds the app signing
key. The version code auto-increments (`appVersionSource: remote`).

The first upload must be manual: Play Console → Create app → Testing → Internal testing → Create release →
upload the `.aab`. After that you can submit from the CLI with a Play service-account key:

```bash
npx eas-cli@latest submit -p android --profile production   # internal track, as a draft
npx eas-cli@latest submit -p android --profile closed       # closed testing (alpha)
```

## 6. Store listing and policies

Use `docs/play-store/listing.md` (texts, graphics, App content answers) and
`docs/play-store/data-safety.md` (Data safety form). Account-deletion URL:
`https://<github-user>.github.io/<repo>/delete-account.html`.

## 7. Closed test, then production

1. Testing → Closed testing → create a track, add at least 12 testers (Google Group or emails), roll out.
2. Keep at least 12 testers opted in for 14 consecutive days; fix what they report.
3. Apply for production access in the Dashboard, answer the questions about your test, then promote the
   release to Production (staged rollout, e.g. 20%).

## Every later release

1. `npm run check && npm run lint` (CI runs them too, plus the security job).
2. Bump `expo.version` in `app.json` for user-visible versions (the build number increments itself).
3. `npx eas-cli@latest build -p android --profile production`, then submit and promote.
4. Content-only changes don't need a store release: publish a content version in the admin panel.
