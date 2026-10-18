# Play Store listing (draft)

Paste into Play Console → Grow → Store presence → Main store listing. Character limits are Google's.

**App name (≤ 30):** `AI Agent Security: Learn & Lab` (30)

**Short description (≤ 80):**
`Learn AI, LLM & agent security in 5-minute lessons, safe labs and interview prep` (80)

**Full description (≤ 4000):**

```
Build real AI security skills in five minutes a day.

AI Agent Security teaches defensive security for AI, large language models (LLMs) and AI agents through short lessons, quizzes, safe simulated labs and interview practice. It works fully offline, with no account, no ads and no trackers.

WHAT YOU LEARN
• Prompt injection, direct and indirect, and why filters alone fail
• Sensitive-data leaks, RAG security and tenant isolation
• Improper output handling and unsafe tool use
• Agent permissions, excessive agency and human approval
• MCP (Model Context Protocol) security: tool poisoning, tokens, authorization
• Threat modelling, AI red-team test planning, severity scoring and reporting

HOW IT WORKS
• 5–10 minute lessons with quizzes and spaced-repetition flashcards
• 10 hands-on labs on fictional systems: attack, add controls, then write the report
• Mini-games and a daily challenge to practise spotting risks
• Interview prep for 7 AI security roles, with rubric feedback and timed mock interviews
• Ask the tutor: answers from the lessons, with links to read more
• A daily security news feed from official sources, linked to the lesson that explains it

TRACK YOUR PROGRESS
• Today rings for learning, practice and revision
• Streaks (with freezes), XP, badges and a study heatmap
• Weekly reports with your minutes, accuracy and weakest topics
• Gentle reminders you control, with quiet hours

PRIVATE BY DESIGN
• Everything works without an account; progress stays on your phone
• Optional sign-in to back up and sync across devices
• Export or delete your data at any time
• No ads, no third-party analytics

Labs simulate fictional systems only. The app teaches defence and never runs attacks against real systems.
```

**Category:** Education · **Tags:** Education, Computer science, Cybersecurity
**Contact email:** the same address as `LEGAL.contactEmail` · **Website:** the GitHub Pages URL
**Privacy policy URL:** `https://<github-user>.github.io/<repo>/privacy.html`

## Graphics

| Asset | File | Spec |
|---|---|---|
| App icon | `graphics/icon-512.png` | 512 × 512 PNG |
| Feature graphic | `graphics/feature-graphic.png` | 1024 × 500 PNG |
| Phone screenshots | `screenshots/01-home.png` … `07-interview.png` | 1082 × 2158 PNG (2:1 max) |

Screenshots are drafts captured from the web build by `node scripts/store-screenshots.mjs`. Before
production, replace them with captures from an installed preview build on a phone (Play expects the
real Android app). Add a 7-inch and 10-inch tablet set only if you opt into tablet distribution.

## App content answers (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | GitHub Pages `privacy.html` URL |
| Ads | No ads |
| App access | All functionality available without special access. Sign-in is optional (email one-time code). |
| Content rating (IARC) | Category: Reference, News, or Educational. No violence, sexuality, profanity, drugs, gambling. Users do **not** interact or exchange content (the community is not built yet). No location sharing, no digital purchases. Expected: Everyone / PEGI 3. |
| Target audience | 16–17 and 18+. Not appealing to children. |
| News app | No (news is a supporting feature; declare "news" only if Google asks) |
| Data safety | See `data-safety.md` |
| Government app / Financial features / Health | No / None / No |
| Account deletion | In-app (Settings → Account → Delete account) and web URL `delete-account.html` |

## Policy framing

Describe the app as educational and defensive. Do not use "OWASP", "MITRE" or vendor names in the title or
icon. The labs are scripted simulations of fictional systems, which avoids Play's malicious-behaviour policies.
