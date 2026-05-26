# Implementation: Nora ABC Tracker — Quick Log (Path 2)

**Feature:** Antecedent–Behavior–Consequence (ABC) retroactive behavior tracker  
**Scope:** Path 2 only — Quick Log flow. Live timer (Path 1) and positive log (Path 3) are deferred.  
**Clinical context:** Closes the PCIT loop — parents log real-world behavioral incidents to surface patterns for the coach and weekly reports.

---

## 0. Scope

| Path | Status | Entry point |
|---|---|---|
| Path 1 — Live Timer | Deferred | — |
| **Path 2 — Quick Log** | **Implemented** | WeeklyStats "logs" pill · Today's Plan "Log a Outburst" item |
| Path 3 — Positive Log | Deferred | — |

---

## 1. Files Created / Modified

### New files

| File | Purpose |
|---|---|
| `nora-mobile/src/data/abcTags.ts` | Age-gated default tag arrays and duration buckets |
| `nora-mobile/src/utils/abcAge.ts` | `childBirthday`/`childBirthYear` → `toddler`/`school` tier |
| `nora-mobile/src/screens/ABCLogScreen.tsx` | 5-step fast-tap log form |
| `server/routes/abc-logs.cjs` | REST endpoints (POST, GET) |
| `prisma/migrations/20260526000000_add_abc_logs/migration.sql` | DB migration |

### Modified files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `AbcLog` model, `AbcLogType` enum, relations on `User` and `Child` |
| `server.cjs` | Mounted `/api/abc-logs` route |
| `nora-mobile/src/navigation/types.ts` | Added `ABCLog` to `RootStackParamList` |
| `nora-mobile/src/navigation/RootNavigator.tsx` | Registered `ABCLogScreen` |
| `nora-mobile/src/screens/HomeScreen_v2.tsx` | Replaced mins pill → logs pill; added "Log a Outburst" plan item |
| `nora-mobile/src/i18n/locales/en.json` | Added `statLogs`, `planLogBehaviorLabel`, `planLogBehaviorTitle` |
| `nora-mobile/src/i18n/locales/zh-TW.json` | Same keys in Traditional Chinese |

---

## 2. Data Model

### `AbcLog` Prisma model

```prisma
model AbcLog {
  id             String     @id @default(uuid())
  userId         String
  childId        String
  logType        AbcLogType @default(CHALLENGING)
  antecedents    String[]
  behaviors      String[]
  consequences   String[]
  durationBucket String?
  recordedAt     DateTime   @default(now())
  createdAt      DateTime   @default(now())
  User           User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  Child          Child      @relation(fields: [childId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([userId, recordedAt])
  @@index([childId, recordedAt])
}

enum AbcLogType { CHALLENGING POSITIVE }
```

Note: `intensity` field was removed from the schema and is not collected.

### Server endpoints

```
POST /api/abc-logs   body: { logType?, antecedents, behaviors, consequences, durationBucket?, recordedAt? }
GET  /api/abc-logs   query: ?since=ISO_DATE&limit=20&cursor=ID
```

Both require auth. The server auto-resolves `childId` via `prisma.child.findFirst({ where: { userId } })` — the client does not send a `childId`.

`recordedAt` is optional; omitted when the user selects "Not sure" on the time step.

---

## 3. Navigation

`ABCLog` screen params:
```typescript
ABCLog: { mode: 'challenging'; source: 'quick' }
```
Registered with `animation: 'slide_from_bottom'` and `headerShown: false`.

---

## 4. ABCLogScreen — Step Flow

```
Step 0: Time → Step 1: Antecedent → Step 2: Behavior → Step 3: Consequence → Step 4: Duration
```

### Step 0 — Time

- Native `DateTimePicker` in `display="spinner"` mode with `minuteInterval={60}` (hour-only)
- Defaults to current hour with minutes zeroed
- "Not sure" pill below the spinner — when active, dims the picker (`opacity: 0.3`) and omits `recordedAt` from the POST body
- Scrolling the wheel automatically deactivates "Not sure"

### Steps 1–3 — Tag selection (Antecedent / Behavior / Consequence)

- Full-width pill cards (`height: 68`, `borderRadius: 36`), matching `MultipleChoiceScreen`
- Multi-select; purple selected state with checkmark
- `[+ Add custom option]` dashed pill (max 3 per category, stored in `userStorage` as `abc_custom_tags_{category}`)
- Long-press a custom tag to delete it
- Steps 1 (antecedents) and 2 (behaviors) require at least one selection to advance
- Step 3 (consequences) is skippable

### Step 4 — Duration

- Same full-width pill card format as Steps 1–3 (single-select)
- Options: `Less than 2 minutes` · `2–5 minutes` · `5–15 minutes` · `15–30 minutes` · `More than 30 minutes`
- Default pre-selection: `2–5 minutes`
- Skippable

### Advance / skip logic

| Step | Required? | Continue enabled when |
|---|---|---|
| 0 — Time | No | Always |
| 1 — Antecedent | Yes | ≥ 1 tag selected |
| 2 — Behavior | Yes | ≥ 1 tag selected |
| 3 — Consequence | No | Always |
| 4 — Duration | No | Always |

"Skip this step" is always rendered (invisible on steps 0–2, active on steps 3–4) to keep footer height consistent across all steps.

### Footer layout

All steps share an identical footer:
1. Back arrow (←) + Continue/Save Log pill button
2. "Skip this step" link (hidden on steps 0–2)

### Submit

POSTs to `/api/abc-logs`, writes `abc_logged_today = today` to `userStorage`, then shows a success modal with:

- A random message from `SUCCESS_MESSAGES` (chosen at submit time):
  - *"Logging helps us understand the pattern; thanks for staying consistent."*
  - *"Understanding the 'why' is the first step toward change."*
  - *"Your consistency is key to identifying behavior patterns."*
  - *"Every log helps us see the bigger picture."*
- **Log Another** — resets the form to step 0 (clears all selections, resets time to current hour)
- **Close** — navigates back to the home screen

### Age tier

Resolved from `authService.getCurrentUser()` on mount via `getAgeTier(childBirthday, childBirthYear)`. Toddler defaults are shown immediately while the async call is in flight.

---

## 5. Tag Data (`nora-mobile/src/data/abcTags.ts`)

### Age tiers

| Tier | Criteria |
|---|---|
| `toddler` | 24–47 months (default / fallback) |
| `school` | 48–96 months |

### Default tags (toddler)

**Antecedents:** Told 'No' · Activity Transition · Sharing Conflict · Tired/Hungry · Routine Interruption  
**Behaviors:** Screaming/Tantrum · Biting/Scratching · Flopping to Floor · Throwing Objects · Elopement  
**Consequences:** Verbal Redirection · Sensory Comfort · Planned Ignoring · Time-out Chair · Labeled Praise

### Default tags (school-age)

**Antecedents:** Task Demand · Screen Time Ended · Losing a Game · Sibling/Peer Conflict · School Transition  
**Behaviors:** Verbal Defiance · Slamming Doors · Physical Aggression · Emotional Meltdown · Refusing to Comply  
**Consequences:** Loss of Screen Privilege · Quiet Space · Instruction Repeated · Token/Reward · Time-out Chair

### Duration buckets

`Less than 2 minutes` · `2–5 minutes` · `5–15 minutes` · `15–30 minutes` · `More than 30 minutes`

---

## 6. HomeScreen_v2 Changes

### Weekly stats pill

Replaced the `minutesPlayed` / flash pill:

```
Before: ⚡ {minutesPlayed}/35 mins
After:  📓 {logsThisWeek}/7  logs   (taps → ABCLog)
```

`logsThisWeek` is fetched in parallel in `loadData` via `GET /api/abc-logs?since={startOfWeek}`.

### Today's Plan item

```
[ □ ] Log a Outburst:  Track behavior patterns
```

- Added after the Record session item
- `isCompleted: true` if `userStorage.getItem('abc_logged_today') === today`
- Tapping navigates to `ABCLog` with `{ mode: 'challenging', source: 'quick' }`

### i18n keys

| Key | EN | ZH-TW |
|---|---|---|
| `statLogs` | `logs` | `記錄` |
| `planLogBehaviorLabel` | `Log a Outburst:` | `記錄一次爆發：` |
| `planLogBehaviorTitle` | `Track behavior patterns` | `追蹤行為模式` |

---

## 7. Deferred (Phase 2)

| Item | Notes |
|---|---|
| Live Timer (Path 1) | Requires `ABCContext` with `AppState`-aware stopwatch |
| Positive Log (Path 3) | Warm theme variant, `POSITIVE_TAGS` arrays |
| Weekly Report integration | Aggregate log count + most common antecedent |
| Coach Chat context injection | Last 5 logs injected into coach prompt |
| Cross-device custom tag sync | Currently device-local only (`userStorage`) |
