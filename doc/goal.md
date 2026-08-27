# Today's Goal / Tomorrow's Goal / Level Clearance

How the "Today's Goal" card on `ReportScreen_v2` (and the "Tomorrow's Goal"
card on `ReportDetailScreen`) gets its focus skill, current count, and
target count ("aim for"), and how the 9-level "Personalized Learning
Journey" ladder itself advances.

## TL;DR

The numbers are **not computed independently in multiple places** — levels
1-6 (the flat, single-session, single-metric CDI levels) are defined exactly
once, in `server/utils/parentLevelLadder.cjs`, and consumed by both:
- `server/utils/levelGoalEngine.cjs` — produces the `goalDirective` object
  on the report payload (today's goal card).
- `server/services/parentSkillLevelService.cjs` — decides when a parent
  advances to the next level (the clearance gate).

Because both read the same table, a level's goal-card target and its
clearance threshold are **always the same number** for levels 1-6. Before
this unification, these were two independently-hardcoded engines that had
already drifted (see "History" below).

Client-side, the ladder's display metadata (level keys, icons,
skill-tap-through) and the pre-`goalDirective` fallback goal computation are
likewise each defined once, in `nora-mobile/src/constants/parentSkillLevels.ts`
and `nora-mobile/src/utils/goalFallback.ts` respectively, and shared across
every screen that needs them.

## The 9-level ladder

| Level | Mode | goalType | metric | target | direction | i18n key |
|---|---|---|---|---|---|---|
| 1 | CDI | `AVOID_CRITICISM` | criticism count | 3 | reduce | `calmBuilder` |
| 2 | CDI | `AVOID_COMMANDS` | command count | 3 | reduce | `patienceBuilder` |
| 3 | CDI | `AVOID_QUESTIONS` | question count | 3 | reduce | `presenceBuilder` |
| 4 | CDI | `BUILD_PRAISE` | praise count | 5 | build | `confidenceBuilder` |
| 5 | CDI | `BUILD_NARRATION` | narration count | 5 | build | `attentionBuilder` |
| 6 | CDI | `BUILD_ECHO` | echo count | 5 | build | `communicationBuilder` |
| 7 | PDI | `BUILD_COMMANDS` | direct commands | ratio, or flat 5 | build | `cooperationBuilder` |
| 8 | PDI | `CALM_FOLLOWTHROUGH` | qualifying sessions | 2 | build | `boundaryBuilder` |
| 9 | either | `INTEGRATE_SKILLS` | qualifying sessions | 2 | build | `confidentParent` |

Levels 1-6 clear on a **single session** meeting the threshold. Levels 7-9
need **2 non-consecutive qualifying sessions** — no compliance/timeout/
warning DPICS coding exists, so they use tag-based proxies instead (see
"Level clearance" below).

## Data flow — goal card

```
ParentSkillProgress.currentLevel (1-9)
        │
        ▼
generateGoalForLevel(level, tagCounts, mode, progress)   [levelGoalEngine.cjs]
        │  (levels 1-6 read CDI_FLAT_LEVELS from parentLevelLadder.cjs;
        │   levels 7-9 have their own dedicated generators)
        ▼
GoalPayload { goalType, title, baselineCount, targetCount, actionPrompt, coachingTip }
        │
        ▼
goalDirective = { focusSkill, goalType, currentNumber: baselineCount,
                  targetNumber: targetCount, actionPrompt, coachingTip }
        │
        ▼
API response: tomorrowGoalDirective (CDI) / pdiTomorrowGoalDirective (PDI)
        │
        ▼
ReportScreen_v2.tsx / ReportDetailScreen.tsx render currentNumber → targetNumber
```

### Server side

- **Shared ladder module**: `server/utils/parentLevelLadder.cjs`
  - `CDI_FLAT_LEVELS` — levels 1-6, each `{ goalType, title, metricKey,
    target, direction, actionPrompt, coachingTip }`. Single source of truth
    consumed by both `levelGoalEngine.cjs` and `parentSkillLevelService.cjs`.
  - `tagCountsToMetrics(tagCounts)` — flattens the DB's raw `tagCounts` row
    into `{ commands, questions, criticisms, praise, narration, reflection }`,
    preferring pre-aggregated fields and falling back to summing sub-type
    fields. Used by **both** consumers, so they can no longer disagree on
    how a "command count" is computed (see History).
  - `tagCountsToPdiCommandMetrics(tagCounts)` — splits direct vs. indirect
    commands, for level 7.
  - `isFlatLevelCleared(levelDef, metrics)` — the one predicate both engines
    use to decide "cleared" for levels 1-6.
  - `QUALIFYING_SESSIONS_REQUIRED = 2` — shared constant for levels 7-9.

- **Goal engine**: `server/utils/levelGoalEngine.cjs`
  - `generateGoalForLevel(level, tagCounts, mode, progress)` — levels 1-6:
    delegates to `generateFlatCdiLevelGoal(CDI_FLAT_LEVELS[level], metrics)`.
    Level 7: `generateLevel7Goal` (PDI direct/indirect command ratio). Level
    8: `generateLevel8Goal` (qualifying-session count). Level 9+:
    `generateLevel9Goal`. Mode mismatch (e.g. a level 8 parent doing a CDI
    session): `generateMaintenanceGoal`.
  - Each generator returns a `GoalPayload`: `baselineCount` (this session's
    actual count) and `targetCount` (the "aim for" number — for levels 1-6
    this **is** `CDI_FLAT_LEVELS[level].target`, i.e. the same number as the
    clearance threshold).

- **Where it's called / attached to the payload**:
  - `server/services/pcitAnalysisService.cjs:648-654` — CDI, at analysis
    time; builds `goalDirective` and stores it on the coaching result.
  - `server/services/pcitAnalysisService.cjs:1874-1879` — PDI, builds
    `competencyAnalysis.pdiTomorrowGoalDirective`.
  - `server/services/enrichmentRepairService.cjs:160,197-202` — same,
    for the repair/backfill path.
  - `server/routes/recordings.cjs:697-702` — builds a `fallbackGoalDirective`
    the same way (from `session.tagCounts` + `parentProgress.currentLevel`)
    for sessions where the stored analysis doesn't have one yet.
  - `server/routes/recordings.cjs:768` — `pdiTomorrowGoalDirective =
    session.competencyAnalysis?.pdiTomorrowGoalDirective ||
    (!isCDI ? fallbackGoalDirective : null)`
  - `server/routes/recordings.cjs:777` — `tomorrowGoalDirective =
    coachingData?.goalDirective || fallbackGoalDirective || null`

### Client side

- **Shared fallback**: `nora-mobile/src/utils/goalFallback.ts` —
  `deriveGoalFromLevel(level, stats, mode, t)`, used by both
  `ReportScreen_v2.tsx` and `ReportDetailScreen.tsx` (previously two
  independently-drifting copies). Mirrors `CDI_FLAT_LEVELS` from the server
  — a small hardcoded `CDI_FLAT_LEVEL_TARGETS` table with the same
  metric/target/direction/goalType per level 1-6, kept in sync by hand.
  Returns `{ focusSkill, currentNumber, targetNumber, description,
  direction, goalType }`.
- **Shared ladder metadata**: `nora-mobile/src/constants/parentSkillLevels.ts`
  — `PARENT_SKILL_LEVEL_ORDER`, `PARENT_SKILL_LEVEL_KEYS` (i18n key per
  level), `PARENT_SKILL_LEVEL_ICONS`, `PARENT_SKILL_LEVEL_SKILL_LABEL`
  (levels that tap through to a `reportData.skills[]` entry). Consumed by
  `ReportScreen_v2.tsx`, `LevelUpModal.tsx`, `ProfileReportScreen.tsx`, and
  `ParentLevelDetailScreen.tsx` — previously 3 independently-hardcoded
  7-entry arrays.
- `ReportScreen_v2.tsx`:
  ```ts
  const goalDirective = reportData.mode === 'PDI'
    ? reportData.pdiTomorrowGoalDirective ?? null
    : reportData.tomorrowGoalDirective ?? null;

  const goal: DerivedGoal = goalDirective
    ? {
        focusSkill: /* GOAL_TYPE_SKILL_LABEL_KEY lookup, or level's own skill name */,
        currentNumber: goalDirective.currentNumber,
        targetNumber: goalDirective.targetNumber ?? null,
        description: goalDirective.actionPrompt || '',
        direction: REDUCE_GOAL_TYPES.has(goalDirective.goalType || '') ? 'reduce' : 'build',
        goalType: goalDirective.goalType || null,
      }
    : deriveGoalFromLevel(parentLevel, reportData.stats, reportData.mode, t);
  ```
- `direction` (`build` vs `reduce`) controls whether "achieved" means
  `currentNumber >= targetNumber` or `currentNumber <= targetNumber`.
  Reduce-type goals are the ones in `REDUCE_GOAL_TYPES`: `AVOID_CRITICISM`,
  `AVOID_COMMANDS`, `AVOID_QUESTIONS`.
- `ReportDetailScreen.tsx` reads the same `tomorrowGoalDirective` /
  `pdiTomorrowGoalDirective` fields for its "Tomorrow's Goal" card, and maps
  `goalType` to its own display-string badge via `GOAL_TYPE_SKILL_TAG`
  (used for the lesson/demo-video "learn more" link, separate from
  `ReportScreen_v2`'s i18n-key map — the two serve different purposes but
  both key off the same `goalType`).

## Level clearance ("leveling up")

This is a **separate mechanism** from the goal card above — it decides when
a parent advances to the next `ParentSkillLevel`.

- **Engine**: `server/services/parentSkillLevelService.cjs`,
  `computeLevelUpdate(progress, session)`.
- **Trigger**: runs after every session finishes analysis —
  `processingService.cjs:236` calls
  `updateParentSkillLevel(userId, sessionId)` fire-and-forget.
- **Model**: `ParentSkillProgress` (`prisma/schema.prisma:517`) —
  `currentLevel` (default 1) plus `level5QualifyingCount` /
  `level6QualifyingCount` / `level7QualifyingCount` for levels that need
  more than one session.

For levels 1-6: `computeLevelUpdate` looks up `CDI_FLAT_LEVELS[currentLevel]`
from the same shared `parentLevelLadder.cjs` module the goal engine uses,
and clears the level via `isFlatLevelCleared(flatDef, metrics)` — so, by
construction, a level's clearance threshold and its goal-card target are
identical (see the ladder table above).

For levels 7-9, the DB has no direct compliance/timeout/warning signal, so
each uses a tag-based proxy, gated by 2 non-consecutive qualifying sessions
(`QUALIFYING_SESSIONS_REQUIRED = 2`, from `parentLevelLadder.cjs`):

| Level | Clears when |
|---|---|
| 7 Cooperation Builder | `direct_command >= 1`, for 2 qualifying PDI sessions → 8 |
| 8 Boundary Builder | `direct_command >= 1 && criticism === 0`, for 2 qualifying PDI sessions → 9 |
| 9 Confident Parent | "everything clicking" session (CDI: `criticism === 0 && praise >= 5 && narration >= 5 && echo >= 5`; or PDI: `criticism === 0 && direct_command >= 1`), for 2 qualifying sessions — caps there, no level 10 |

Other details:

- **Progress only ever moves forward** — `updateParentSkillLevel()` guards
  so a bad session never regresses `currentLevel`, even if
  `computeLevelUpdate`'s logic changes later. Once level 9 maxes its
  qualifying count, nothing is evaluated again.
- A session in the "wrong" mode for the current level (e.g. a CDI session
  while at level 7) is simply skipped — no branch matches, so
  `computeLevelUpdate` returns `null` and nothing changes.

### Legacy field names

`ParentSkillProgress.level5QualifyingCount` / `level6QualifyingCount` /
`level7QualifyingCount` are **legacy column names** left over from the
ladder's original 7-level version (level 1 later split into 3 levels; no
Prisma schema migration was done, only a one-time data backfill of
`currentLevel += 2` for existing users — see
`server/scripts/migrate-parent-level-ladder.cjs`). They now map to
different level numbers than their names suggest:

| DB column | Actually tracks |
|---|---|
| `level5QualifyingCount` | New level **7**'s qualifying count |
| `level6QualifyingCount` | New level **8**'s qualifying count |
| `level7QualifyingCount` | New level **9**'s qualifying count |

This is called out in comments at the point of use in
`parentSkillLevelService.cjs`, `prisma/schema.prisma`, and
`packages/nora-core/src/types/index.ts` (`ParentSkillLevelInfo`). The
`/api/auth/parent-skill-level` response and `ParentSkillLevelInfo` type keep
the `level5QualifyingCount` field name unchanged for the same reason — only
level 7's qualifying count is ever exposed to the client today (levels 8/9
have no live progress-bar UI, matching the old ladder's behavior for its
last two levels).

**Client copy** for each level's name/skill/clearance description lives in
i18n at `profileReport.levels.*` (`en.json`, `zh-CN.json`, `zh-TW.json`),
keyed via `PARENT_SKILL_LEVEL_KEYS`
(`nora-mobile/src/constants/parentSkillLevels.ts`) — e.g.
`calmBuilder.clearGoal`: *"Keep criticism to 3 or fewer in a single
session."* This copy is display-only and must be kept in sync with
`CDI_FLAT_LEVELS`/`computeLevelUpdate()` by hand — it is not generated
from them.

## History: why this got unified

Before the levels-1-6 unification, the goal-card engine
(`levelGoalEngine.cjs`) and the clearance gate (`parentSkillLevelService.cjs`)
were two independently-hardcoded implementations, and had already drifted:
the clearance gate always computed "total commands" as
`direct_command + indirect_command`, while the goal engine preferred a
pre-aggregated `command` field when present — the two could disagree about
whether a given session's command count crossed a threshold. Client-side,
the same fallback-goal logic was duplicated a second time across
`ReportScreen_v2.tsx` and `ReportDetailScreen.tsx`, and the ladder's
display metadata (keys/icons/skill links) was duplicated a third time
across `ProfileReportScreen.tsx`, `ParentLevelDetailScreen.tsx`, and
`LevelUpModal.tsx`. Splitting level 1 into 3 levels (this doc's current
ladder) was the occasion to collapse all of these down to one shared
module per layer (server: `parentLevelLadder.cjs`; client:
`constants/parentSkillLevels.ts` + `utils/goalFallback.ts`).
