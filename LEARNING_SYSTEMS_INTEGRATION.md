# Learning Systems Integration Plan

**Date:** December 1, 2025
**Purpose:** Define how Bite-Size Learning (curriculum) and Recommendation Engine (practice) work together

---

## Overview

Nora has **two distinct but complementary learning systems**:

1. **Bite-Size Learning** - Sequential 41-day curriculum teaching PCIT fundamentals
2. **Recommendation Engine** - Adaptive practice modules targeting skill deficits

This document defines how these systems integrate to provide a cohesive learning experience.

---

## System Comparison

| Aspect | Bite-Size Learning | Recommendation Engine |
|--------|-------------------|----------------------|
| **Purpose** | Teach concepts | Practice skills |
| **Content** | Fixed curriculum (41 lessons) | Dynamic modules (adaptive) |
| **Progression** | Linear (Day 1→2→3...) | Priority-based (Safety→Engagement→Deficit) |
| **Trigger** | User-initiated | System-recommended after sessions |
| **Completion** | One-time per lesson | Repeated until skill mastered |
| **Data Source** | PDF curriculum | Session performance data |
| **Unlock Logic** | Prerequisites (previous lessons) | Always available when needed |

---

## Integration Strategy

### **Approach: Dual-Track Learning**

Users progress through **both systems simultaneously**:

1. **Learn Track** (Bite-Size Learning)
   - Sequential curriculum teaching concepts
   - User completes 1 lesson per day (ideally)
   - Unlocks linearly with prerequisites
   - Located in **Learn Tab** (bottom navigation)

2. **Practice Track** (Recommendation Engine)
   - Personalized practice modules
   - System recommends after each recording session
   - Targets detected weaknesses
   - Located in **Home Tab** or **Progress Tab**

### Visual Separation

```
Bottom Navigation:
┌──────────┬──────────┬──────────┬──────────┐
│   Home   │  Record  │  Learn   │ Progress │
└──────────┴──────────┴──────────┴──────────┘
     ↓          ↓          ↓          ↓
  Practice   Record   Curriculum  Stats +
  Modules   Session   Lessons     Recommendations
```

---

## Content Mapping

### Phase 1: Connect (Days 1-15)
**Bite-Size Learning teaches:**
- Day 1: Why PCIT works
- Day 2-3: Introduction to Praise
- Day 4-5: Introduction to Echo
- Day 6-7: Introduction to Narration
- Day 8: Bringing PEN together
- Day 9-11: Deep dive into Praise techniques
- Day 12-13: Deep dive into Echo techniques
- Day 14-15: Deep dive into Narration techniques

**Recommendation Engine provides:**
- PRAISE modules (Levels 1-4) for practice
- ECHO modules (Levels 1-4) for practice
- NARRATION modules (Levels 1-4) for practice

**Relationship:**
- Lessons = **Theory and concepts**
- Modules = **Practice and application**

Example:
- User completes **Lesson Day 2: "Introduction to Praise"** (Learn tab)
- User records session and gets low praise count
- System recommends **"PRAISE Level 1"** module (Home tab)
- Module provides practice scenarios to apply what they learned

---

## Database Schema Updates

### Current Schema Issue
The existing `ModuleHistory` table tracks recommendation module views, but there's no link to the new `Lesson` system.

### Proposed Updates

```prisma
// EXISTING - Keep as-is for recommendation modules
model ModuleHistory {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  category    String   // PRAISE, ECHO, NARRATION, CRITICISM, etc.
  level       Int      // 1-4
  viewedAt    DateTime @default(now())

  @@index([userId, category])
  @@index([userId, viewedAt])
}

// NEW - Tracks lesson completion (already designed)
model UserLessonProgress {
  id              String          @id @default(cuid())
  userId          String
  lessonId        String

  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson          Lesson          @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  status          ProgressStatus  // NOT_STARTED, IN_PROGRESS, COMPLETED
  currentSegment  Int             @default(1)
  totalSegments   Int             @default(4)
  completedAt     DateTime?

  startedAt       DateTime        @default(now())
  lastViewedAt    DateTime        @default(now())
  timeSpentSeconds Int            @default(0)

  @@unique([userId, lessonId])
  @@index([userId, status])
  @@index([lessonId])
}

// OPTIONAL: Link lessons to recommendation categories
model Lesson {
  id                String              @id @default(cuid())
  // ... existing fields ...

  // NEW: Link lesson to recommendation categories
  teachesCategories String[]            // e.g., ["PRAISE", "ECHO"]

  // This helps UI show: "Want to practice what you learned? Try [Praise Module]"
}
```

---

## User Experience Flows

### Flow 1: New User Onboarding

```
1. User signs up
   └─> HomeScreen shows:
       - "Start your first lesson" CTA (Learn tab)
       - "No recommendations yet - record a session first!"

2. User completes Lesson Day 1
   └─> Learns about PCIT basics
   └─> HomeScreen shows:
       - "Ready to try a practice session?" CTA (Record tab)

3. User records first session
   └─> Gets PCIT analysis (Praise: 2, Echo: 1, Narration: 0)
   └─> HomeScreen shows:
       - Recommended module: "Praise Level 1" (low count detected)
       - "Continue to Day 2" (Learn tab)

4. User can choose:
   - Practice recommended module (Home tab)
   - Continue to next lesson (Learn tab)
   - Record another session (Record tab)
```

### Flow 2: Returning User

```
User opens app
└─> HomeScreen shows:

    ┌─────────────────────────────────────┐
    │  📊 Your Progress                   │
    │  ─────────────────────────          │
    │  Current lesson: Day 5 of 41        │
    │  Sessions recorded: 3               │
    │  Current streak: 5 days 🔥          │
    └─────────────────────────────────────┘

    ┌─────────────────────────────────────┐
    │  🎯 Recommended for You             │
    │  ─────────────────────────          │
    │  Based on your recent sessions:     │
    │                                      │
    │  [Narration Level 2 Module]         │
    │  Your narration needs work          │
    │  (Current: 3, Target: 10)           │
    │                                      │
    │  [Start Practice →]                 │
    └─────────────────────────────────────┘

    ┌─────────────────────────────────────┐
    │  📚 Continue Learning               │
    │  ─────────────────────────          │
    │  Next lesson: Day 6                 │
    │  "Narration Deep Dive"              │
    │                                      │
    │  [Continue Lesson →]                │
    └─────────────────────────────────────┘
```

### Flow 3: After Recording Session

```
User completes recording session
└─> Session analyzed (Praise: 12, Echo: 8, Narration: 4)
└─> Navigate to Results screen
└─> Results screen shows:

    ┌─────────────────────────────────────┐
    │  ✅ Great job!                      │
    │  Nora Score: 75/100                 │
    │  ─────────────────────────          │
    │  Praise: 12 ✓ (Target: 10)         │
    │  Echo: 8   ⚠ (Target: 10)          │
    │  Narration: 4 ⚠ (Target: 10)       │
    └─────────────────────────────────────┘

    ┌─────────────────────────────────────┐
    │  🎯 Recommended Next Steps          │
    │  ─────────────────────────          │
    │  1. Practice Echo (Level 2)         │
    │     [Start Module →]                │
    │                                      │
    │  2. Review Day 12: "Echo Deep Dive" │
    │     [Review Lesson →]               │
    │                                      │
    │  3. Record another session          │
    │     [Record Again →]                │
    └─────────────────────────────────────┘
```

---

## Navigation Structure

### Home Tab (Landing Page)
**Purpose:** Show personalized recommendations + quick actions

**Content:**
- Progress summary widget (streak, lesson count, session count)
- **Recommended module** (from recommendationService)
- Next lesson CTA (from lessonService)
- Quick actions (Record session, View progress)

### Learn Tab (Curriculum)
**Purpose:** Sequential lesson progression

**Content:**
- List of all 41 lessons (LessonCard components)
- Progress indicator per lesson (NOT_STARTED, IN_PROGRESS, COMPLETED, LOCKED)
- Filter by phase (Connect / Discipline)
- Search lessons

**Note:** This is where the current mock HomeScreen content should move to

### Record Tab
**Purpose:** Record and analyze sessions

**Content:**
- Record button
- Session history
- (Unchanged from current design)

### Progress Tab
**Purpose:** Analytics and stats

**Content:**
- Streak calendar
- Nora Score graph
- Lessons completed count
- Sessions recorded count
- Skill breakdown (Praise/Echo/Narration progress)
- **Recommendation history** (which modules have been viewed)

---

## API Design Updates

### New Endpoint: Combined Dashboard

```typescript
// GET /api/dashboard
// Returns everything needed for HomeScreen

interface DashboardResponse {
  // User stats
  stats: {
    currentLesson: number;      // Day 5 of 41
    totalLessons: number;       // 41
    completedLessons: number;   // 4
    sessionsRecorded: number;   // 12
    currentStreak: number;      // 5
  };

  // Next lesson (from lessonService)
  nextLesson: {
    id: string;
    dayNumber: number;
    title: string;
    phase: string;
    isLocked: boolean;
  };

  // Recommended module (from recommendationService)
  recommendation: {
    category: string;           // "NARRATION"
    level: number;              // 2
    priority: string;           // "DEFICIT"
    reason: string;             // "Your narration count (4) needs work..."
    moduleContent: {
      title: string;
      description: string;
      exercises: Exercise[];
    };
  } | null;  // null if no sessions recorded yet

  // Recent activity
  recentSessions: Session[];    // Last 3 sessions
}
```

### Service Updates

```typescript
// packages/nora-core/src/services/lessonService.ts

class LessonService {
  // ... existing methods ...

  /**
   * Get the next lesson user should complete
   * Considers prerequisites and current progress
   */
  async getNextLesson(userId: string): Promise<Lesson | null> {
    // Find first NOT_STARTED or IN_PROGRESS lesson with met prerequisites
    // Returns null if all lessons completed
  }

  /**
   * Get lessons that teach a specific category
   * Useful for showing "Review these lessons" when module recommended
   */
  async getLessonsByCategory(category: string): Promise<Lesson[]> {
    // Filter lessons where teachesCategories includes category
    // Example: getLessonsByCategory("PRAISE") returns Days 2-3, 9-11
  }
}

// server/services/recommendationService.cjs

class RecommendationService {
  // ... existing methods ...

  /**
   * Get recommended module content for a category + level
   */
  getModuleContent(category, level) {
    // Returns the actual practice module content
    // This would need to be designed - not in current system
    return {
      title: `${category} Practice - Level ${level}`,
      description: 'Practice exercises to improve your skill',
      exercises: [
        // Practice scenarios, examples, tips
      ],
    };
  }
}
```

---

## Implementation Impact

### Changes to LEARNING_ARCHITECTURE.md

**No major changes needed!** The bite-size learning architecture is solid. Just add:

1. **Section 2.1** (Database Schema):
   - Add `teachesCategories: String[]` field to `Lesson` model
   - Note that `ModuleHistory` table is separate (recommendation modules)

2. **Section 3** (Backend API):
   - Add `GET /api/dashboard` endpoint
   - Add `GET /api/lessons/by-category/:category` endpoint

3. **New Section 11** (Integration with Recommendation Engine):
   - Reference this document (LEARNING_SYSTEMS_INTEGRATION.md)
   - Explain dual-track learning approach

### Changes to Mobile UI

**HomeScreen.tsx:**
- Change from lesson list to dashboard view
- Show 3 cards:
  1. Progress summary
  2. Recommended module (from recommendationService)
  3. Next lesson CTA (from lessonService)

**New LearnScreen.tsx:**
- Move current HomeScreen lesson list here
- This is where all 41 lessons live
- Add phase filters (Connect / Discipline)

**Existing LessonViewerScreen.tsx:**
- No changes needed
- Works for both curriculum lessons and module content

---

## Content Strategy

### Who Creates What?

1. **Bite-Size Learning Content** (41 lessons)
   - Source: "Bite Size Learning.pdf"
   - Content: Already written ✅
   - Action: Parse and seed into database

2. **Recommendation Module Content** (Practice modules)
   - Source: **Needs to be created** ⚠️
   - Content: Practice scenarios, tips, examples for each category × level
   - Required modules:
     - PRAISE (Levels 1-4) = 4 modules
     - ECHO (Levels 1-4) = 4 modules
     - NARRATION (Levels 1-4) = 4 modules
     - CRITICISM (Levels 1-4) = 4 modules
     - QUESTIONS (Levels 1-4) = 4 modules
     - COMMANDS (Levels 1-4) = 4 modules
     - MAINTENANCE (Levels 1-4) = 4 modules
   - **Total: 28 practice modules needed**

### Content Differentiation

**Lesson Example (Day 2: Introduction to Praise):**
```
Title: "Praise is rocket fuel for good behavior"

Content:
- What is praise and why it works
- Types of praise (labeled vs unlabeled)
- Examples of good praise statements
- Common mistakes to avoid
- Quiz: "Which is a Super-Praise?"

Format: Educational, conceptual, 2-min read
```

**Module Example (PRAISE Level 1):**
```
Title: "Praise Practice - Beginner"

Content:
- Quick recap: What makes good praise?
- Exercise 1: Identify labeled praise (multiple choice)
- Exercise 2: Convert unlabeled to labeled praise
- Exercise 3: Practice writing 5 praise statements
- Tips: Start with simple observations

Format: Interactive practice, hands-on exercises
```

**Key Difference:**
- **Lessons = Learn the theory** ("What is praise?")
- **Modules = Practice the skill** ("Write 5 praise statements")

---

## Recommendation

### ✅ Keep Both Systems

**Verdict:** The two learning systems are **complementary, not conflicting**. Here's the plan:

1. **Bite-Size Learning (curriculum)** stays as designed in LEARNING_ARCHITECTURE.md
   - Sequential 41-day program
   - Teach concepts and theory
   - Located in Learn tab

2. **Recommendation Engine** continues working as-is
   - Adaptive practice recommendations
   - Based on session performance
   - Located in Home tab

3. **Integration points:**
   - Add `teachesCategories` field to Lesson model
   - Create new `GET /api/dashboard` endpoint
   - Redesign HomeScreen to show both recommendations and next lesson
   - Move lesson list from HomeScreen to new LearnScreen

4. **Content gap:**
   - Need to create 28 practice modules for recommendation system
   - These are separate from the 41 curriculum lessons
   - Can be created iteratively (start with PRAISE Level 1, etc.)

### Next Steps

1. **Immediate (This Week):**
   - Review this integration plan
   - Decide on HomeScreen redesign (dashboard view)
   - Confirm dual-track learning approach

2. **Phase 0 (Week 1):**
   - Add `teachesCategories` to Lesson schema
   - Keep ModuleHistory table as-is
   - Implement `GET /api/dashboard` endpoint

3. **Phase 1-2 (Weeks 2-3):**
   - Implement bite-size learning (lessons + quiz)
   - Test with PDF content

4. **Phase 3 (Week 4):**
   - Redesign HomeScreen as dashboard
   - Create LearnScreen for lesson list
   - Integrate recommendation display

5. **Future (Week 5+):**
   - Create practice module content (28 modules)
   - Build module viewer (similar to lesson viewer)
   - Full integration testing

---

**Summary:** Both systems stay. They serve different purposes and enhance each other. Minor integration work needed (dashboard endpoint, HomeScreen redesign, link lessons to categories).
