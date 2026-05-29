# Weekly Report Screen

7-page swipeable recap flow presented as a modal (`slide_from_bottom`). Summarizes the parent's week of PCIT sessions, celebrates progress, and collects a quick check-in.

## Navigation

- **Route:** `WeeklyReport` (in `RootStackParamList`) — accepts `reportId` param
- **Entry point:** Weekly report cards in `ReportsSection` on `HomeScreen` (only shown when `visibility: true` reports exist for the user)
- **Dismiss:** X button or completing all 7 pages

## Architecture

Single `WeeklyReportScreen` component managing `currentPage` state (1-7) internally. No sub-routes — each page is rendered via a switch/case in `renderPageContent()`.

**File:** `nora-mobile/src/screens/WeeklyReportScreen.tsx`

## Data Loading

The screen receives a `reportId` param and loads the pre-generated report from the DB:

| Source | Endpoint | Data |
|--------|----------|------|
| `recordingService.getWeeklyReport(reportId)` | `GET /api/config/weekly-reports/:id` | Full report (deposits, top moments, milestones, AI narrative, audio URLs) |
| `authService.getChildIssues()` | `GET /api/auth/child-issues` | Priority issues for page 7 check-in |
| `authService.getCurrentUser()` | `GET /api/auth/me` | Child name for personalization |

**Report visibility gate:** The `/api/config/weekly-reports/:id` endpoint only returns reports where `visibility: true` and `userId` matches the authenticated user.

**Date range:** Mon 00:00 UTC → Sun 23:59 UTC for the report's week (computed server-side at generation time).

## Pages

### Page 1 — Weekly Recap Headline
- Purple "Weekly Recap" subtitle
- Bold personalized title: "{childName} Showed Easier Transition this week"
- Dragon illustration in green (#A2DFCB) rounded container
- Layout matches `IntroScreenTemplate`

### Page 2 — Emotional Bank Account Deposits
- Title: "Your Weekly Emotional Bank Account Deposits"
- **Total deposits card:** Sum of Praise + Echo + Narrate skill progress across all sessions, with dragon avatar
- **Breakdown grid** (2x2):
  - Massage time (total `durationSeconds` / 60)
  - Confidence Boost (`skills.label === 'Praise'` summed)
  - Being heard (`skills.label === 'Echo'` summed)
  - Being seen (`skills.label === 'Narrate'` summed)

### Page 3 — You as a Parent This Week
- Title: "You as a Parent This Week"
- **Identity statement card:** `parentGrowthNarrative` — AI-generated affirming statement with heart icon
- **Growth metrics row:** Up to 3 stat cards from `growthMetrics` (icon, value, label) — e.g. trending-up, calendar, trophy, star
- **What Nora Noticed card:** `noraObservation` — AI-generated observation about the parent's technique

### Page 4 — Weekly Moments Highlight
- Title: "Weekly Moments Highlight"
- Vertical list of moment bubbles from `topMoments` (filtered to those with a `quote`)
- Each bubble shows:
  - Day + date label + session title
  - Bold italic quote
  - `MomentPlayer` audio widget (if `audioUrl` + `startTime`/`endTime` available)

### Page 5 — Child's Week
- Title: "{childName}'s Week"
- **Shining Moments card:** `childSpotlight` — AI-generated highlight of the child's behaviour
- **Growth Snapshot cards:** `growthSnapshots` array — each has `icon` (chatbubble, bulb, people, heart, hand-left), `childQuote`, `meaning`; category label translated via `weeklyReport.page5.categories.*`
- **Progress Note:** `childProgressNote` — green leaf footer note
- Fallback empty state if no spotlight or snapshots

### Page 6 — Next Week's Focus
- Title: "Next Week's Focus"
- **Focus card:** `focusHeading` + `focusSubtext` — AI-generated focus for the coming week
- Expandable "Why this matters" section: `whyExplanation` (toggle via chevron)

### Page 7 — Quick Check-in
- Title: "Quick Checkin"
- **Mood selection:** 4 emoji chips (Grounded, Tired, Stretched, Hopeful) — single select with purple highlight
- Disclaimer text
- **Issue improvement ratings:** Items are pulled from the top 5 `ChildIssuePriority` rows (ordered by `priorityRank` ASC) for the user's child. Each row's `userIssues` (JSON array) and `wacbQuestions` (JSON array) are parsed, flattened, and deduplicated into a single list. Each item is shown as a row with Better / Same / Worse chips.
  - `userIssues` keys (e.g. `adhd`, `attention_focus`) are translated via `issueTags.*` in the locale files
  - `wacbQuestions` keys (e.g. `q1Dawdle`, `q3Disobey`) are prefixed `wacb:` internally and translated via `weeklyReport.page7.wacbQuestions.*`
  - All possible wacb question keys: `q1Dawdle`, `q2MealBehavior`, `q3Disobey`, `q4Angry`, `q5Scream`, `q6Destroy`, `q7ProvokeFights`, `q8Interrupt`, `q9Attention`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config/weekly-reports` | List all `visibility: true` reports for the authenticated user |
| `GET` | `/api/config/weekly-reports/:id` | Full report detail (gated to owner + visible) — resolves presigned audio URLs at read time |
| `PATCH` | `/api/config/weekly-reports/:id/checkin` | Save page 7 check-in responses (`moodSelection`, `issueRatings`) |
| `GET` | `/api/auth/me` | User profile (childName) |
| `GET` | `/api/auth/child-issues` | Top 5 `ChildIssuePriority` records for the user's child, ordered by `priorityRank` ASC — returns `strategy`, `priorityRank`, `userIssues`, `wacbQuestions`, `clinicalLevel` |

## Key Types

```typescript
interface WeeklyDeposits {
  totalDeposits: number;
  massageTimeMinutes: number;
  praise: number;
  echo: number;
  narrate: number;
}

interface TopMomentData {
  dayLabel: string;
  dateLabel: string;
  tag: string;
  sessionTitle: string;
  quote: string;
  celebration: string;
  audioUrl?: string | null;
  startTime?: number | null;
  endTime?: number | null;
}
```

## Reused Components

| Component | Usage |
|-----------|-------|
| `ProgressBar` | 7-segment header progress |
| `MomentPlayer` | Audio playback for top moments |
| `DRAGON_PURPLE` | Illustration and avatar images |
| `Ionicons` | Icons throughout |

## Delivery Flow

### Automated (primary)

A cron job in `server/jobs/weeklyReportJob.cjs` runs every **Monday at 5:30pm SGT (09:30 UTC)**:

1. Finds all users with at least one completed session in the week that just ended (previous Mon–Sun UTC)
2. Calls `generateWeeklyReport(userId, weekStart)` for each — aggregates data, generates AI narrative, upserts `WeeklyReport` with `visibility: false`
3. Sets `visibility: true` on the saved report
4. Sends a push notification via Expo Push API: `"Your Weekly Report is Ready!"` with `{ type: 'weekly_report', reportId }` in the data payload (only on first publish — skipped if the report was already visible)

### Manual override (admin portal)

Admins can generate and publish outside the schedule:

- `POST /api/admin/weekly-reports/generate` — single user
- `POST /api/admin/weekly-reports/generate-all` — all users with sessions in the week
- `PUT /api/admin/weekly-reports/:id/visibility` — toggle visibility; automatically sends push notification on false→true transition

### In-app

`ReportsSection` on HomeScreen calls `GET /api/config/weekly-reports` and renders a card for each `visibility: true` report. Tapping navigates to `WeeklyReport` screen with the `reportId`.

**HomeScreen_v2 today's plan item**

The weekly report appears as a plan item under "Today's Plan" with date-scoped visibility (mirrors the setup-reminder pattern):

| State | Behaviour |
|-------|-----------|
| Not yet read | Shown as incomplete |
| Read today | Shown as completed (sinks to bottom of plan) |
| Read on a prior day | Hidden from plan |

Reading is triggered by tapping the plan item **or** tapping "View Weekly Report" on the main action card. Both paths write `weekly_report_read_date_<reportId>` = today (Singapore date) and `weekly_report_dismissed_<reportId>` = `'true'` to `userStorage`.

"Skip for now" on the main action card only sets the dismissed flag — the plan item remains incomplete and accessible.

### Notification deep-link

The push notification payload includes `{ type: 'weekly_report', reportId }`. `AppContent` in `App.tsx` handles two cases:

- **Background tap** — `addNotificationResponseReceivedListener` fires immediately and navigates to `WeeklyReport` with the `reportId`
- **Cold-start tap** (app was killed) — `getLastNotificationResponseAsync` runs on mount and navigates once the navigation tree is ready

## Regenerating a report manually

To regenerate a specific report in prod (overwrites via upsert, restores visibility):

```bash
# 1. Ensure prod DB tunnel is open (localhost:5433)
./scripts/start-prod-db-tunnel.sh

# 2. Set REPORT_ID in the script, then run with prod DATABASE_URL
DATABASE_URL="$(aws secretsmanager get-secret-value \
  --secret-id arn:aws:secretsmanager:ap-southeast-1:059364397483:secret:nora/database-url-893xxi \
  --region ap-southeast-1 --query SecretString --output text | \
  sed 's|nora-prod.cjy4ccwg2d5q.ap-southeast-1.rds.amazonaws.com:5432|localhost:5433|')" \
  node scripts/_tmp_regenerate_weekly_report.cjs
```
