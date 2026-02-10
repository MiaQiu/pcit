# Weekly Report Screen

7-page swipeable recap flow presented as a modal (`slide_from_bottom`). Summarizes the parent's week of PCIT sessions, celebrates progress, and collects a quick check-in.

## Navigation

- **Route:** `WeeklyReport` (in `RootStackParamList`)
- **Entry point:** Temporary button on `HomeScreen` (to be replaced with scheduled trigger)
- **Dismiss:** X button or completing all 7 pages

## Architecture

Single `WeeklyReportScreen` component managing `currentPage` state (1-7) internally. No sub-routes — each page is rendered via a switch/case in `renderPageContent()`.

**File:** `nora-mobile/src/screens/WeeklyReportScreen.tsx`

## Data Loading

All data is fetched once on mount in parallel:

| Function | Source | Data |
|----------|--------|------|
| `loadWeeklyData()` | `recordingService.getRecordings({ from })` + `getAnalysis()` per session | Deposits, top moments, milestones |
| `loadChildIssues()` | `authService.getChildIssues()` | Priority issues for check-in |
| `loadChildName()` | `authService.getCurrentUser()` | Child name for personalization |

**Date range:** Currently last 4 weeks (`Date.now() - 28 days`). To be changed to current Mon-Sun week for production.

**Recording filter:** `overallScore != null` (the `getRecordings` endpoint returns `overallScore`, not `analysisStatus`).

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

### Page 3 — Skill Celebration (Hardcoded)
- Title: "You're an excellent Narrator"
- Lavender container with two scenario cards
- Each card: context label, bold description, audio icon, "Example script" box
- Content is currently hardcoded; to be generated from session analysis

### Page 4 — Weekly Moments Highlight
- Title: "Weekly Moments Highlight"
- Horizontal snap-to-card carousel of session top moments
- Each card shows:
  - Day badge + date
  - Skill tag (top skill from that session)
  - Session title
  - Top moment quote (extracted via `topMomentUtteranceNumber` or `topMoment.quote`, with PCIT tags stripped)
  - Celebration/feedback text
  - `MomentPlayer` audio widget (if `audioUrl` + `topMomentStartTime/EndTime` available)
  - "Saved / Emotional memory" footer

### Page 5 — Child Development Milestones
- Title: "What We learnt about {childName}"
- Lavender container with milestone cards from `analysis.milestoneCelebrations`
- Each card: blue icon (sparkles for ACHIEVED, trending-up for EMERGING), title, action tip
- Deduplicated across sessions by title
- Fallback card shown if no milestones

### Page 6 — Next Week's Focus (Hardcoded)
- Title: "Next Week's Focus"
- Lavender container with focus heading, orange sparkle icon
- Expandable "Why this matters" card (toggle via chevron)
- Content is currently hardcoded; to be generated from analysis trends

### Page 7 — Quick Check-in
- Title: "Quick Checkin"
- **Mood selection:** 4 emoji chips (Grounded, Tired, Stretched, Hopeful) — single select with purple highlight
- Disclaimer text
- **Issue improvement ratings:** Each issue from `ChildIssuePriority` table (top 5 by `priorityRank`) shown as a row with Better / Same / Worse chips
- Check-in responses are stored in local state only (submission endpoint TBD)

## API Endpoints

### Existing (reused)
- `GET /api/recordings?from=` — Fetch recordings in date range
- `GET /api/recordings/:id/analysis` — Full session analysis (skills, topMoment, milestones, audio)
- `GET /api/auth/me` — User profile (childName)

### New
- `GET /api/auth/child-issues` — Returns top 5 `ChildIssuePriority` records for the user's child, ordered by `priorityRank` ASC. Response: `{ issues: [{ strategy, priorityRank, userIssues, clinicalLevel }] }`

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

## TODO

- [ ] Replace hardcoded content on pages 1, 3, 6 with AI-generated text from session analysis
- [ ] Change date range from 4 weeks back to current Mon-Sun week
- [ ] Submit page 7 check-in responses to backend
- [ ] Schedule weekly report trigger (push notification or in-app prompt)
- [ ] Remove temporary HomeScreen button; replace with proper entry point
