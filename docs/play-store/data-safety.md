# Data safety form answers

Play Console → Policy → App content → Data safety. These answers match the code as of version 1.0.0 (build 5, Google sign-in) and were entered in Play Console on 2026-10-25 and
the privacy policy (`packages/content/src/legal.ts`). If you change what is collected, update all three.

## Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** (only when the user signs in or turns on optional features) |
| Is all user data collected by your app encrypted in transit? | **Yes** |
| Do you provide a way for users to request that their data be deleted? | **Yes**: in-app and via the web URL |
| Account creation methods | **Username and other authentication** (email one-time code) and **OAuth** (Google) |
| Delete account URL / Delete data URL | `https://vinothraj.github.io/learn-ai-agent-security/delete-account.html` (both; the page covers full and partial deletion) |
| Delete some data without deleting the account? | **Yes**: usage statistics via Settings toggle; anything else by email |
| Shared with third parties? | **No**: Supabase, the API host, Expo/FCM and the AI provider are service providers acting for us, which Play does not count as sharing |

## Data types

| Data type | Collected | Optional? | Ephemeral? | Purposes |
|---|---|---|---|---|
| Personal info → **Email address** | Yes | Optional (sign-in) | No | Account management |
| Personal info → **Name** (display name; filled from Google if empty) | Yes | Optional | No | App functionality, Account management |
| Personal info → **User IDs** (account ID) | Yes | Optional (sign-in) | No | Account management |
| App activity → **App interactions** (lesson progress, quiz results, study time, XP; opt-in usage statistics) | Yes | Optional (sign-in / opt-in) | No | App functionality; Analytics (opt-in only) |
| App activity → **Other user-generated content** (tutor questions, interview answers sent for AI feedback) | Yes | Optional | **Yes** (processed to produce a reply, not stored) | App functionality |
| Device or other IDs → **Device or other IDs** (Expo push token) | Yes | Optional (push alerts) | No | App functionality (notifications) |

Not collected: location, contacts, photos, audio, files, calendar, financial info, health, web history,
crash logs or diagnostics, advertising ID.

Data that never leaves the device without sign-in (progress, typed interview answers, settings) is
**not** "collected" under Play's definition and is not declared.

## Security practices

- Data encrypted in transit: Yes (HTTPS only)
- Users can request deletion: Yes (`delete-account.html`; Settings → Account → Delete account)
- Independent security review: No (internal review in docs/security.md)
- Committed to the Families Policy: No (not designed for children)
