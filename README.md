# Learn AI & Agent Security

An offline-first Android app with short daily lessons on AI security, GenAI/LLM security and AI-agent
security. It includes quizzes, interview practice, threat briefings and progress reports based on your
real study time.

## Run it on your phone (fastest: Expo Go, no build needed)

1. On your Android phone, install **Expo Go** from the Play Store.
2. On your laptop (phone and laptop on the **same Wi-Fi**):
   ```bash
   npm install
   npm run mobile
   ```
3. Scan the QR code shown in the terminal with Expo Go. The app loads and reloads live as code changes.

If the corporate network blocks the connection, run `npx expo start --tunnel` from `apps/mobile`.

## Build a real installable APK (cloud build, no Android Studio)

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

EAS prints a download link. Open it on the phone and install the APK. The free EAS plan includes a
limited number of builds per month.

For Google Play, use `--profile production` (AAB), then `npx eas-cli@latest submit -p android`.

## Develop

```bash
npm run check   # type-check + unit tests + content validation
npm run lint
```

See [CLAUDE.md](CLAUDE.md) for architecture and conventions, and [MASTER_PROMPT.md](MASTER_PROMPT.md)
for the full product spec and phase plan.
