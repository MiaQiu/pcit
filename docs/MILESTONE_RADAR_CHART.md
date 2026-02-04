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

| Domain | Description |
|--------|-------------|
| **Language** | Speech, vocabulary, and communication milestones |
| **Cognitive** | Problem-solving, memory, and learning milestones |
| **Social** | Interaction, play, and social awareness milestones |
| **Emotional** | Emotional regulation and expression milestones |
| **Connection** | Parent-child bonding and attachment milestones |

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
- `category` - Domain category (Language, Cognitive, Social, Emotional, Connection)
- `medianAgeMonths` - Median age when children typically achieve this milestone
- `mastery90AgeMonths` - Age by which 90% of children achieve this milestone

## API Endpoint

### GET /api/learning/developmental-progress

Returns the child's developmental progress by domain with age-appropriate benchmarks.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "childAgeMonths": 36,
  "domains": {
    "Language": {
      "achieved": 8,
      "emerging": 2,
      "total": 15,
      "benchmark": 10
    },
    "Cognitive": {
      "achieved": 6,
      "emerging": 1,
      "total": 12,
      "benchmark": 8
    },
    "Social": {
      "achieved": 5,
      "emerging": 3,
      "total": 10,
      "benchmark": 7
    },
    "Emotional": {
      "achieved": 4,
      "emerging": 2,
      "total": 8,
      "benchmark": 6
    },
    "Connection": {
      "achieved": 7,
      "emerging": 1,
      "total": 10,
      "benchmark": 8
    }
  }
}
```

**Field Definitions:**
- `childAgeMonths` - Child's age in months calculated from birthday
- `achieved` - Number of milestones with status `ACHIEVED`
- `emerging` - Number of milestones with status `EMERGING`
- `total` - Total milestones available in this domain
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

| Domain | Total Milestones | Each milestone = |
|--------|------------------|------------------|
| Language | 11 | 9.1% |
| Cognitive | 5 | 20% |
| Social | 5 | 20% |
| Emotional | 3 | 33.3% |
| Connection | 2 | 50% |

### Benchmark Calculation

The benchmark is calculated by interpolating through developmental stages based on child's age:

1. For each stage the child has **completed** (age >= stage end): add all milestones from that stage
2. For the stage the child is **currently in** (age between start and end): add proportional milestones

Example for a 28-month-old in Language:
- Stage I (12-26m): 2 milestones → fully completed = 2
- Stage II (27-30m): 3 milestones → (28-27)/(30-27) = 33% through = 1
- **Benchmark = 3 milestones → 3/11 = 27%**

### Chart Geometry

- 5 axes arranged in a regular pentagon (72° apart)
- Axes start from top (Language) and go clockwise
- 3 concentric grid pentagons at 33%, 66%, 100% of max radius
- Benchmark line varies per domain (not a regular pentagon)

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
| No milestones | Show empty radar (all values at 0) |
| Zero benchmark | Display as 0% (avoids division by zero) |
| Exceeds benchmark | Cap at 150% to prevent distortion |
| Missing birthday | Falls back to `childBirthYear` from User table |

## Usage

The radar chart automatically appears on the Progress screen when:
1. User has a Child record associated with their account
2. The API successfully returns developmental progress data

No user interaction is required - the chart fetches data on screen load and renders if data is available.

## Future Enhancements

Potential improvements:
- Tap on domain to see milestone details
- Historical view showing progress over time
- Comparison with different benchmark ages
- Export/share functionality
