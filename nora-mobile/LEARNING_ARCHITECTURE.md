# Learning System Architecture & Implementation Plan

## Document Overview
This document outlines the complete architecture and implementation plan for Nora's bite-size learning system, including lesson content delivery and quiz functionality.

**Last Updated:** December 1, 2025
**Status:** Design Phase

---

## 1. Content Analysis

### 1.1 PDF Content Structure

Based on the "Bite Size Learning.pdf" analysis, the content follows this structure:

#### **Phase 1: Connect (15 Days)**
- Day 1-8: Core training (methodology, PEN skills, Don't skills)
- Day 9-15: Skill deep dives (Praise, Echo, Narrate details)
- Booster Package: Additional training for struggling parents

#### **Phase 2: Discipline (26 Days)**
- Day 1-9: Foundation (commands, compliance cycle)
- Day 10-17: Time-Out implementation
- Day 18-26: Advanced strategies and maintenance

#### **Content Components Per Lesson:**
- **Core Content**: Main teaching content (3-5 paragraphs)
- **Examples**: Sample scripts and scenarios
- **Practice Tips**: Actionable guidance
- **Daily Quiz**: 1 multiple choice question with 4 options
- **Key Concepts**: Highlighted important ideas

---

## 2. Data Model Design

### 2.1 Database Schema

```prisma
// Add to schema.prisma

model Lesson {
  id                String              @id @default(cuid())
  phase             LessonPhase         // Connect or Discipline
  phaseNumber       Int                 // 1 or 2
  dayNumber         Int                 // 1-41 (15 Connect + 26 Discipline)
  title             String
  subtitle          String?
  shortDescription  String              // For lesson cards

  // Content structure
  objectives        String[]            // Array of learning objectives
  coreContent       LessonSegment[]     // Relationship to segments

  // Metadata
  estimatedMinutes  Int                 @default(2)
  isBooster         Boolean             @default(false) // True for booster content
  prerequisites     String[]            // IDs of lessons that must be completed first

  // Asset references
  dragonImageUrl    String?
  backgroundColor   String              @default("#E4E4FF")
  ellipse77Color    String              @default("#9BD4DF")
  ellipse78Color    String              @default("#A6E0CB")

  // Relationships
  quiz              Quiz?
  userProgress      UserLessonProgress[]

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@unique([phaseNumber, dayNumber])
  @@index([phase, dayNumber])
}

model LessonSegment {
  id              String          @id @default(cuid())
  lessonId        String
  lesson          Lesson          @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  order           Int             // Segment order within lesson (1-4)
  sectionTitle    String?         // Optional section header
  contentType     ContentType     // TEXT, EXAMPLE, TIP, etc.
  bodyText        String          @db.Text

  // Optional multimedia
  imageUrl        String?
  iconType        String?         // For emoji/icon display

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([lessonId, order])
  @@index([lessonId])
}

model Quiz {
  id              String          @id @default(cuid())
  lessonId        String          @unique
  lesson          Lesson          @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  question        String          @db.Text
  options         QuizOption[]
  correctAnswer   String          // The correct option ID
  explanation     String          @db.Text // Explanation shown after answering

  // User responses
  responses       QuizResponse[]

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([lessonId])
}

model QuizOption {
  id              String          @id @default(cuid())
  quizId          String
  quiz            Quiz            @relation(fields: [quizId], references: [id], onDelete: Cascade)

  optionLabel     String          // A, B, C, D
  optionText      String          @db.Text
  order           Int             // Display order

  @@unique([quizId, optionLabel])
  @@index([quizId])
}

model UserLessonProgress {
  id              String          @id @default(cuid())
  userId          String
  lessonId        String

  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson          Lesson          @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  // Progress tracking
  status          ProgressStatus  // NOT_STARTED, IN_PROGRESS, COMPLETED
  currentSegment  Int             @default(1) // Which segment they're viewing (1-4)
  totalSegments   Int             @default(4)
  completedAt     DateTime?

  // Time tracking
  startedAt       DateTime        @default(now())
  lastViewedAt    DateTime        @default(now())
  timeSpentSeconds Int            @default(0)

  @@unique([userId, lessonId])
  @@index([userId, status])
  @@index([lessonId])
}

model QuizResponse {
  id              String          @id @default(cuid())
  userId          String
  quizId          String

  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  quiz            Quiz            @relation(fields: [quizId], references: [id], onDelete: Cascade)

  selectedAnswer  String          // The option ID they selected
  isCorrect       Boolean
  attemptNumber   Int             @default(1) // Allow retakes
  respondedAt     DateTime        @default(now())

  @@index([userId, quizId])
  @@index([quizId])
}

// Enums
enum LessonPhase {
  CONNECT
  DISCIPLINE
}

enum ContentType {
  TEXT          // Regular paragraph content
  EXAMPLE       // Sample script/scenario
  TIP           // Practice tip
  SCRIPT        // Sample dialogue
  CALLOUT       // Important highlighted content
}

enum ProgressStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  LOCKED
}
```

### 2.2 TypeScript Types

```typescript
// packages/nora-core/src/types/lesson.ts

export interface Lesson {
  id: string;
  phase: 'CONNECT' | 'DISCIPLINE';
  phaseNumber: number;
  dayNumber: number;
  title: string;
  subtitle?: string;
  shortDescription: string;
  objectives: string[];
  estimatedMinutes: number;
  isBooster: boolean;
  prerequisites: string[];

  // UI assets
  dragonImageUrl?: string;
  backgroundColor: string;
  ellipse77Color: string;
  ellipse78Color: string;

  // Content
  segments: LessonSegment[];
  quiz?: Quiz;

  createdAt: Date;
  updatedAt: Date;
}

export interface LessonSegment {
  id: string;
  lessonId: string;
  order: number;
  sectionTitle?: string;
  contentType: ContentType;
  bodyText: string;
  imageUrl?: string;
  iconType?: string;
}

export interface Quiz {
  id: string;
  lessonId: string;
  question: string;
  options: QuizOption[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizOption {
  id: string;
  optionLabel: string; // 'A', 'B', 'C', 'D'
  optionText: string;
  order: number;
}

export interface UserLessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  status: ProgressStatus;
  currentSegment: number;
  totalSegments: number;
  completedAt?: Date;
  startedAt: Date;
  lastViewedAt: Date;
  timeSpentSeconds: number;
}

export interface QuizResponse {
  id: string;
  userId: string;
  quizId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  attemptNumber: number;
  respondedAt: Date;
}

export type ContentType =
  | 'TEXT'
  | 'EXAMPLE'
  | 'TIP'
  | 'SCRIPT'
  | 'CALLOUT';

export type ProgressStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'LOCKED';

// API Response types
export interface LessonListResponse {
  lessons: LessonCardData[];
  userProgress: Record<string, UserLessonProgress>;
}

export interface LessonCardData {
  id: string;
  phase: string;
  phaseName: string;
  title: string;
  subtitle: string;
  description: string;
  dragonImageUrl?: string;
  backgroundColor: string;
  ellipse77Color: string;
  ellipse78Color: string;
  isLocked: boolean;
  progress?: {
    status: ProgressStatus;
    percentComplete: number;
  };
}

export interface LessonDetailResponse {
  lesson: Lesson;
  progress: UserLessonProgress;
  quiz?: Quiz;
  userQuizResponse?: QuizResponse;
}
```

---

## 3. Backend API Design

### 3.1 LessonService Implementation

```typescript
// packages/nora-core/src/services/lessonService.ts

import { Lesson, LessonListResponse, LessonDetailResponse, UserLessonProgress, QuizResponse } from '../types/lesson';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface LessonServiceConfig {
  baseURL?: string;
  getAuthToken: () => Promise<string | null>;
}

export class LessonService {
  private baseURL: string;
  private getAuthToken: () => Promise<string | null>;

  constructor(config: LessonServiceConfig) {
    this.baseURL = config.baseURL || API_BASE;
    this.getAuthToken = config.getAuthToken;
  }

  /**
   * Get list of all lessons with user progress
   */
  async getLessons(): Promise<LessonListResponse> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithTimeout(`${this.baseURL}/api/lessons`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch lessons: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get detailed lesson content including segments and quiz
   */
  async getLessonDetail(lessonId: string): Promise<LessonDetailResponse> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithTimeout(`${this.baseURL}/api/lessons/${lessonId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch lesson detail: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update user progress for a lesson
   */
  async updateProgress(
    lessonId: string,
    data: {
      currentSegment?: number;
      status?: 'IN_PROGRESS' | 'COMPLETED';
      timeSpentSeconds?: number;
    }
  ): Promise<UserLessonProgress> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithTimeout(
      `${this.baseURL}/api/lessons/${lessonId}/progress`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update progress: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Submit quiz answer
   */
  async submitQuizAnswer(
    quizId: string,
    selectedAnswer: string
  ): Promise<QuizResponse> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithTimeout(
      `${this.baseURL}/api/quizzes/${quizId}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedAnswer }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to submit quiz answer: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get lessons by phase
   */
  async getLessonsByPhase(phase: 'CONNECT' | 'DISCIPLINE'): Promise<Lesson[]> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithTimeout(
      `${this.baseURL}/api/lessons?phase=${phase}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch lessons by phase: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get next recommended lesson for user
   */
  async getNextLesson(): Promise<Lesson | null> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithTimeout(
      `${this.baseURL}/api/lessons/next`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 204) {
      return null; // No next lesson
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch next lesson: ${response.statusText}`);
    }

    return response.json();
  }
}

// Export singleton instance
let lessonServiceInstance: LessonService | null = null;

export const initializeLessonService = (config: LessonServiceConfig): void => {
  lessonServiceInstance = new LessonService(config);
};

export const getLessonService = (): LessonService => {
  if (!lessonServiceInstance) {
    throw new Error('LessonService not initialized. Call initializeLessonService first.');
  }
  return lessonServiceInstance;
};
```

### 3.2 Backend API Endpoints

```
GET    /api/lessons                      // List all lessons with user progress
GET    /api/lessons/:id                  // Get detailed lesson content
GET    /api/lessons/next                 // Get next recommended lesson
GET    /api/lessons?phase=CONNECT        // Filter by phase
PUT    /api/lessons/:id/progress         // Update user progress
POST   /api/quizzes/:id/submit           // Submit quiz answer
GET    /api/user/learning-stats          // Get overall learning statistics
```

---

## 4. Mobile UI Components

### 4.1 Component Architecture

```
src/components/learning/
├── LessonCard.tsx                 // ✅ Already exists
├── LessonSegmentViewer.tsx        // NEW: Display single segment
├── QuizView.tsx                   // NEW: Quiz UI
├── QuizOption.tsx                 // NEW: Single quiz option
├── QuizFeedback.tsx               // NEW: Correct/incorrect feedback
├── ProgressBar.tsx                // ✅ Already exists
└── ContentBlock.tsx               // NEW: Render different content types

src/screens/
├── HomeScreen.tsx                 // ✅ Already exists (lesson list)
├── LessonViewerScreen.tsx         // ✅ Exists - needs enhancement
└── QuizScreen.tsx                 // NEW: Dedicated quiz screen
```

### 4.2 New Component Specifications

#### **QuizView Component**

```typescript
// src/components/learning/QuizView.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Quiz, QuizOption as QuizOptionType } from '@nora/core';
import { QuizOption } from './QuizOption';
import { QuizFeedback } from './QuizFeedback';
import { Button } from '../Button';

interface QuizViewProps {
  quiz: Quiz;
  onSubmit: (selectedAnswer: string) => Promise<{ isCorrect: boolean; explanation: string }>;
  onContinue: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ quiz, onSubmit, onContinue }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; explanation: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedOption) return;

    setIsLoading(true);
    try {
      const result = await onSubmit(selectedOption);
      setFeedback(result);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Quiz Icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🧠</Text>
      </View>

      {/* Question */}
      <Text style={styles.heading}>Daily Quiz</Text>
      <Text style={styles.question}>{quiz.question}</Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {quiz.options.map((option) => (
          <QuizOption
            key={option.id}
            option={option}
            isSelected={selectedOption === option.id}
            isSubmitted={isSubmitted}
            isCorrect={option.id === quiz.correctAnswer}
            onPress={() => !isSubmitted && setSelectedOption(option.id)}
          />
        ))}
      </View>

      {/* Feedback */}
      {feedback && (
        <QuizFeedback
          isCorrect={feedback.isCorrect}
          explanation={feedback.explanation}
        />
      )}

      {/* Action Button */}
      <View style={styles.buttonContainer}>
        {!isSubmitted ? (
          <Button
            onPress={handleSubmit}
            disabled={!selectedOption || isLoading}
            loading={isLoading}
          >
            Check Answer
          </Button>
        ) : (
          <Button onPress={onContinue}>
            Continue →
          </Button>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  heading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8C49D5',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  question: {
    fontSize: 18,
    lineHeight: 26,
    color: '#1E2939',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '600',
  },
  optionsContainer: {
    marginBottom: 24,
  },
  buttonContainer: {
    marginTop: 8,
  },
});
```

#### **QuizOption Component**

```typescript
// src/components/learning/QuizOption.tsx

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { QuizOption as QuizOptionType } from '@nora/core';

interface QuizOptionProps {
  option: QuizOptionType;
  isSelected: boolean;
  isSubmitted: boolean;
  isCorrect: boolean;
  onPress: () => void;
}

export const QuizOption: React.FC<QuizOptionProps> = ({
  option,
  isSelected,
  isSubmitted,
  isCorrect,
  onPress,
}) => {
  // Determine styling based on state
  const getStyles = () => {
    if (isSubmitted) {
      if (isCorrect) {
        return styles.correct;
      }
      if (isSelected && !isCorrect) {
        return styles.incorrect;
      }
    }
    if (isSelected) {
      return styles.selected;
    }
    return styles.default;
  };

  const dynamicStyles = getStyles();

  return (
    <TouchableOpacity
      style={[styles.container, dynamicStyles.container]}
      onPress={onPress}
      disabled={isSubmitted}
      activeOpacity={0.7}
    >
      <View style={[styles.label, dynamicStyles.label]}>
        <Text style={[styles.labelText, dynamicStyles.labelText]}>
          {option.optionLabel}
        </Text>
      </View>
      <Text style={[styles.text, dynamicStyles.text]}>
        {option.optionText}
      </Text>
      {isSubmitted && isCorrect && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  label: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  labelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  text: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  checkmark: {
    fontSize: 20,
    marginLeft: 8,
  },
  default: {
    container: {
      backgroundColor: '#FFFFFF',
      borderColor: '#E0E0E0',
    },
    label: {
      backgroundColor: '#F5F5F5',
    },
    labelText: {
      color: '#666666',
    },
    text: {
      color: '#1E2939',
    },
  },
  selected: {
    container: {
      backgroundColor: '#F5F0FF',
      borderColor: '#8C49D5',
    },
    label: {
      backgroundColor: '#8C49D5',
    },
    labelText: {
      color: '#FFFFFF',
    },
    text: {
      color: '#1E2939',
    },
  },
  correct: {
    container: {
      backgroundColor: '#F0FFF4',
      borderColor: '#48BB78',
    },
    label: {
      backgroundColor: '#48BB78',
    },
    labelText: {
      color: '#FFFFFF',
    },
    text: {
      color: '#1E2939',
    },
  },
  incorrect: {
    container: {
      backgroundColor: '#FFF5F5',
      borderColor: '#F56565',
    },
    label: {
      backgroundColor: '#F56565',
    },
    labelText: {
      color: '#FFFFFF',
    },
    text: {
      color: '#1E2939',
    },
  },
});
```

---

## 5. Implementation Phases

### **Phase 0: Foundation (Week 1)**
**Goal:** Set up database schema and backend API structure

**Tasks:**
1. ✅ Add database schema to `schema.prisma`
2. ✅ Run Prisma migrations
3. ✅ Create backend API routes structure
4. ✅ Seed database with Phase 1 lessons (Days 1-8)

**Deliverables:**
- Database schema deployed
- API endpoints scaffolded
- Test data seeded

---

### **Phase 1: Core Lesson Viewer Enhancement (Week 2)**
**Goal:** Enhance existing lesson viewer to support multi-segment content

**Tasks:**
1. ✅ Update `LessonService` in @nora/core
2. ✅ Create `LessonSegmentViewer` component
3. ✅ Enhance `LessonViewerScreen` to handle segments
4. ✅ Implement segment navigation (Continue → next segment)
5. ✅ Add time tracking for progress analytics

**Deliverables:**
- Users can view multi-segment lessons
- Progress auto-saves per segment
- Smooth navigation between segments

---

### **Phase 2: Quiz Implementation (Week 3)**
**Goal:** Build quiz functionality for daily quizzes

**Tasks:**
1. ✅ Create `QuizView`, `QuizOption`, `QuizFeedback` components
2. ✅ Create `QuizScreen` for full-screen quiz experience
3. ✅ Implement quiz submission logic
4. ✅ Show immediate feedback (correct/incorrect)
5. ✅ Track quiz responses in database

**Deliverables:**
- Users can answer quiz questions
- Immediate feedback with explanations
- Quiz completion tracked

---

### **Phase 3: Home Screen Integration (Week 4)**
**Goal:** Connect lesson list to real API data

**Tasks:**
1. ✅ Update `HomeScreen` to use `LessonService`
2. ✅ Show real user progress on lesson cards
3. ✅ Implement lesson locking logic (prerequisites)
4. ✅ Add loading and error states
5. ✅ Implement "next lesson" recommendation

**Deliverables:**
- Real lesson data displayed
- Progress indicators on cards
- Locked/unlocked lessons based on completion

---

### **Phase 4: Content Population (Week 5)**
**Goal:** Seed all lesson content from PDF

**Tasks:**
1. ✅ Extract and format all Phase 1 content (15 days)
2. ✅ Extract and format all Phase 2 content (26 days)
3. ✅ Extract and format booster content
4. ✅ Create all quiz questions (41 quizzes)
5. ✅ Run data seeding scripts

**Deliverables:**
- Complete content database
- All 41 lessons available
- All quizzes functional

---

### **Phase 5: Advanced Features (Week 6)**
**Goal:** Add polish and advanced learning features

**Tasks:**
1. ✅ Lesson bookmarking
2. ✅ Content search functionality
3. ✅ Learning analytics dashboard
4. ✅ Streak integration with lessons
5. ✅ Push notifications for daily lessons

**Deliverables:**
- Enhanced user experience
- Analytics tracking
- Engagement features

---

## 6. Figma Design Integration

### 6.1 Lesson Content Screen (Existing)
**Figma Reference:** 36:1210
**Status:** ✅ Implemented in `LessonViewerScreen.tsx`

**Features:**
- Segmented progress bar
- Close button (X)
- Phase badge
- Title (32px, bold)
- Body text (16px, line-height 24px)
- Dragon illustration
- Continue button (fixed footer)

### 6.2 Quiz Question Screen
**Figma Reference:** 36:1223
**Status:** ✅ Design reviewed and documented

**UI Elements from Figma:**
1. **Progress Bar** (top)
   - 4 segments (3 filled purple, 1 gray)
   - Same as lesson viewer (consistent state)
   - 8px height, 4px gap between segments

2. **Close Button** (top-left)
   - X icon, 24x24px
   - Color: #1E2939 (textDark)
   - Positioned 16px from edges

3. **Header Badge**
   - Text: "Just a quick check"
   - Font: PlusJakartaSans_600SemiBold, 14px
   - Color: #8C49D5 (mainPurple)
   - Centered, letter-spacing: 1px

4. **Question Title**
   - Font: PlusJakartaSans_700Bold, 32px
   - Color: #1E2939 (textDark)
   - Line height: 38px
   - Letter spacing: -0.2px
   - Centered
   - Example: "Which is a "Super-Praise?""

5. **Response Buttons** (3 options shown in design)
   - Height: 64px, full width
   - Border radius: 32px (fully rounded)
   - Padding: 24px horizontal
   - Font: PlusJakartaSans_400Regular, 16px
   - **Default State:**
     - Background: White (#FFFFFF)
     - Border: 2px solid #E0E0E0
     - Text: #1E2939
   - **Selected State:**
     - Background: #F5F0FF (light purple tint)
     - Border: 2px solid #8C49D5
     - Text: #1E2939
   - Vertical spacing: 16px between buttons
   - Text aligned left

6. **Navigation Buttons** (bottom)
   - **Back Button** (left):
     - Background: White
     - Border: 2px solid #E0E0E0
     - Text: "← Back"
     - Width: ~40% of screen
   - **Continue Button** (right):
     - Background: #8C49D5 (mainPurple)
     - Text: "Continue →"
     - Width: ~55% of screen
     - Disabled until option selected
   - Height: 64px
   - Border radius: 112px
   - Gap: 12px between buttons

### 6.3 Quiz Feedback Screen
**Figma Reference:** 36:1238
**Status:** ✅ Design reviewed and documented

**UI Elements from Figma:**
1. **Progress Bar** (top)
   - Same as quiz question screen
   - Shows consistent progress state

2. **Close Button** (top-left)
   - Same as quiz question screen

3. **Header Badge**
   - Same as quiz question: "Just a quick check"

4. **Question Title**
   - Same as quiz question screen

5. **Response Buttons with Feedback**
   - Same layout as quiz question
   - **Correct Answer State:**
     - Background: #E8F8F5 (light teal)
     - Border: 2px solid #00B894 (teal)
     - Text: #1E2939
     - Checkmark icon (✓) on right side, teal color
   - **Incorrect Selected State** (if user got it wrong):
     - Background: #FFEBEE (light red)
     - Border: 2px solid #F44336 (red)
     - Text: #1E2939
     - X mark icon on right side, red color
   - Other options remain in default state

6. **Feedback Banner** (bottom, slides up)
   - **Correct State:**
     - Background: #E8F8F5 (light teal)
     - Border radius: 24px 24px 0 0 (rounded top corners)
     - Padding: 24px
     - **Title**: "Correct!"
       - Font: PlusJakartaSans_700Bold, 20px
       - Color: #00B894 (teal)
     - **Explanation Text**:
       - Font: PlusJakartaSans_400Regular, 16px
       - Color: #1E2939
       - Line height: 22px
       - Example: "It's specific, describes the behaviour, and shows positive attention."
   - **Incorrect State** (would be similar but red-themed):
     - Background: #FFEBEE (light red)
     - Title: "Not quite right"
     - Title color: #F44336 (red)

7. **Navigation Buttons** (inside feedback banner)
   - **Back Button**: Same style as quiz question
   - **Continue Button**: Same style, now enabled

---

## 7. API Integration Examples

### 7.1 Fetching Lessons

```typescript
// In HomeScreen.tsx

import { getLessonService } from '@nora/core';

const HomeScreen = () => {
  const [lessons, setLessons] = useState<LessonCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const lessonService = getLessonService();
        const response = await lessonService.getLessons();
        setLessons(response.lessons);
      } catch (error) {
        console.error('Failed to load lessons:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, []);

  // Render lessons...
};
```

### 7.2 Viewing Lesson Detail

```typescript
// In LessonViewerScreen.tsx

const LessonViewerScreen = ({ route }) => {
  const { lessonId } = route.params;
  const [lessonDetail, setLessonDetail] = useState<LessonDetailResponse | null>(null);

  useEffect(() => {
    const fetchLesson = async () => {
      const lessonService = getLessonService();
      const detail = await lessonService.getLessonDetail(lessonId);
      setLessonDetail(detail);
    };

    fetchLesson();
  }, [lessonId]);

  // Render lesson content...
};
```

### 7.3 Submitting Quiz Answer

```typescript
// In QuizView.tsx

const handleSubmit = async (selectedAnswer: string) => {
  const lessonService = getLessonService();
  const response = await lessonService.submitQuizAnswer(quiz.id, selectedAnswer);

  return {
    isCorrect: response.isCorrect,
    explanation: quiz.explanation,
  };
};
```

---

## 8. Success Metrics

### 8.1 Technical Metrics
- ✅ All API endpoints respond within 500ms
- ✅ Lesson content loads in < 1 second
- ✅ Quiz submission processes in < 200ms
- ✅ 99.9% uptime for learning service

### 8.2 User Experience Metrics
- ✅ 80%+ lesson completion rate
- ✅ Average 2 minutes per lesson
- ✅ 70%+ quiz pass rate (first attempt)
- ✅ Daily engagement (1+ lesson/day)

### 8.3 Content Quality Metrics
- ✅ All 41 lessons seeded correctly
- ✅ All quizzes have correct answers validated
- ✅ Content matches PDF source (100%)

---

## 9. Next Steps

### Immediate (This Week)
1. ✅ Review and approve this architecture document
2. ✅ Add database schema to `schema.prisma`
3. ✅ Create backend API route stubs
4. ✅ Initialize `LessonService` in @nora/core

### Short-term (Next 2 Weeks)
1. ✅ Implement Phase 1 (Lesson Viewer Enhancement)
2. ✅ Implement Phase 2 (Quiz Implementation)
3. ✅ Get Figma design for quiz screen

### Long-term (Next 4-6 Weeks)
1. ✅ Complete all implementation phases
2. ✅ Seed all content
3. ✅ User testing and refinement
4. ✅ Launch to production

---

## 10. Questions & Decisions Needed

### Architecture Questions
- ✅ **Decided:** Use multi-segment approach (4 segments per lesson)
- ✅ **Decided:** Store content in database (not external CMS)
- ⚠️ **Pending:** Should quizzes be retakeable? (Recommend: Yes, unlimited attempts)
- ⚠️ **Pending:** Should we track time-to-completion per segment?

### Design Questions
- ⚠️ **Pending:** Need Figma design for quiz screen
- ⚠️ **Pending:** Design for "lesson complete" celebration screen?
- ⚠️ **Pending:** How to display booster content differently from main lessons?

### Content Questions
- ✅ **Decided:** Use PDF as source of truth
- ⚠️ **Pending:** Who will review final lesson content before seeding?
- ⚠️ **Pending:** How often should content be updated?

---

**Document End**
