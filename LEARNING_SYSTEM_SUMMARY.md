# Learning System - Architecture Summary

**Project:** Nora Mobile App - Bite-Size Learning Feature
**Date:** December 1, 2025
**Status:** ✅ Architecture Complete - Ready for Implementation

---

## 📋 Overview

This document provides an executive summary of the complete learning system architecture for Nora's parent training program. All detailed specifications are available in `/nora-mobile/LEARNING_ARCHITECTURE.md`.

---

## 🎯 What Was Delivered

### 1. **Content Analysis** ✅
- Analyzed "Bite Size Learning.pdf" containing 41 lessons
- **Phase 1 (Connect)**: 15 days of content
- **Phase 2 (Discipline)**: 26 days of content
- Each lesson includes: core content, examples, practice tips, and daily quiz

### 2. **Figma Design Review** ✅
- **Lesson Content Viewer** (36:1210): Segmented progress, scrollable content, dragon illustrations
- **Quiz Question Screen** (36:1223): Multiple choice with 3 response buttons, back/continue navigation
- **Quiz Feedback Screen** (36:1238): Correct/incorrect feedback with teal/red color coding, explanation banner
- All UI specifications documented with exact colors, fonts, spacing, and states

### 3. **Database Schema** ✅
Complete Prisma schema designed with 6 new models:
- `Lesson` - Core lesson metadata, assets, relationships
- `LessonSegment` - Multi-segment content structure (1-4 segments per lesson)
- `Quiz` - Quiz questions linked to lessons
- `QuizOption` - Multiple choice options (A/B/C/D)
- `UserLessonProgress` - Track user progress, time spent, completion status
- `QuizResponse` - Record quiz attempts, correct/incorrect, retakes

**Key Features:**
- Prerequisite system (locked lessons until prerequisites complete)
- Multi-segment lesson support (progress tracking per segment)
- Unlimited quiz retakes
- Time tracking per lesson
- Phase-based organization (Connect/Discipline)

### 4. **Backend API Architecture** ✅
**LessonService** designed for `@nora/core` with 7 endpoints:
```
GET    /api/lessons                    # List all lessons with progress
GET    /api/lessons/:id                # Get lesson detail with segments
GET    /api/lessons/next               # Get next unlocked lesson
GET    /api/lessons?phase=CONNECT      # Filter by phase
PUT    /api/lessons/:id/progress       # Update progress/segment
POST   /api/quizzes/:id/submit         # Submit quiz answer
GET    /api/user/learning-stats        # Get user statistics
```

**Service Methods:**
- `getLessons()` - Fetch all lessons with user progress
- `getLessonDetail(id)` - Get full lesson content + segments
- `updateProgress(id, data)` - Track segment completion & time
- `submitQuizAnswer(quizId, answer)` - Submit & validate quiz
- `getLessonsByPhase(phase)` - Filter by Connect/Discipline
- `getNextLesson()` - Smart recommendation based on progress

### 5. **Mobile UI Components** ✅
React Native components specified for `/nora-mobile/src/components/`:

**New Components Needed:**
1. **ProgressBar** (Figma: 1:644)
   - Segmented progress bar (1-4 segments)
   - Purple active (#8C49D5), gray inactive (#E0E0E0)
   - 8px height, 4px gap, smooth animations

2. **ResponseButton** (Figma: 1:595)
   - Quiz answer buttons with 4 states
   - Default: white bg, gray border
   - Selected: light purple bg (#F5F0FF), purple border
   - Correct: teal bg (#E8F8F5), teal border, checkmark icon
   - Incorrect: light red bg (#FFEBEE), red border, X icon

3. **QuizFeedback**
   - Slide-up banner (bottom of screen)
   - Teal for correct, red for incorrect
   - Title + explanation text
   - Rounded top corners (24px)

4. **QuizScreen** (new screen)
   - Replace modal navigation with full screen
   - Header badge, question title, response buttons
   - Back + Continue navigation at bottom

**Enhancements Needed:**
- **LessonViewerScreen**: Support multi-segment navigation, segment progress tracking
- **HomeScreen**: Replace mock data with API calls to `lessonService.getLessons()`

---

## 📐 Implementation Plan

### **Phase 0: Foundation** (Week 1) - Database & Backend
- [ ] Add Prisma schema to `prisma/schema.prisma`
- [ ] Run migrations: `npx prisma migrate dev --name add-learning-system`
- [ ] Create `packages/nora-core/src/services/lessonService.ts`
- [ ] Implement backend API routes in main server
- [ ] Add TypeScript types to `packages/nora-core/src/types/lesson.ts`

**Deliverable:** Backend API functional, database ready for content

---

### **Phase 1: Lesson Viewer Enhancement** (Week 2)
- [ ] Build `ProgressBar` component
- [ ] Update `LessonViewerScreen` to support multi-segment lessons
- [ ] Add segment navigation (next/previous segment)
- [ ] Track segment progress via `lessonService.updateProgress()`
- [ ] Handle transitions between segments
- [ ] Add "Complete Lesson" screen after last segment

**Deliverable:** Enhanced lesson viewer with segment tracking

---

### **Phase 2: Quiz Implementation** (Week 3)
- [ ] Build `ResponseButton` component (4 states)
- [ ] Build `QuizFeedback` component
- [ ] Create `QuizScreen` (new screen)
- [ ] Add navigation: LessonViewer → QuizScreen
- [ ] Implement quiz submission via `lessonService.submitQuizAnswer()`
- [ ] Show feedback (correct/incorrect)
- [ ] Handle retakes (unlimited attempts)
- [ ] Navigate back to HomeScreen on completion

**Deliverable:** Complete quiz flow with feedback

---

### **Phase 3: Home Screen Integration** (Week 4)
- [ ] Replace `MOCK_LESSONS` with API call to `lessonService.getLessons()`
- [ ] Show real user progress on lesson cards
- [ ] Implement lesson locking (prerequisites)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Show "Next Lesson" recommendation

**Deliverable:** Dynamic home screen with real data

---

### **Phase 4: Content Population** (Week 5)
- [ ] Parse PDF content programmatically or manually
- [ ] Create seed script to populate database
- [ ] Add all 41 lessons (15 Connect + 26 Discipline)
- [ ] Add all segments per lesson
- [ ] Add all quiz questions + options
- [ ] Test prerequisite chains
- [ ] Verify all content renders correctly

**Deliverable:** Database fully populated with 41 lessons

---

### **Phase 5: Polish & Advanced Features** (Week 6)
- [ ] Add lesson completion celebrations
- [ ] Implement streak tracking integration
- [ ] Add "Resume lesson" functionality
- [ ] Add time tracking analytics
- [ ] Optimize image loading
- [ ] Add offline lesson caching (optional)
- [ ] Add quiz retake UI improvements
- [ ] User testing & bug fixes

**Deliverable:** Production-ready learning system

---

## 🎨 Key Design Specifications

### Colors (from Figma)
```typescript
{
  // Primary
  mainPurple: '#8C49D5',
  textDark: '#1E2939',
  white: '#FFFFFF',

  // Lesson Cards
  cardPurple: '#E4E4FF',
  cardOrange: '#FFE4C0',
  ellipseCyan: '#9BD4DF',
  ellipseOrange: '#FFB380',

  // Quiz Feedback
  successTeal: '#00B894',      // Correct answers
  successTealLight: '#E8F8F5', // Correct background
  errorRed: '#F44336',         // Incorrect answers
  errorRedLight: '#FFEBEE',    // Incorrect background

  // UI Elements
  borderGray: '#E0E0E0',
  inactiveGray: '#9CA3AF',
  selectedPurple: '#F5F0FF',
}
```

### Typography
- **Font Family**: Plus Jakarta Sans
- **Headline**: 32px Bold, -0.2px letter-spacing, 38px line-height
- **Body**: 16px Regular, 22px line-height, -0.31px letter-spacing
- **Label**: 14px SemiBold, 1px letter-spacing (uppercase)
- **Button**: 16px Bold

### Spacing
- Horizontal padding: 24px
- Button height: 64px
- Card border radius: 24px
- Button border radius: 112px (fully rounded)
- Gap between cards: 8px
- Gap between segments: 4px

---

## 📊 Data Flow

### User Journey: Reading a Lesson
```
1. User opens HomeScreen
   └─> Calls: lessonService.getLessons()
   └─> Displays: Lesson cards with progress

2. User taps lesson card
   └─> Calls: lessonService.getLessonDetail(id)
   └─> Navigates: LessonViewerScreen
   └─> Shows: Segment 1 of 4

3. User taps "Continue"
   └─> Calls: lessonService.updateProgress(id, { currentSegment: 2 })
   └─> Shows: Segment 2 of 4

4. After last segment (4 of 4)
   └─> Navigates: QuizScreen
   └─> Shows: Quiz question with 3 options

5. User selects answer
   └─> Calls: lessonService.submitQuizAnswer(quizId, answer)
   └─> Shows: Feedback (correct/incorrect + explanation)

6. User taps "Continue"
   └─> Marks lesson as completed
   └─> Updates streak (if applicable)
   └─> Navigates: Back to HomeScreen
```

---

## 🔑 Key Technical Decisions

### 1. **Multi-Segment Lessons**
- Lessons are split into 1-4 segments (not pages)
- Progress tracked per segment
- User can close and resume mid-lesson
- `currentSegment` field in `UserLessonProgress`

### 2. **Quiz After Content**
- Quiz appears after completing all lesson segments
- Quiz is always the last segment
- User must answer quiz to complete lesson
- Unlimited retakes allowed

### 3. **Prerequisite System**
- Lessons can be locked based on prerequisites
- `prerequisites: string[]` field stores required lesson IDs
- Backend validates completion before unlocking
- UI shows lock icon on lesson cards

### 4. **Progress Tracking**
- `status`: NOT_STARTED | IN_PROGRESS | COMPLETED | LOCKED
- `currentSegment`: Which segment user is viewing (1-4)
- `timeSpentSeconds`: Total time spent on lesson
- `lastViewedAt`: For "Resume where you left off"

### 5. **Quiz Retakes**
- Unlimited attempts allowed
- `attemptNumber` tracked in `QuizResponse`
- Latest attempt shown in UI
- Consider showing attempt history (optional)

---

## 📁 File Structure

```
nora/
├── prisma/
│   └── schema.prisma                    # Add Lesson models here
│
├── packages/nora-core/
│   └── src/
│       ├── services/
│       │   └── lessonService.ts         # NEW - Lesson API service
│       └── types/
│           └── lesson.ts                # NEW - Lesson TypeScript types
│
├── nora-mobile/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProgressBar.tsx          # NEW - Segment progress
│   │   │   ├── ResponseButton.tsx       # NEW - Quiz answer button
│   │   │   └── QuizFeedback.tsx         # NEW - Feedback banner
│   │   │
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx           # UPDATE - Use API
│   │   │   ├── LessonViewerScreen.tsx   # UPDATE - Multi-segment
│   │   │   └── QuizScreen.tsx           # NEW - Quiz interface
│   │   │
│   │   └── navigation/
│   │       └── types.ts                 # UPDATE - Add QuizScreen route
│   │
│   └── docs/
│       ├── LEARNING_ARCHITECTURE.md     # ✅ Complete architecture (1123 lines)
│       ├── FIGMA_DESIGN_CATALOG.md      # ✅ All Figma references
│       └── COMPONENTS_SPECIFICATION.md  # ✅ Component specs
│
└── LEARNING_SYSTEM_SUMMARY.md           # ✅ This file
```

---

## ✅ What's Already Built

### Existing Components (Reusable)
- ✅ **Button** (`Button.tsx`) - Primary CTA button
- ✅ **Card** (`Card.tsx`) - Container with shadow
- ✅ **Badge** (`Badge.tsx`) - Phase labels
- ✅ **LessonCard** (`LessonCard.tsx`) - Lesson card with dragon

### Existing Screens
- ✅ **HomeScreen** - Currently shows mock lessons
- ✅ **LessonViewerScreen** - Basic lesson viewer (needs multi-segment support)

### Existing Services
- ✅ **authService** - Authentication
- ✅ **sessionService** - Recording sessions
- ✅ **pcitService** - PCIT analysis
- ✅ **transcriptionService** - Audio transcription

---

## 🚀 Getting Started (Next Steps)

### Immediate Actions (This Week):
1. **Review & approve this architecture**
   - Read `/nora-mobile/LEARNING_ARCHITECTURE.md` (full specifications)
   - Confirm database schema design
   - Confirm API endpoint design
   - Confirm UI component specifications

2. **Start Phase 0 implementation**
   - Add Prisma schema to `schema.prisma`
   - Run database migration
   - Create `lessonService.ts` stub in `@nora/core`
   - Set up backend API routes

3. **Design decisions needed:**
   - Should quiz attempts show history? (Recommended: No, just latest)
   - Should we track time-per-segment? (Recommended: No, just per-lesson)
   - Celebration screen after lesson completion? (Recommended: Yes, simple animation)
   - How to display booster lessons? (Recommended: Different badge color)

---

## 📚 Additional Documentation

- **Complete Architecture**: `/nora-mobile/LEARNING_ARCHITECTURE.md` (1123 lines)
  - Sections: Content Analysis, Data Model, Backend API, Mobile UI, Implementation Phases, Figma Integration, API Examples, Success Metrics, Next Steps, Decisions

- **Figma Catalog**: `/nora-mobile/docs/FIGMA_DESIGN_CATALOG.md`
  - All screen designs with node IDs
  - Complete component library
  - Design system tokens (colors, typography, spacing)

- **Component Specs**: `/nora-mobile/docs/COMPONENTS_SPECIFICATION.md`
  - 20+ component specifications
  - TypeScript interfaces
  - Styling details for each state
  - Implementation priorities

---

## 🎯 Success Criteria

### Phase 0 Complete When:
- ✅ Database schema added and migrated
- ✅ LessonService created with all methods
- ✅ Backend API endpoints functional
- ✅ TypeScript types defined

### Phase 1 Complete When:
- ✅ ProgressBar component renders on iOS + Android
- ✅ LessonViewer supports multi-segment lessons
- ✅ Segment progress tracked in database
- ✅ User can navigate between segments

### Phase 2 Complete When:
- ✅ QuizScreen fully functional
- ✅ User can select and submit answers
- ✅ Feedback displays correctly (teal/red)
- ✅ Retakes work as expected

### Phase 3 Complete When:
- ✅ HomeScreen displays real lessons from API
- ✅ Lesson locking based on prerequisites works
- ✅ Progress indicators show correct state
- ✅ Error handling works gracefully

### Phase 4 Complete When:
- ✅ All 41 lessons seeded in database
- ✅ All segments and quizzes populated
- ✅ Content displays correctly in UI
- ✅ No broken images or missing data

### Phase 5 Complete When:
- ✅ User testing completed
- ✅ All bugs fixed
- ✅ Performance optimized
- ✅ Ready for production deployment

---

## 📞 Questions or Blockers?

If you need clarification on any aspect of the architecture:
1. Check `/nora-mobile/LEARNING_ARCHITECTURE.md` for detailed specs
2. Check `/nora-mobile/docs/FIGMA_DESIGN_CATALOG.md` for UI references
3. Review Figma designs directly:
   - Lesson Viewer: Node 36:1210
   - Quiz Question: Node 36:1223
   - Quiz Feedback: Node 36:1238

---

**Status:** ✅ Architecture complete and ready for implementation
**Next Step:** Review architecture → Start Phase 0 (Database & Backend)
**Estimated Timeline:** 5-6 weeks for full implementation
