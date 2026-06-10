# Admin Portal

Web-based admin interface for managing lessons (CRUD with live mobile preview), keywords, push notifications, and syncing content from dev to prod. Built with React + Vite, backed by Express API routes.

## Production URL

**`https://admin.hinora.co`** — hosted on Vercel (project: `pcit`). DNS for `admin.hinora.co` points to Vercel. `vercel.json` rewrites all `/api/*` requests to the prod App Runner (`https://wpwpawhz29.ap-southeast-1.awsapprunner.com`).

## Quick Start (local dev)

```bash
# Start backend
node server.cjs

# Start admin dev server (in separate terminal)
cd admin && npm run dev
```

Open `http://localhost:5173/admin` and log in with the `ADMIN_PASSWORD` from `.env`.

The Vite dev server proxies `/api` to `localhost:3001` (local backend).

## Deploying

### Switching the API backend (dev ↔ prod)

```bash
./admin-switch.sh dev    # point admin.hinora.co → dev App Runner (us-east-1)
./admin-switch.sh prod   # point admin.hinora.co → prod App Runner (ap-southeast-1)
```

`admin-switch.sh` rewrites `admin/vercel.json` with the correct App Runner URL and immediately redeploys to Vercel. Default is prod. After switching to dev, `admin/vercel.json` will appear modified in git — don't commit it while pointing at dev.

### Frontend (admin SPA)

```bash
# From repo root
npx vercel --prod --scope qiuy0002-gmailcoms-projects --yes --archive=tgz
```

This builds `admin/` and deploys to Vercel. The live site at `admin.hinora.co` updates immediately.

### Backend + DB migrations

```bash
# 1. With dev DB tunnel running, create and apply migration to dev
npx prisma migrate dev --name <description>

# 2. Deploy backend to prod (migration auto-applies on container startup)
./docker_deploy_prod.sh
```

`prisma migrate deploy` runs automatically in `entrypoint.sh` on every container startup — it applies any committed migration files not yet applied to the connected DB.

**Never use `prisma db push`** — it applies schema changes directly to the DB without creating a migration file, causing drift between dev and prod.

## Architecture

| Layer | Technology | Location |
|-------|-----------|----------|
| Frontend | React 18 + Vite + TypeScript | `admin/` |
| Hosting | Vercel (project: `pcit`) | `admin.hinora.co` |
| API proxy | `vercel.json` rewrites `/api/*` → prod App Runner | `admin/vercel.json` |
| API | Express routes at `/api/admin/*` | `server/routes/admin.cjs` |
| Auth middleware | JWT with `{ role: 'admin' }` | `server/middleware/adminAuth.cjs` |
| Database | Prisma (same as mobile app) | `prisma/schema.prisma` |

In production, all `/api/*` calls from the SPA are rewritten by Vercel to the prod App Runner. The SPA itself is served by Vercel's CDN.

## Authentication

Simple password-based auth — no user accounts needed.

1. Admin enters password on login page
2. `POST /api/admin/auth/login` compares against `ADMIN_PASSWORD` env var using `crypto.timingSafeEqual`
3. Returns a JWT (24h expiry) signed with existing `JWT_ACCESS_SECRET`, payload: `{ role: 'admin' }`
4. Frontend stores token in `localStorage` and injects via `Authorization: Bearer <token>` header
5. `requireAdminAuth` middleware verifies token and checks `role === 'admin'`

**Environment variable:** Add `ADMIN_PASSWORD` to `.env` (see `.env.example`).

## API Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/admin/auth/login` | No | Login with password, returns JWT |
| `GET` | `/api/admin/auth/verify` | Yes | Verify current token is valid |

### Lessons

All require admin auth.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/lessons?module=X` | List lessons with segment count, optional module filter |
| `GET` | `/api/admin/lessons/:id` | Full lesson detail (segments + quiz + options) |
| `POST` | `/api/admin/lessons` | Create lesson + segments + quiz in one transaction |
| `PUT` | `/api/admin/lessons/:id` | Update lesson metadata, replace segments + quiz |
| `DELETE` | `/api/admin/lessons/:id` | Delete lesson (cascades to segments, quiz, progress) |
| `GET` | `/api/admin/modules` | List modules for filter dropdowns |
| `POST` | `/api/admin/modules` | Create a new module |
| `PUT` | `/api/admin/modules/:key` | Update module details |

### Keywords

All require admin auth.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/keywords?search=X` | List all keywords, optional search filter |
| `POST` | `/api/admin/keywords` | Create a keyword |
| `PUT` | `/api/admin/keywords/:id` | Update a keyword |
| `DELETE` | `/api/admin/keywords/:id` | Delete a keyword |

### Users

All require admin auth.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | List all users with name, email, joined date, last active, session count, tag, child birthday, issue, latest WACB total score, and `isFreeAccount` flag |
| `PUT` | `/api/admin/users/:id/tag` | Update user tag (`user` or `tester`) |
| `GET` | `/api/admin/users/:id/profile` | User's completed lessons and sessions |
| `PUT` | `/api/admin/users/:id/free-account` | Grant or revoke free account access. Body: `{ isFreeAccount: boolean }` |

### Notifications

All require admin auth.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/notifications/send` | Send push notification to selected users |

### Subscriptions

All require admin auth.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/subscriptions` | List all non-deleted users with subscription status/plan/trial dates, and `isFreeAccount` flag. Optional `?status=` filter (TRIAL, ACTIVE, EXPIRED, CANCELLED, NONE, INACTIVE) |
| `POST` | `/api/admin/subscriptions/sync-from-rc` | Fetch RevenueCat subscription data for every user and update the DB. Rate-limited (~100 req/min). Returns `{ synced, failed, skipped }` |
| `POST` | `/api/admin/subscriptions/send-trial-expiry-emails` | Manually trigger trial expiry reminder emails. Body: `{ daysBeforeExpiry?: number }` (default: 3) |

### Free Accounts

All require admin auth.

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/admin/users/:id/free-account` | Grant or revoke free account for an existing user. Body: `{ isFreeAccount: boolean }` |
| `GET` | `/api/admin/free-account-whitelist` | List all whitelist entries (emails that will receive free access on signup) |
| `POST` | `/api/admin/free-account-whitelist` | Add an email to the whitelist. Body: `{ email: string }`. If the account already exists, grants free access immediately and returns `{ userGranted: true }` |
| `DELETE` | `/api/admin/free-account-whitelist/:id` | Remove an email from the whitelist. Does **not** revoke access from users who have already signed up |

### Weekly Reports

All require admin auth.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users/:id/weekly-reports` | List all weekly reports for a user (all visibility states) |
| `GET` | `/api/admin/weekly-reports/:id` | Full report detail with presigned audio URLs |
| `POST` | `/api/admin/weekly-reports/generate` | Generate a report for one user. Body: `{ userId, weekStartDate? }`. Saves with `visibility: false`. |
| `POST` | `/api/admin/weekly-reports/generate-all` | Generate reports for all users with completed sessions in the week. Body: `{ weekStartDate? }`. |
| `PUT` | `/api/admin/weekly-reports/:id/visibility` | Toggle visibility. **Automatically sends push notification when setting `true`** (only fires once, on transition from false→true). |

### Sync to Prod

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/admin/sync-to-prod` | Admin JWT | Reads all content from dev DB, forwards to prod API |
| `POST` | `/api/admin/receive-sync` | `SYNC_SECRET` header | Upserts received content into the connected DB |

`sync-to-prod` is called by the admin portal (running against dev API). It reads Modules, Lessons (with segments + quizzes), and Keywords from the dev DB, then makes a server-to-server HTTPS call to the prod API's `receive-sync` endpoint.

`receive-sync` is called by the dev API (server-to-server, not directly from the browser). It upserts all content into whichever DB the receiving server is connected to. Segments are upserted by ID — existing user data (TextInputResponse) is never deleted. Quiz options are delete-and-recreated (safe because QuizResponse stores the selected answer as a plain string).

**Required env vars:**

| Var | Service | Value |
|-----|---------|-------|
| `PROD_API_URL` | Dev App Runner (us-east-1) | `https://wpwpawhz29.ap-southeast-1.awsapprunner.com` |
| `SYNC_SECRET` | Both App Runners | Shared random secret (set via AWS Console) |

## Lesson ID Convention

IDs are deterministic, not UUIDs:

| Entity | Pattern | Example |
|--------|---------|---------|
| Lesson | `{MODULE}-{dayNumber}` | `FOUNDATION-1` |
| Segment | `{lessonId}-seg-{order}` | `FOUNDATION-1-seg-1` |
| Quiz | `{lessonId}-quiz` | `FOUNDATION-1-quiz` |
| Quiz option | `{lessonId}-quiz-opt-{A\|B\|C\|D}` | `FOUNDATION-1-quiz-opt-A` |

When updating, segments and quiz options are fully replaced (delete + recreate) to keep IDs consistent with order.

## Frontend Structure

```
admin/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx                          # Entry point
    ├── App.tsx                           # Router with protected routes
    ├── api/
    │   ├── client.ts                     # Fetch wrapper with JWT injection
    │   └── adminApi.ts                   # Typed API functions
    ├── auth/
    │   ├── AuthContext.tsx                # Auth state context + login/logout
    │   └── ProtectedRoute.tsx            # Route guard (redirects to /login)
    ├── pages/
    │   ├── LoginPage.tsx                 # Password login
    │   ├── LessonListPage.tsx            # Module-filterable table with delete
    │   ├── LessonEditorPage.tsx          # Split-pane: form + live preview
    │   ├── NotificationsPage.tsx         # User selection + notification sender
    │   ├── SubscriptionsPage.tsx         # Subscription status view + trial expiry email trigger
    │   └── FreeAccountsPage.tsx          # Grant/revoke free access; manage signup whitelist
    ├── components/
    │   ├── layout/
    │   │   └── AdminLayout.tsx           # Sidebar + content shell
    │   ├── lessons/
    │   │   ├── MetadataForm.tsx          # Lesson metadata fields
    │   │   ├── SegmentList.tsx           # Drag-reorderable segment list (dnd-kit)
    │   │   ├── SegmentEditor.tsx         # Single segment editor form
    │   │   └── QuizEditor.tsx            # Quiz question + 4 options editor
    │   ├── preview/
    │   │   ├── PhonePreview.tsx          # iPhone frame CSS wrapper
    │   │   └── LessonPreview.tsx         # Renders segments inside phone frame
    │   └── notifications/
    │       ├── UserList.tsx              # User table with checkboxes
    │       └── NotificationSender.tsx    # Title/body inputs + send button
    └── styles/
        └── globals.css                   # Admin styles + preview CSS
```

## Pages

### Lesson List (`/lessons`)

- Table showing all lessons with ID, module, day, title, segment count, quiz status, last updated
- Module filter dropdown (populated from `/api/admin/modules`)
- Click row to edit, "Delete" button per row with confirmation
- "+ New Lesson" button navigates to editor
- "+ Add Module" button opens a modal to create a new module (key selected from available `LessonModule` enum values)
- "Edit Module" button appears next to the filter when a module is selected — opens the same modal pre-filled for editing title, shortName, description, displayOrder, and backgroundColor

### Lesson Editor (`/lessons/new` or `/lessons/:id`)

Split-pane layout:

- **Left panel:** Form with three sections:
  - **Metadata** — module, day number, title, subtitle, description, objectives, categories, colors
  - **Segments** — drag-reorderable list (using `@dnd-kit`), each with section title, content type, body text. `TEXT_INPUT` type shows extra fields for ideal answer and AI check mode
  - **Quiz** — optional, with question, 4 options (click letter to mark correct), explanation

- **Right panel:** Live iPhone preview
  - Reuses iPhone frame CSS from `public/share-lesson.html`
  - `formatBodyText` / `formatInlineText` ported from share page (supports `**bold**` and `* bullets`)
  - Content types styled: TIP (yellow), SCRIPT (blue), EXAMPLE (purple border), CALLOUT (purple bg), TEXT_INPUT (green bg with placeholder input)
  - Navigate between segments with arrow buttons
  - Preview updates on form changes (debounced 300ms)
  - iPhone 13 frame (390x844pt), scaled to 52% to fit the sidebar
  - Preview styles match the real mobile app (font sizes, colors, button styles)

### Text Formatting

The body text textarea supports:
- `**bold text**` — Ctrl+B (or Cmd+B) toggles bold on selected text
- `* bullet item` — lines starting with `* ` render as styled bullet points
- Blank lines add spacing

### Keywords (`/keywords`)

- Table of all glossary keywords with term and definition
- Search box filters in real-time
- Inline create and edit forms
- Delete with confirmation

### Users (`/users`)

- Table of all registered users: user ID (clickable), name, email, joined date, last active date, session count, tag, child birthday, issue, WACB score (latest `totalScore` from `wacbsurvey`)
- Click any column header to sort (toggles asc/desc)
- **Tag** column: inline dropdown to toggle between `user` and `tester` — persisted immediately via `PUT /api/admin/users/:id/tag`
- Click a user ID to open the user detail page
- The API also returns subscription fields (`subscriptionStatus`, `subscriptionPlan`, `trialStartDate`, `trialEndDate`, etc.) — see the **Subscriptions** page for a dedicated view

### Subscriptions (`/subscriptions`)

- Table of all users with their subscription status, plan, trial start/end, and subscription start/end dates
- **Status badge** color-coded: TRIAL (amber), ACTIVE (green), EXPIRED (red), CANCELLED/NONE/INACTIVE (grey)
- **Trial End** column highlights users whose trial expires within 7 days; shows days remaining in parentheses
- **Free Account** column: shows a green "FREE" badge for free-account users; Grant/Revoke button per row
- Filter dropdown to show only users in a specific status (TRIAL, ACTIVE, EXPIRED, etc.)
- **Status summary strip** at the top showing counts per status, including free account count
- **Sync from RevenueCat** button: fetches live subscription data from RevenueCat for all users, updates the DB, then refreshes the table. Takes ~1 min for 100 users (rate-limited). Use this whenever the displayed status/plan looks stale
- **Send Emails** panel: set "days before expiry" (default 3), click "Send Emails" to immediately dispatch trial expiry reminder emails to all matching TRIAL users — useful for ad-hoc sends outside the daily cron

### Free Accounts (`/free-accounts`)

Central place to manage subscription-bypass access. Two sections:

**Active — signed up**

- Lists all users with `isFreeAccount = true` (already have an account)
- Columns: name, email, joined date, Revoke button
- **Revoke** removes free access; user falls back to normal subscription rules

**Pending signup — whitelist**

- Lists emails in `FreeAccountWhitelist` that have not yet signed up (deduped — emails that appear in the Active section are hidden)
- Columns: email, date whitelisted, Remove button
- **Remove** deletes the whitelist entry; does not affect users who have already signed up

**Grant free access form** (top of page)

- Enter any email address and click **Grant**
- If an account with that email already exists: `isFreeAccount` is set to `true` immediately and the user moves to the Active section
- If no account exists: the email is added to the whitelist and appears in the Pending section — free access is granted automatically when they sign up

**How the whitelist works at signup:**

When a new user signs up (email/password or social auth), the server computes a SHA-256 hash of their email and checks `FreeAccountWhitelist`. If a match is found, `isFreeAccount` is set to `true` before the session is created — the user never hits the paywall.

**Mobile behaviour:**

`SubscriptionContext` force-refreshes the user from the server on each app launch (`getCurrentUser(true)`) so the `isFreeAccount` flag is always current. When `isFreeAccount` is true, RevenueCat is skipped entirely and `isSubscribed` is set to `true`. Any stale `@nora_free_limit_reached` AsyncStorage flag is cleared so the Record tab never redirects to the subscription screen.

### Trial Expiry Notification System

A scheduled job (`server/jobs/trialExpiryJob.cjs`) runs daily at **10:00am SGT (02:00 UTC)** via `node-cron`. It checks RevenueCat for every user and sends a reminder email to users whose trial ends in **exactly 3 days**.

**Job flow:**
1. Fetches all users from the DB
2. Pre-aggregates session `overallScore` sums and latest published `WeeklyReport` per user
3. Iterates each user, calling the RevenueCat API with a 600ms delay (~100 req/min to stay under RC's limit)
4. For each user, checks if they have a trial subscription that:
   - Has `period_type === 'trial'`
   - Has NOT been cancelled (`unsubscribe_detected_at` is null)
   - Expires on **exactly** the target day (UTC date boundary match)
5. Sends an HTML email with their progress stats

**Email content:**
- Sessions completed
- Total emotional account deposits (sum of session `overallScore`)
- Strongest skill (from latest weekly report — defaults to **Narrate** if no report exists)
- Trial renewal date (formatted in SGT timezone)

**Sender:** `Nora Parenting <info@chromamind.ai>` (authenticated via `yihui.qiu@chromamind.ai` SMTP, which has `info@chromamind.ai` configured as a "Send mail as" alias in Gmail)

**Checking expiring users locally** — use `scripts/check-trial-expiry.cjs` to dry-run against prod without sending emails:

```bash
# Requires prod DB tunnel on localhost:5433
DATABASE_URL="postgresql://nora_admin:<pass>@localhost:5433/nora" \
  node scripts/check-trial-expiry.cjs 3
```

**Required env vars:** `REVENUECAT_SECRET_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`

**Manually drafting and sending a trial expiry email for a specific user**

Use `scripts/_tmp_draft_trial_email.cjs` to render the email HTML for one user without sending it, and `scripts/_tmp_send_trial_email.cjs` to send it. Both scripts require a prod DB tunnel and read SMTP/RC credentials from `.env`.

1. Start the prod DB tunnel:
   ```bash
   ./scripts/start-prod-db-tunnel.sh
   ```

2. Retrieve the prod DB password:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id "arn:aws:secretsmanager:ap-southeast-1:059364397483:secret:nora/database-url-893xxi" \
     --region ap-southeast-1 \
     --query 'SecretString' --output text
   ```

3. Set `TARGET_USER_ID` in the script to the target user's UUID, then draft (no send):
   ```bash
   DATABASE_URL="postgresql://nora_admin:<pass>@localhost:5433/nora" \
     node scripts/_tmp_draft_trial_email.cjs
   ```
   Opens `scripts/_tmp_draft_trial_email.html` — preview in a browser. The script prints the resolved subject, from, to, and all stats (sessions, deposits, skill, trial expiry date).

4. Once satisfied, send:
   ```bash
   DATABASE_URL="postgresql://nora_admin:<pass>@localhost:5433/nora" \
     node scripts/_tmp_send_trial_email.cjs
   ```

The send script hard-codes `daysLeft` and `trialEndFormatted` from the draft run — update these if running on a different day.

### User Detail (`/users/:id`)

- Shows the user's name, email, and ID
- Two side-by-side tables:
  - **Lessons completed** — module, lesson title, completed date
  - **Sessions** — session ID, mode, status, score, date

### Notifications (`/notifications`)

- Left: user table with checkboxes (only users with push tokens are selectable)
- Right: compose panel with title/body inputs, preview box, and send button
- Default message: "Your Weekly Report is Ready!" / "Check out your progress this week"
- Sends `{ type: 'weekly_report' }` in the notification data (no `reportId` — use the visibility toggle endpoint if you want to deep-link to a specific report)
- Uses `sendPushNotificationToUser` from `server/services/pushNotifications.cjs`

### Weekly Reports (`/users/:id`)

Accessible from the User Detail page. Shows all generated weekly reports for a user with their visibility state. Admin can:
- Generate a new report for the user
- Toggle visibility (publishing a report automatically sends the user a push notification)

The three ways to notify a user about a weekly report:
1. **Automated cron** (`server/jobs/weeklyReportJob.cjs`) — runs every Monday 5:30pm SGT; generates + publishes + notifies automatically. Includes `reportId` in push payload.
2. **Via visibility toggle** (`PUT /api/admin/weekly-reports/:id/visibility`) — manual one-off publish; includes `reportId`. Fires only on false→true transition.
3. **Via Notifications page** (`POST /api/admin/notifications/send`) — manual blast with custom message; no `reportId` in payload.

### Coach Chat (`/coach`)

Real-time view of all parent conversations with the AI coach. Admins can monitor chats live, inject replies as either the AI model or a human psychologist, and abort stuck LLM calls.

#### Chat List

- Table of all users who have at least one coach message, ordered by most recent message
- Columns: user name/email, last message preview, last message time, unread indicator
- Click a row to open the conversation

#### Conversation View

Split layout:

- **Left / message thread** — full conversation history rendered in the same bubble style as the mobile app:
  - User messages: right-aligned grey
  - Model (AI) messages: left-aligned with a sparkle icon
  - Psychologist messages: left-aligned blue with a "Psychologist" label
- **Right / compose panel** — send a reply as either role:
  - Toggle between **Model** and **Psychologist** reply modes
  - Text area + Send button
  - **Stop Generation** button — aborts the in-flight Gemini/Claude request for this user via `agentBus`

New messages from the mobile app appear in real time via the same long-poll bus used by the mobile client. There is no need to refresh.

#### API Endpoints

All require admin auth.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/coach/chats` | List all users with chat history (last message + timestamp) |
| `GET` | `/api/admin/coach/chats/:userId` | Full message history for a user |
| `GET` | `/api/admin/coach/events/:userId?since=` | Long-poll for new messages in a user's chat (same `chatBus` as mobile) |
| `POST` | `/api/admin/coach/chats/:userId/reply` | Inject a message. Body: `{ text, mode: 'model' \| 'psychologist' }`. Published via `chatBus` — appears in mobile within one poll cycle |
| `POST` | `/api/admin/coach/chats/:userId/stop` | Abort in-flight Gemini/Claude call via `agentBus.abort(userId)` |
| `GET` | `/api/admin/coach/users?q=` | Paginated user search with chat count |
| `GET` | `/api/admin/coach/psychologist-requests` | Open "Talk to a Psychologist" support tickets |
| `POST` | `/api/admin/coach/psychologist-requests/:id/dismiss` | Mark a psychologist request resolved |

#### Psychologist Requests

When a parent taps "Talk to a Psychologist" in the mobile app and agrees to the terms, a support ticket is created. Admins see open tickets in a dedicated list. Clicking a ticket navigates to that user's conversation. Once handled, dismiss the ticket via the button in the list.

#### How Real-time Delivery Works

The admin portal uses the same `chatBus.cjs` long-poll bus as the mobile app:

- Admin page opens `GET /api/admin/coach/events/:userId?since=<ISO>` — server holds the connection for up to 25 seconds
- When the mobile app sends a message (`POST /api/coach/chat`), the server publishes to the bus and the admin's open connection wakes immediately
- Similarly, when an admin sends a reply, the server publishes to the bus and the **mobile app's** open connection wakes — the message appears on the parent's phone within ~1 second
- The connection is re-established automatically on each resolution (empty timeout or real messages), creating a continuous loop

Because the bus is in-process memory, this only works when both the admin browser tab and the mobile app are connected to the **same server instance**. Multi-instance deployments would require a shared broker (e.g. Redis pub/sub).

### Push to Prod (sidebar button)

A "Push to Prod" button lives at the bottom of the sidebar, above Logout.

**Flow:**
1. Click the button → confirmation dialog: "Push all lessons and keywords from dev to prod?"
2. Admin portal calls `POST /api/admin/sync-to-prod` on the dev API
3. Dev API reads all Modules, Lessons (with segments + quizzes), and Keywords from dev DB
4. Dev API forwards the full dataset to `POST /api/admin/receive-sync` on the prod API (server-to-server, authenticated with `SYNC_SECRET`)
5. Prod API upserts everything into the prod DB
6. Sidebar shows a success message: "Synced: 74 lessons, 84 keywords" or an error message if it fails

**What is synced:** Modules, Lessons, LessonSegments, Quizzes, QuizOptions, Keywords.

**What is NOT affected:** Users, sessions, user progress, TextInputResponses, WeeklyReports, or any other user-generated data on prod.

## Content Types

Segments support these `contentType` values (matching the Prisma `ContentType` enum):

| Type | Preview Style | Use |
|------|--------------|-----|
| `TEXT` | Default white | General content |
| `TIP` | Yellow background | Tips and best practices |
| `SCRIPT` | Blue background | Example scripts to say |
| `EXAMPLE` | Purple left border | Real-world examples |
| `CALLOUT` | Purple background | Important callouts |
| `TEXT_INPUT` | Green bg + input placeholder | Interactive text response with AI evaluation |

## Create/Update Flow

### Creating a lesson (`POST /api/admin/lessons`)

Request body:
```json
{
  "lesson": {
    "module": "FOUNDATION",
    "dayNumber": 5,
    "title": "Using Labeled Praise",
    "subtitle": "Day 5",
    "shortDescription": "Learn to praise specific behaviors",
    "objectives": ["Identify labeled praise", "Practice 3 examples"],
    "estimatedMinutes": 3,
    "teachesCategories": ["LABELED_PRAISE"],
    "backgroundColor": "#E4E4FF",
    "ellipse77Color": "#9BD4DF",
    "ellipse78Color": "#A6E0CB"
  },
  "segments": [
    {
      "sectionTitle": "What is Labeled Praise?",
      "contentType": "TEXT",
      "bodyText": "Labeled praise tells your child **exactly** what they did well.\n\n* \"Great job sharing your toys!\"\n* \"I love how you used gentle hands!\""
    },
    {
      "sectionTitle": "Try It!",
      "contentType": "TIP",
      "bodyText": "Next time your child does something positive, describe the specific behavior you noticed."
    }
  ],
  "quiz": {
    "question": "Which is an example of labeled praise?",
    "correctAnswer": "B",
    "explanation": "Labeled praise describes the specific behavior.",
    "options": [
      { "optionText": "Good job!" },
      { "optionText": "Great job putting your shoes on by yourself!" },
      { "optionText": "You're awesome!" },
      { "optionText": "Nice work!" }
    ]
  }
}
```

### Updating a lesson (`PUT /api/admin/lessons/:id`)

Same body structure. Segments and quiz are fully replaced (delete + recreate via `createMany`). Lesson metadata fields are patched (only provided fields are updated). Transaction timeout is 15 seconds.

### Creating a module (`POST /api/admin/modules`)

```json
{
  "key": "EMOTIONS",
  "title": "Managing Emotions",
  "shortName": "Emotions",
  "description": "Help your child understand and manage big feelings",
  "displayOrder": 2,
  "backgroundColor": "#E4E4FF"
}
```

`key` must be a valid `LessonModule` enum value. `displayOrder` auto-increments if omitted.

### Updating a module (`PUT /api/admin/modules/:key`)

```json
{
  "title": "Managing Big Emotions",
  "shortName": "Emotions",
  "description": "Updated description",
  "displayOrder": 3,
  "backgroundColor": "#FFE4E4"
}
```

Only provided fields are updated. `key` cannot be changed.
