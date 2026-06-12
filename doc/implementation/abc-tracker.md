# Implementation: Nora ABC Tracker

**Feature:** Antecedent–Behavior–Consequence (ABC) retroactive behavior tracker  
**Scope:** Challenging log, positive log, AI insight generation, follow-up loop.  
**Clinical context:** Closes the PCIT loop — parents log real-world behavioral incidents to surface patterns for the coach and weekly reports.

---

## 0. Scope

| Path | Status | Entry point |
|---|---|---|
| Path 1 — Live Timer | Deferred | — |
| **Path 2 — Challenging Log** | **Implemented** | Log tab · HomeScreen plan item |
| **Path 3 — Positive Log** | **Implemented** | Log tab "Log a win" button |

---

## 1. Files Created / Modified

### New / rewritten screens

| File | Purpose |
|---|---|
| `nora-mobile/src/screens/ABCLogScreen.tsx` | Multi-step log form (challenging + positive modes) |
| `nora-mobile/src/screens/LogScreen.tsx` | Log tab — behavior insights dashboard |

### Data & config

| File | Purpose |
|---|---|
| `nora-mobile/src/data/abcTags.ts` | All tag arrays + behavior function options |
| `server/routes/abc-logs.cjs` | REST endpoints (POST, GET logs, GET/POST insights) |

### Database migrations (in order)

| Migration | Change |
|---|---|
| `20260526000000_add_abc_logs` | Initial `AbcLog` table |
| `20260602000000_abc_logs_restructure` | Added `behaviors`, `intensity`, `durationBucket`; added `situations`, `places`, `persons`; added `AbcInsight` table |
| `20260603000000_add_abc_insights` | `followUpRating`, `followUpNote`, `followUpAt` on `AbcInsight` |
| `20260608000000_abc_logs_restore_legacy_fields` | Restore compatibility fields |
| `20260610000002_add_abc_behavior_function` | `behaviorFunction TEXT` on `AbcLog` |
| `20260610000003_add_abc_insight_followup` | Ensured follow-up columns present on `AbcInsight` |

### Modified files

| File | Change |
|---|---|
| `prisma/schema.prisma` | `AbcLog` + `AbcInsight` models; `AbcLogType` enum |
| `server.cjs` | Mounted `/api/abc-logs` route |
| `nora-mobile/src/navigation/types.ts` | `ABCLog` params extended; `Log` tab added |
| `nora-mobile/src/navigation/RootNavigator.tsx` | Registered `ABCLogScreen` |
| `nora-mobile/src/navigation/TabNavigator.tsx` | Added `Log` tab (journal icon) |
| `nora-mobile/src/screens/index.ts` | Exported `LogScreen` |

> `nora-mobile/src/utils/abcAge.ts` was deleted — age-tiering was removed when tags were unified.

---

## 2. Data Model

### `AbcLog` Prisma model

```prisma
model AbcLog {
  id               String     @id @default(uuid())
  userId           String
  childId          String
  logType          AbcLogType @default(CHALLENGING)
  antecedents      String[]
  behaviors        String[]
  situations       String[]
  places           String[]
  persons          String[]
  consequences     String[]
  intensity        Int?
  durationBucket   String?
  behaviorFunction String?
  recordedAt       DateTime   @default(now())
  createdAt        DateTime   @default(now())
  User             User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  Child            Child      @relation(fields: [childId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([userId, recordedAt])
  @@index([childId, recordedAt])
}

enum AbcLogType { CHALLENGING POSITIVE }
```

### `AbcInsight` Prisma model

```prisma
model AbcInsight {
  id             String    @id @default(uuid())
  userId         String
  insight        Json      // { observation, validation, strategy, why }
  followUpRating Int?      // 1–5 (😟=1, 😐=3, 😊=5)
  followUpNote   String?
  followUpAt     DateTime?
  createdAt      DateTime  @default(now())
  User           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

### Server endpoints

```
POST /api/abc-logs
  body: { logType?, antecedents, behaviors?, situations?, places?, persons?,
          consequences?, intensity?, durationBucket?, behaviorFunction?, recordedAt? }
  → 201 { log }

GET  /api/abc-logs
  query: ?since=ISO_DATE&limit=20&cursor=ID
  → { logs, total }

GET  /api/abc-logs/insights
  → { insight, insightId, cached }  or  { needsMoreLogs, logsNeeded }

GET  /api/abc-logs/insights/latest
  → { insightId, insight, followUpRating, followUpAt, createdAt }

POST /api/abc-logs/insights/:id/followup
  body: { rating: 1–5, note? }
  → { insightId, followUpRating }
```

All routes require auth. Server auto-resolves `childId` — client does not send it.

**Validation:**
- Positive logs: `antecedents` (positive behaviors) required
- Challenging logs: `antecedents` AND `behaviors` required

---

## 3. Navigation

```typescript
// RootStackParamList
ABCLog: {
  mode: 'challenging' | 'positive';
  source: 'quick' | 'log_tab' | 'home';
}
```

Registered with `animation: 'slide_from_bottom'` and `headerShown: false`.

`Log` tab: `RootTabParamList.Log = undefined`, positioned between Record and Learn.

---

## 4. ABCLogScreen — Step Flow

### Challenging mode (6 steps)

| Step | Question | Required | Notes |
|---|---|---|---|
| 0 | What did your child do? | Yes | `BEHAVIOR_TAGS`; no custom tags; safety overlay check |
| 1 | What triggered it? | Yes | `ANTECEDENT_TAGS` + custom tags |
| 2 | What happened right after? | No | `CONSEQUENCE_TAGS` with cross-step inference reordering; **quick save checkpoint** |
| 3 | How was it? | No | Intensity 1–5 emoji + duration bucket; "Optional detail" phase begins |
| 4 | What else was going on? | No | Combined step: situations + places + persons in one scrollable view |
| 5 | When did it happen? | No | Hour chips (replaces DateTimePicker spinner) |

**Quick save at step 2:** Primary button says "Save Log"; a secondary "Add more context →" link advances to step 3 for optional detail.

**Two-phase progress bar:** Visual divider separates segments 0–2 ("Quick capture") from segments 3–5 ("Optional detail"). Segments 3–5 render at opacity 0.2 until step ≥ 3.

### Positive mode (3 steps)

| Step | Question | Required |
|---|---|---|
| 0 | What did your child do well? | Yes |
| 1 | What was happening? | No |
| 2 | When did it happen? | No |

Green accent color (`#10B981`) throughout.

### Intro screen

Shown once per device (key `abc_intro_seen` in `userStorage`). Three feature bullets. Skippable with back arrow.

### Safety overlay

Triggered when a `SAFETY_BEHAVIORS` tag is selected at step 0 and `abc_safety_check_seen` is not set. Shows crisis resources (SG 999 / 1800-221-4444), then proceeds to submit on acknowledgement.

`SAFETY_BEHAVIORS = new Set(['Hurting themselves', 'Hitting, kicking, or biting'])`

### Toast success (replaces blocking modal)

On save, a dark banner animates in from the top:
- Shows a random contextual message
- Auto-dismisses after 2.5 s → `navigation.goBack()`
- "New Entry" button resets the form in place without navigating back

### Frequency-sorted tags

Tag usage frequencies stored in `userStorage` as `abc_tag_freq_{category}` (JSON object `{ [tag]: count }`). Incremented on each successful submission. Tags sorted by frequency descending on render; custom tags always at bottom; new tags retain natural order.

### Cross-step consequence inference (step 2)

`inferConsequenceTags(behaviors, antecedents)` re-orders `CONSEQUENCE_TAGS` based on current session selections:

| Condition | Elevated tag |
|---|---|
| Yelling / Hitting / Crying selected | "My child got more attention…" |
| "told no" antecedent | Want-related consequences |
| "asked to do something" antecedent | Compliance/refusal consequences |
| Running away / Refusing selected | "We stopped the activity…" |

A "Reordered based on what you selected" badge (sparkles icon) appears when ordering differs from default.

### Hour chips (step 5 / positive step 2)

Nine time-of-day chips in a 2-column grid replacing the DateTimePicker spinner:

| Label | Range | Stored hour |
|---|---|---|
| Early morning | 5–7am | 6 |
| Before school | 7–9am | 8 |
| Mid-morning | 9–11am | 10 |
| Around lunch | 11am–1pm | 12 |
| After lunch | 1–3pm | 14 |
| After school | 3–5pm | 16 |
| Early evening | 5–7pm | 18 |
| Bedtime | 7–9pm | 20 |
| Late night | 9pm+ | 21 |

If no chip selected, `recordedAt` is omitted from POST body.

### Custom tags

Up to 3 custom tags per category stored in `userStorage` (`abc_custom_tags_{category}`). Added via modal; long-press to delete.

---

## 5. Tag Data (`nora-mobile/src/data/abcTags.ts`)

All exports:

| Export | Used at |
|---|---|
| `BEHAVIOR_TAGS` | Challenging step 0 |
| `ANTECEDENT_TAGS` | Challenging step 1 |
| `CONSEQUENCE_TAGS` | Challenging step 2 |
| `SITUATION_TAGS` | Challenging step 4 (situations) + positive step 1 |
| `PLACE_TAGS` | Challenging step 4 (places) |
| `PERSON_TAGS` | Challenging step 4 (persons) |
| `POSITIVE_BEHAVIOR_TAGS` | Positive step 0 |
| `BEHAVIOR_FUNCTION_OPTIONS` | 4 options with descriptions (Escape, Attention, Tangibles, Sensory) |

`SAFETY_BEHAVIORS` is a `Set` defined in `ABCLogScreen.tsx` (not exported from abcTags).

---

## 6. LogScreen — Behavior Insights Dashboard

`nora-mobile/src/screens/LogScreen.tsx` — the "Log" bottom tab screen.

### Tabs

| Tab | Label | Content |
|---|---|---|
| Challenging | "Tough moments" | Insights + pattern grid + recent logs |
| Positive | "Bright spots" | Recent wins + activity summary |

### Challenging tab layout (top to bottom)

1. **This week card** — 7-day dot strip + summary line
2. **InsightCard** (inline, auto-fetched) — or `buildingCard` (progress dots) when < 5 challenging logs
3. **Pattern grid** — most frequent antecedents/consequences/behaviors; gated at ≥ 5 logs
4. **Wins nudge** — tappable green card prompting positive log; shown when no positive logs and ≥ 2 challenging logs
5. **Recent logs card** — last 5 entries

### InsightCard (inline, replaces modal + "Ask Nora" button)

- **No "Ask Nora" button** — removed entirely
- **Auto-fetched** in `fetchLogs` after logs load, when `challengingCount >= 5` and `!insightFetchedRef.current`
- `insightFetchedRef` reset to `false` on each `useFocusEffect` so insight re-fetches on every screen focus
- Loading state: spinner + "Reading your logs…"
- Error state: "Could not load. Tap ↻ to retry."
- Refresh button (↻) in card header

InsightCard sections:
| Section label | Insight field |
|---|---|
| What Nora noticed | `observation` |
| Validation | `validation` |
| Try this | `strategy` |
| Why it works | `why` |

### Follow-up rating (inside InsightCard)

Three emoji buttons (😟 / 😐 / 😊) mapping to ratings 1 / 3 / 5. On submit, calls `POST /api/abc-logs/insights/:id/followup`. Done state shows checkmark + feedback text. Rating is included in future LLM prompts for novelty tracking.

### Empty state

Both "Log a moment" and "Log a win" buttons side by side.

---

## 7. AI Insight Generation

### Trigger

`GET /api/abc-logs/insights` — called automatically when ≥ 5 challenging logs exist. Returns cached insight if it was generated after the most recent log's `createdAt`.

### Input

- Up to 20 most recent challenging logs (formatted with day/time, pipe-separated fields)
- Up to 10 most recent positive logs (top-5 frequency summary)
- Child age + conditions from user profile
- Up to 5 past insights with their follow-up ratings (for novelty constraint)

### LLM config

```javascript
llmCall(prompt, {
  model: 'gemini-2.5-flash',
  output: 'json',
  maxTokens: 2000,
  temperature: 0.3,
  label: 'abc-insight',
  _geminiConfig: { thinkingConfig: { thinkingBudget: 1024 } },
})
```

### Output schema

```json
{
  "observation": "...",
  "validation": "...",
  "strategy": "...",
  "why": "..."
}
```

### Prompt constraints

- Novelty: new observation + strategy must differ from all past insights
- Safety: never suggest physical punishment; acknowledge self-harm/aggression and refer to therapist
- Strategy: 3–4 numbered concrete steps covering both cooperation and escalation scenarios
- PCIT skill reference: name relevant skill (Labeled Praise, Narration, Echo, Effective Command, Follow-Through, Strategic Ignoring) at end of `why` if genuinely applicable

---

## 8. HomeScreen Integration

### Today's Plan item

```
[ □ ] Log a Moment:  Track behavior patterns
```

- Completed when `userStorage.getItem('abc_logged_today') === today`
- Taps → `ABCLog { mode: 'challenging', source: 'home' }`
- Positive log completion stored as `abc_positive_logged_today`

---

## 9. Deferred

| Item | Notes |
|---|---|
| Live Timer (Path 1) | Requires `ABCContext` with `AppState`-aware stopwatch |
| Weekly Report integration | Aggregate log count + most common antecedent |
| Coach Chat context injection | Last 5 logs injected into coach prompt |
| Cross-device custom tag sync | Currently device-local only (`userStorage`) |
| Log trend chart | Weekly log count over past 4–6 weeks |
| Behavior function UI | `BEHAVIOR_FUNCTION_OPTIONS` defined but no step to select it yet |
