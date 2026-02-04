# Developmental Stage Radar Chart

## Overview

The Developmental Stage Radar Chart visualizes a child's milestone progress across 5 developmental domains compared against an age-appropriate benchmark. It appears on the Progress screen in the mobile app.

```
                         Language
                            ▲
                           /|\
                          / | \
          Connection ◄───/  |  \───► Cognitive
                        \   |   /
                         \  |  /
                          \ | /
                           \|/
            Emotional ◄─────┴─────► Social

     ━━━ Child's Progress (purple filled)
     - - - Age Benchmark (orange dashed)
```

## Domains

The chart tracks progress across 5 developmental domains:

| Domain | Description | Framework |
|--------|-------------|-----------|
| **Language** | Speech, vocabulary, and grammar | Brown's Stages |
| **Cognitive** | Problem-solving, sequencing, reasoning | Piaget/Brown |
| **Social** | Interaction, turn-taking, politeness | Halliday Interactional |
| **Emotional** | Boundaries, self-concept, regulation | Halliday Personal |
| **Connection** | Parent-child bonding and involvement | Biringen EA |

## Milestone Library

### Language (11 milestones - Brown's Stages)

| Stage | Age Range | Milestones |
|-------|-----------|------------|
| Stage I | 12-26m | Semantic Roles, Early Negation |
| Stage II | 27-30m | Present Progressive (-ing), Regular Plurals (-s), Prepositions (In/On) |
| Stage III | 31-34m | Irregular Past Tense, Possessives ('s) |
| Stage IV | 35-40m | Articles (A/The), Regular Past Tense (-ed) |
| Stage V | 41-46m | 3rd Person Irregular (Does/Has) |
| Post-Stage V | 47m+ | Passive Voice Construction |

### Cognitive (5 milestones)

| Stage | Age Range | Milestones |
|-------|-----------|------------|
| Pre-Operational | 24-36m | Immediate Naming |
| Temporal Logic | 36-48m | Sequencing (First/Then), Decentering (Past) |
| Causal Logic | 48-84m | Causal Linking (Because/So), Theory of Mind |

### Social (5 milestones)

| Stage | Age Range | Milestones |
|-------|-----------|------------|
| Transition | 24-36m | Initiation ("Let's"), Verbal Turn Taking |
| Pragmatic Dev | 36-60m | Politeness Markers, Friendship Definition |
| Interpersonal | 60-84m | Complex Play Negotiation |

### Emotional (3 milestones)

| Stage | Age Range | Milestones |
|-------|-----------|------------|
| Assertion | 24-36m | Boundaries ("Mine"/"No") |
| Identity | 36-60m | Self-Concept ("I am...") |
| Regulation | 60-84m | Emotional Justification |

### Connection (2 milestones)

| Stage | Age Range | Milestones |
|-------|-----------|------------|
| Involvement | 24-48m | Physical Check-in (Pulling/Showing) |
| Partnership | 48-84m | Verbal Role Invitation |

## Data Model

### Database Tables

**Child** - Stores child profile information
- `id` - UUID primary key
- `userId` - Reference to parent user
- `birthday` - Child's date of birth (used for age calculation)

**ChildMilestone** - Tracks individual milestone achievements
- `childId` - Reference to child
- `milestoneId` - Reference to milestone_library
- `status` - `EMERGING` or `ACHIEVED`
- `firstObservedAt` - When milestone was first observed
- `achievedAt` - When milestone was fully achieved

**MilestoneLibrary** - Master list of developmental milestones
- `category` - Domain (Language, Cognitive, Social, Emotional, Connection)
- `groupingStage` - Stage name with age range, e.g., "Stage II (27-30m)"
- `medianAgeMonths` - Median age when children typically achieve this milestone
- `mastery90AgeMonths` - Age by which 90% of children achieve this milestone

## API Endpoint

### GET /api/learning/developmental-progress

Returns the child's developmental progress by domain with age-appropriate benchmarks.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "childAgeMonths": 28,
  "domains": {
    "Language": {
      "achieved": 4,
      "emerging": 1,
      "total": 11,
      "benchmark": 3.0
    },
    "Cognitive": {
      "achieved": 1,
      "emerging": 0,
      "total": 5,
      "benchmark": 0.33
    },
    "Social": {
      "achieved": 2,
      "emerging": 1,
      "total": 5,
      "benchmark": 0.67
    },
    "Emotional": {
      "achieved": 1,
      "emerging": 0,
      "total": 3,
      "benchmark": 0.33
    },
    "Connection": {
      "achieved": 1,
      "emerging": 0,
      "total": 2,
      "benchmark": 0.17
    }
  }
}
```

**Field Definitions:**
- `childAgeMonths` - Child's age in months calculated from birthday
- `achieved` - Number of milestones with status `ACHIEVED`
- `emerging` - Number of milestones with status `EMERGING`
- `total` - Total milestones in this domain
- `benchmark` - Expected milestones for child's age (fractional, interpolated through stages)

**Error Responses:**
- `404` - No child record found for user
- `500` - Server error

## Visualization Logic

### Data Normalization

For each domain, 100% represents all milestones in that domain:

```
childValue = (achieved / total) * 100
benchmarkValue = (benchmark / total) * 100
```

| Domain | Total | Each milestone = |
|--------|-------|------------------|
| Language | 11 | 9.1% |
| Cognitive | 5 | 20% |
| Social | 5 | 20% |
| Emotional | 3 | 33.3% |
| Connection | 2 | 50% |

### Benchmark Calculation

The benchmark is calculated by interpolating through developmental stages based on child's age:

1. **Completed stages** (child age >= stage end): add all milestones from that stage
2. **Current stage** (child age between start and end): add proportional milestones
3. **Future stages** (child age < stage start): add nothing

**Example for a 28-month-old:**

**Language:**
- Stage I (12-26m): 2 milestones → completed → +2
- Stage II (27-30m): 3 milestones → (28-27)/(30-27) = 33% → +1
- Benchmark = 3 → 3/11 = **27%**

**Cognitive:**
- Pre-Operational (24-36m): 1 milestone → (28-24)/(36-24) = 33% → +0.33
- Benchmark = 0.33 → 0.33/5 = **7%**

### Chart Geometry

- 5 axes arranged in a regular pentagon (72° apart)
- Axes start from top (Language) and go clockwise
- 3 concentric grid pentagons at 33%, 66%, 100% of max radius
- Benchmark polygon varies per domain (irregular shape based on age)

### Visual Elements

| Element | Color | Style |
|---------|-------|-------|
| Child progress | #8C49D5 (purple) | Filled polygon at 30% opacity |
| Child outline | #8C49D5 (purple) | Solid 2px stroke |
| Benchmark | #FF8C42 (orange) | Dashed 2px stroke |
| Grid lines | #E5E7EB (gray) | Solid 1px stroke |
| Data points | #8C49D5 (purple) | Filled circles, r=4 |

## File Locations

| File | Purpose |
|------|---------|
| `server/routes/learning.cjs` | API endpoint implementation |
| `packages/nora-core/src/services/recordingService.ts` | TypeScript types and service method |
| `nora-mobile/src/components/RadarChart.tsx` | React Native chart component |
| `nora-mobile/src/screens/ProgressScreen.tsx` | Integration into Progress tab |

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No child record | API returns 404, chart not rendered |
| No milestones achieved | Show empty radar (child polygon at center) |
| Zero total milestones | Display as 0% (avoids division by zero) |
| Child ahead of benchmark | Polygon extends beyond orange line |
| Missing birthday | Falls back to `childBirthYear` from User table |

## Usage

The radar chart automatically appears on the Progress screen when:
1. User has a Child record associated with their account
2. The API successfully returns developmental progress data

No user interaction is required - the chart fetches data on screen load and renders if data is available.
