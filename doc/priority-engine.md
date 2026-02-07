# Priority Engine

Clinical prioritization engine that evaluates child issues and writes intervention priorities to the `Child` table.

## Overview

The priority engine combines two data sources to determine clinical priorities:
1. **User.issue** - Issues selected during onboarding (e.g., tantrums, not-listening)
2. **WacbSurvey** - Weekly Assessment of Child Behavior scores

It outputs four fields on the `Child` model:
- `primaryIssue` - Highest priority clinical level
- `primaryStrategy` - Intervention strategy for primary issue
- `secondaryIssue` - Second priority clinical level (or null)
- `secondaryStrategy` - Intervention strategy for secondary issue (or null)

## Clinical Levels

Ordered by priority (Level I = highest):

| Level | Enum Value | Description |
|-------|------------|-------------|
| I | `STABILIZE` | Crisis stabilization needed |
| II | `DE_ESCALATE` | De-escalation focus |
| III | `DIRECT` | Direct behavior management |
| IV | `SUPPORT` | Supportive guidance |
| V | `FLOURISH` | Growth and skill building |

## Intervention Strategies

Each clinical level maps 1:1 to a strategy:

| Clinical Level | Strategy |
|----------------|----------|
| `STABILIZE` | `AGGRESSIVE_DE_ESCALATION` |
| `DE_ESCALATE` | `DIFFERENTIAL_ATTENTION` |
| `DIRECT` | `POSITIVE_REINFORCEMENT` |
| `SUPPORT` | `RELATIONSHIP_BUFFERING` |
| `FLOURISH` | `SKILL_COACHING` |

## Issue Mappings

User.issue values map to clinical levels:

| Issue | Clinical Level |
|-------|----------------|
| `tantrums` | DE_ESCALATE |
| `arguing` | DE_ESCALATE |
| `not-listening` | DIRECT |
| `new_baby_in_the_house` | SUPPORT |
| `Navigating_change` | SUPPORT |
| `social` | FLOURISH |
| `frustration_tolerance` | FLOURISH |
| `other` | *(ignored)* |

## WACB Question Mappings

WACB survey questions map to clinical levels:

| Clinical Level | Questions |
|----------------|-----------|
| `STABILIZE` | q4Angry, q6Destroy |
| `DE_ESCALATE` | q5Scream, q7ProvokeFights |
| `DIRECT` | q1Dawdle, q2MealBehavior, q3Disobey, q8Interrupt |
| `FLOURISH` | q9Attention |
| `SUPPORT` | *(no WACB questions)* |

**Signal Threshold:** A WACB question score >= 3 counts as a signal present.

## Sorting Logic

Active levels (those with at least one signal) are sorted by:

1. **Clinical priority index** - Lower index wins (STABILIZE > DE_ESCALATE > DIRECT > SUPPORT > FLOURISH)
2. **Tiebreaker: Both sources** - Levels confirmed by both issue AND WACB rank higher
3. **Tiebreaker: WACB severity** - Higher total WACB score for that level wins

Primary = first in sorted list, Secondary = second (or null if only one level).

## Integration Points

The engine runs at two points:

### 1. After Onboarding (`server/routes/auth.cjs`)

In `PATCH /api/auth/complete-onboarding`, after user update when `issue` is provided:

```js
if (issue) {
  runPriorityEngine(req.userId).catch(err => {
    console.error('[PRIORITY-ENGINE] Error during onboarding:', err.message);
  });
}
```

### 2. After WACB Survey (`server/routes/wacb-survey.cjs`)

In `POST /api/wacb-survey`, after survey creation:

```js
runPriorityEngine(userId).catch(err => {
  console.error('[PRIORITY-ENGINE] Error after WACB survey:', err.message);
});
```

Both are fire-and-forget calls that don't block the response.

## API

### `runPriorityEngine(userId, { wacbSurveyId } = {})`

Main entry point. Finds or creates a `Child` record for the user, evaluates priorities, updates the child, and appends `ChildIssuePriority` history rows.

- `wacbSurveyId` (optional) - Links the history rows to the triggering WACB survey

```js
const { runPriorityEngine } = require('./server/services/priorityEngine.cjs');

const updatedChild = await runPriorityEngine(userId);
// Returns the updated Child record with priority fields populated

// With WACB survey link:
const updatedChild = await runPriorityEngine(userId, { wacbSurveyId: survey.id });
```

### `evaluatePriorities(userId)`

Evaluates priorities without updating the database. Useful for testing.

```js
const { evaluatePriorities } = require('./server/services/priorityEngine.cjs');

const result = await evaluatePriorities(userId);
// { primaryIssue, primaryStrategy, secondaryIssue, secondaryStrategy, activeLevels }
// activeLevels: [{ level, priorityIndex, fromUserIssue, fromWacb, fromBothSources, wacbScore, userIssues, wacbQuestions }]
```

### `parseUserIssues(issueField)`

Parses `User.issue` field (JSON array string or plain string) into array.

```js
parseUserIssues('["tantrums","arguing"]')  // ['tantrums', 'arguing']
parseUserIssues('tantrums')                 // ['tantrums']
parseUserIssues(null)                       // []
```

### `calculateWacbLevelScores(survey)`

Returns map of clinical levels to scores for levels with signals >= threshold.

```js
calculateWacbLevelScores(survey)
// { DIRECT: { score: 13, hasSignal: true }, FLOURISH: { score: 3, hasSignal: true } }
```

## Testing

Use the test script to run the engine for specific children:

```bash
node scripts/test-priority-engine.cjs <childId1> [childId2] ...
```

Example:
```bash
node scripts/test-priority-engine.cjs 61adccb5-79e7-4e64-a353-3c5a7b8ba9ac
```

Output shows:
- Child name and ID
- User issues
- WACB scores
- Resulting priorities

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No WACB survey yet | Only issue-based signals used |
| No issues selected | Only WACB-based signals used |
| "other" issue | Silently ignored (no clinical mapping) |
| All WACB scores < 3 | No WACB signals contribute |
| Only one level with signal | Primary set, secondary null |
| Existing Child record | Found and updated (no duplicate) |
| WACB re-submitted | Latest survey fetched, Child updated, new history rows appended |
| No signals at all | All priority fields set to null, no history rows created |
| Engine run multiple times | History rows are appended (not replaced), building a timeline |

## Database Schema

```prisma
enum ClinicalLevel {
  STABILIZE       // Level I
  DE_ESCALATE     // Level II
  DIRECT          // Level III
  SUPPORT         // Level IV
  FLOURISH        // Level V
}

enum InterventionStrategy {
  AGGRESSIVE_DE_ESCALATION
  DIFFERENTIAL_ATTENTION
  POSITIVE_REINFORCEMENT
  RELATIONSHIP_BUFFERING
  SKILL_COACHING
}

model Child {
  // ... existing fields ...
  primaryIssue      ClinicalLevel?
  primaryStrategy   InterventionStrategy?
  secondaryIssue    ClinicalLevel?
  secondaryStrategy InterventionStrategy?
  ChildIssuePriority ChildIssuePriority[]
}

model ChildIssuePriority {
  id            String               @id @default(uuid())
  childId       String
  clinicalLevel ClinicalLevel
  strategy      InterventionStrategy
  priorityRank  Int                  // 1 = highest priority
  fromUserIssue Boolean              @default(false)
  fromWacb      Boolean              @default(false)
  userIssues    String?              // JSON array of issue strings
  wacbQuestions String?              // JSON array of question keys
  wacbScore     Int?                 // Aggregate WACB score for this level
  computedAt    DateTime             @default(now())
  wacbSurveyId  String?              // Which WACB survey triggered this computation
  Child         Child                @relation(...)
  WacbSurvey    WacbSurvey?          @relation(...)
}
```

## History Tracking

The `ChildIssuePriority` table builds a historical timeline of how each issue/behavior evolves. New rows are **appended** each time the priority engine runs (not deleted/replaced), so you get a full history. The `computedAt` timestamp + optional `wacbSurveyId` link each snapshot to when/why it was computed.

### Query Examples

```sql
-- Current priorities (latest snapshot)
SELECT * FROM "ChildIssuePriority"
WHERE "childId" = ? AND "computedAt" = (
  SELECT MAX("computedAt") FROM "ChildIssuePriority" WHERE "childId" = ?
)
ORDER BY "priorityRank";

-- How DE_ESCALATE priority changed over time
SELECT "priorityRank", "wacbScore", "fromUserIssue", "fromWacb", "computedAt"
FROM "ChildIssuePriority"
WHERE "childId" = ? AND "clinicalLevel" = 'DE_ESCALATE'
ORDER BY "computedAt";

-- When did STABILIZE first appear?
SELECT MIN("computedAt") FROM "ChildIssuePriority"
WHERE "childId" = ? AND "clinicalLevel" = 'STABILIZE';
```

## File Locations

| File | Purpose |
|------|---------|
| `server/services/priorityEngine.cjs` | Core engine implementation |
| `server/routes/auth.cjs` | Onboarding integration |
| `server/routes/wacb-survey.cjs` | WACB survey integration |
| `prisma/schema.prisma` | Schema with enums and Child fields |
| `scripts/test-priority-engine.cjs` | Test script |
