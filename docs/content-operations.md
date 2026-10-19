# Running content week to week

How new material reaches learners, what is automatic, and what needs a person. Every path ends in the
same safe place: a **content draft** → submitted → **published by a second admin** → apps download it
over the air on next launch. Nothing AI-generated is ever published without a human approving it.

## What runs by itself

| Job | When | What it does |
|---|---|---|
| News ingestion | Server timer, plus GitHub Actions every 3 hours | Fetches due feeds; routine items from official sources publish automatically, high-impact or unverified items wait in **News review** |
| Weekly drafts | GitHub Actions, Mondays 05:30 UTC | Turns the past week's published news into a quiz question and flashcards per article, for the linked lesson, in **AI drafts** (needs AI) |

Both can also be run from the admin panel: **Sources → Fetch all due feeds now** and
**AI drafts → Draft from this week's news**.

## Your 10-minute weekly routine

1. **News review:** approve or reject anything waiting (high-impact items also send push alerts once published).
2. **AI drafts:** for each draft, open the source link, approve what is accurate, reject the rest.
3. Press **Add to content draft** on approved items. They collect into one draft for the session.
4. Open the draft, check the validation panel is green, **Submit for review**.
5. A second admin (or you, if you are the super-admin) **publishes** it. Apps pick it up on next launch.

## Bulk import (any time)

**Content → Bulk import** adds many items at once to a new or existing draft. Use **Check** first; if
any row is invalid nothing is imported and you get the row numbers to fix. Templates are downloadable
from the panel.

| What | Format | Columns / fields |
|---|---|---|
| Flashcards | CSV or JSON | `lessonId, front, back` |
| Quiz questions | CSV or JSON | `lessonId, prompt, option1…option5, correct` (1-based), `explanation`; at most 5 questions per lesson |
| Interview questions | JSON | Same fields as the content editor; the model answer must cover 80% of its rubric |

Up to 500 rows per import. Exact duplicates are skipped. Lesson ids are listed in the content editor.

## Free scheduling with GitHub Actions

The workflow `.github/workflows/content-jobs.yml` calls the API's job endpoints. It also wakes free
hosting tiers that sleep when idle (their own timers stop while asleep).

1. Generate a random token (32+ characters), e.g. `openssl rand -hex 32`.
2. Set it as `JOB_TOKEN` on the API host.
3. In GitHub: Settings → Secrets and variables → Actions → add `API_URL` (https://your-api…) and `JOB_TOKEN`.
4. Run the workflow once by hand (Actions → Content jobs → Run workflow) to check it.

Public repositories get unlimited Actions minutes; private ones get a free monthly allowance that these
short jobs barely touch.

## AI for drafts at no cost

Weekly drafts and quiz drafting use the API's AI provider (`AI_PROVIDER`, see backend.md → Optional AI).
Free options:

- **Ollama** (fully free, private): install it on the machine that runs the API, `ollama pull llama3.2`,
  then `AI_PROVIDER=ollama` and `AI_MODEL=llama3.2`. Works when the API runs on your laptop or a server
  you control; a cloud-hosted API cannot reach Ollama on your laptop.
- **Free tiers of OpenAI-compatible APIs** (e.g. Google Gemini or Groq): `AI_PROVIDER=openai-compatible`
  with their base URL, key and model. Check each provider's current limits and data terms: some free
  tiers may use prompts to improve their products, so use them only for public text such as news drafts,
  not for learner features like tutor answers or interview feedback.

**Measured with Ollama `llama3.2` (3B) on this development laptop (CPU only), 2026-10-19:**

| Task | Time | Quality |
|---|---|---|
| Weekly news draft | 20–60 s per article | Usable flashcards; questions sometimes have a wrong answer key or copy placeholder text. Automatic checks drop those, but facts still need a human check against the source. |
| Tutor answer | about 110 s | Accurate when grounded in the lesson, but far too slow for learners |

Recommendation: use Ollama on a laptop for **background drafts only** and leave the learner-facing
tutor on lesson-based answers (AI off, or a fast hosted model). A larger model (e.g. 8B) improves quality
if the machine has the memory; a GPU makes interactive use realistic.

**Automatic quality checks on AI drafts** (deterministic, before anything reaches the review queue):
each question and flashcard is validated on its own and invalid ones are dropped; placeholder options
("A", "B"…) or the prompt's own example are rejected; a question is dropped when its explanation quotes a
different option than the one marked correct; flashcards that repeat the front are dropped.
`npx tsx scripts/try-news-pack.ts` (in `apps/api`) shows raw model output for prompt tuning.

Turn on the `ai` flag (Feature flags) after configuring the provider. The `weekly_drafts` flag switches
the Monday job off without touching other AI features.

## Larger content updates

New lessons, labs or games are best added as code in `packages/content` (validated by tests, shipped in
the app and publishable as a pack), or through the content editor's JSON mode. Bump the pack version
(`2026.11.1`, …) so apps accept the update.
