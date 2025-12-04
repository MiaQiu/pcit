# Screen Implementation Guides

Detailed implementation guides for each screen from Figma, with exact specifications and component breakdowns.

**Figma File**: `iHkY0DURZnXQiYwmheSKdo` - Nora

---

## 1. Home Screen (35:787) ✅ IMPLEMENTED

**Screenshot**: See Figma or downloaded screenshots
**Status**: Implemented
**File**: `/src/screens/HomeScreen.tsx`

### Layout Structure
```
SafeAreaView (full screen)
└── ScrollView
    ├── StreakWidget (optional, commented out)
    └── LessonCard (multiple)
        ├── Ellipse decorations
        ├── Dragon image
        ├── Phase badge
        ├── Content (title, subtitle, description)
        └── CTA Button
```

### Components Used
- `LessonCard` (35:791) - Main lesson card component
- `StreakWidget` (35:838) - Weekly streak tracker (partially implemented)
- `TabNavigator` (90:3525) - Bottom navigation tabs
- `Card` - Container with rounded corners and background
- `Badge` - Phase label display
- `Button` - CTA button

### Design Specs
- Screen padding: 24px horizontal
- Card spacing: 8px vertical gap
- Card dimensions: 382x679px (adjusted to 90% width, 660px height)
- Background: White (#FFFFFF)

---

## 2. Home with Completed Lesson (35:835) 🔄 READY

**Screenshot**: Downloaded
**Status**: Ready for implementation
**Required Changes**: Enhanced streak widget with completion animation

### Key Differences from Home Screen
1. **Streak Widget Enhanced**
   - Shows 6-day streak completion
   - Orange checkmarks for completed days
   - Dragon avatar on left side
   - Weekly day labels (M, T, W, Th, F, Sa, Su)

2. **Next Card Update**
   - Card title changes to "Record your play session"
   - Subtitle: "Up next"
   - Description emphasizes practice benefits
   - Button text: "Continue →"

### Implementation Steps
1. Update `StreakWidget` component with:
   - Dragon avatar (circular, left side)
   - Weekly progress indicators (7 days)
   - Checkmark icons for completed days
   - "Streak" label
2. Create lesson state management for "completed" status
3. Update card content based on lesson progress

---

## 3. LessonViewer - Reading Mode (36:1210) 🔄 READY

**Screenshot**: Downloaded
**Status**: Ready for implementation
**Priority**: HIGH (Phase 2)

### Layout Structure
```
SafeAreaView
├── Header
│   ├── Close button (X, top-left)
│   └── Progress bar (segmented)
├── Content (ScrollView)
│   ├── Phase badge (purple text, center)
│   ├── Title (headline)
│   ├── Body text
│   └── Dragon image (rounded, centered)
└── Footer
    └── Continue button (purple, full-width)
```

### Design Specifications

**Progress Bar** (Top)
- Position: Below status bar, full width
- Height: ~8px
- Segments: 4 segments (shown in screenshot)
- Active color: #8C49D5 (mainPurple)
- Inactive color: #E0E0E0 (light gray)
- Gap between segments: 4px

**Close Button**
- Position: Top-left, 16px from edge
- Size: 24x24px
- Icon: X (close)
- Color: #1E2939 (textDark)

**Phase Badge**
- Text: "The Power of Praise" (purple, small caps)
- Font: 14px SemiBold
- Color: #8C49D5
- Position: Top of content, centered

**Title**
- Text: "Praise is rocket fuel for good behavior."
- Font: 32px Bold
- Line height: 38px
- Letter spacing: -0.2px
- Color: #1E2939
- Alignment: Center

**Dragon Image**
- Width: ~350px
- Height: ~200px
- Border radius: 24px (rounded corners)
- Margin: 32px vertical
- Position: Center aligned

**Continue Button**
- Position: Bottom, 24px from edges
- Height: 64px
- Width: 382px (full content width)
- Text: "Continue →"
- Background: #8C49D5 (mainPurple)
- Text color: White
- Border radius: 112px (fully rounded)

### Components Needed
1. **ProgressBar Component**
   ```typescript
   interface ProgressBarProps {
     totalSegments: number;
     currentSegment: number;
   }
   ```

2. **LessonContent Component**
   - Handles scrollable lesson text
   - Image placement
   - Phase badge display

3. **CloseButton Component**
   - Simple icon button
   - Navigation back handler

### Implementation Files
- `/src/screens/LessonViewerScreen.tsx` (new)
- `/src/components/ProgressBar.tsx` (new)
- `/src/components/CloseButton.tsx` (new)

---

## 4. LessonViewer - Quiz Mode (36:1223) 🔄 READY

**Screenshot**: Downloaded
**Status**: Ready for implementation
**Priority**: HIGH (Phase 3)

### Layout Structure
```
SafeAreaView
├── Header
│   ├── Close button (X)
│   └── Progress bar (3 segments filled, 1 empty)
├── Content
│   ├── Phase badge ("Just a quick check", purple)
│   ├── Question title (headline)
│   └── Response buttons (3 options)
└── Footer
    ├── Back button (outlined, left)
    └── Continue button (purple, right)
```

### Design Specifications

**Progress Bar**
- 3/4 segments filled (showing quiz progress)
- Same styling as reading mode

**Question Section**
- Badge text: "Just a quick check"
- Question: "Which is a "Super-Praise?""
- Font: 32px Bold
- Alignment: Center

**Response Buttons** (3 states needed)
1. **Default State** (1:596)
   - Height: 64px
   - Width: Full width (382px)
   - Background: White
   - Border: 2px solid #E0E0E0
   - Border radius: 24px
   - Text: 16px Regular, #1E2939
   - Padding: 24px horizontal

2. **Selected State** (1:607)
   - Border: 2px solid #8C49D5 (purple)
   - Background: #F5F0FF (light purple tint)

3. **Correct State** (1:599)
   - Border: 2px solid #00B894 (teal/green)
   - Background: #E8F8F5 (light teal)
   - Checkmark icon on right

**Response Options** (from screenshot):
- "You're so smart!"
- "You're using so many colors in that drawing!"
- "Good job!"

**Footer Buttons**
- **Back Button**: White background, gray border, "← Back" text
- **Continue Button**: Purple background, "Continue →" text
- Gap between: 12px

### Components Needed
1. **ResponseButton Component**
   ```typescript
   interface ResponseButtonProps {
     text: string;
     state: 'default' | 'selected' | 'correct' | 'incorrect';
     onPress: () => void;
   }
   ```

2. **QuizQuestion Component**
   ```typescript
   interface QuizQuestionProps {
     question: string;
     options: string[];
     correctAnswer: string;
     onAnswer: (answer: string) => void;
   }
   ```

### Implementation Files
- `/src/components/ResponseButton.tsx` (new)
- `/src/components/QuizQuestion.tsx` (new)
- Update `/src/screens/LessonViewerScreen.tsx` with quiz mode

---

## 5. LessonViewer - Quiz Feedback (36:1238) 🔄 READY

**Screenshot**: Downloaded
**Status**: Ready for implementation
**Priority**: HIGH (Phase 3)

### Layout Structure
```
SafeAreaView
├── Header (same as quiz mode)
├── Content
│   ├── Question
│   └── Response buttons (one highlighted as correct)
└── Feedback Banner (bottom)
    ├── "Correct!" title (teal)
    ├── Explanation text
    └── Continue button
```

### Design Specifications

**Correct Response Highlight**
- Border: 2px solid #00B894 (teal)
- Background: #E8F8F5 (light teal)
- Checkmark icon: ✓ (right side, teal color)

**Feedback Banner**
- Background: #E8F8F5 (light teal, matches correct state)
- Padding: 24px
- Border radius: 24px 24px 0 0 (top corners only)
- Position: Fixed at bottom, above safe area

**Banner Content**
- Title: "Correct!"
- Font: 20px Bold
- Color: #00B894 (teal)
- Explanation: "It's specific, describes the behaviour, and shows positive attention."
- Explanation font: 16px Regular
- Explanation color: #1E2939

**Continue Button** (in banner)
- Same purple CTA style
- Text: "Continue →"

### Components Needed
1. **FeedbackBanner Component**
   ```typescript
   interface FeedbackBannerProps {
     isCorrect: boolean;
     explanation: string;
     onContinue: () => void;
   }
   ```

### States to Handle
- Correct answer: Green/teal styling
- Incorrect answer: Red styling (#F44336)

---

## 6. Goal Screen (36:1016) 📋 NOT IMPLEMENTED

**Screenshot**: Downloaded
**Status**: Not implemented
**Priority**: MEDIUM (Phase 4)

### Layout Structure
```
SafeAreaView
├── Header
│   ├── Back button
│   └── Title ("Zoey's Goals")
├── Content (ScrollView)
│   ├── Goal card (speech bubble)
│   ├── DO Section
│   │   ├── Praise item (with dragon icon)
│   │   ├── Echo item (with dragon icon)
│   │   └── Narrate item (with dragon icon)
│   ├── DON'T Section
│   │   └── Tag buttons (Command, Question, Criticize)
│   └── Tips text
└── Footer
    └── Record button (purple, with mic icon)
```

### Design Specifications

**Goal Card**
- Speech bubble style
- Dragon avatar (left side, 48x48px circle)
- Text: "Ready for a 5-minute play session with Zoey?"
- Background: White
- Shadow: Light drop shadow
- Border radius: 16px

**DO Section**
- Title: "DO" (bold, 16px)
- Background: White card
- Border radius: 16px
- Padding: 16px

**PEN Skills Items**
Each item has:
- Dragon icon (left, 40x40px circle with light teal background)
- Title: Bold first letter (e.g., "**P**raise")
- Description: Regular text explaining the skill
- Spacing: 16px between items

**DON'T Section**
- Title: "DON'T"
- Tag buttons: Pill-shaped, light pink background
- Tags: "Command", "Question", "Criticize"
- Font: 14px SemiBold

**Record Button**
- Position: Bottom, full width
- Height: 64px
- Background: #1E2939 (dark)
- Text: "Record 🎤"
- Icon: Microphone
- Border radius: 112px

### Components Needed
1. **GoalCard** - Speech bubble container
2. **PENSkillItem** - Individual skill display
3. **TagButton** - Pill-shaped tag/chip
4. **RecordButton** - Special CTA with microphone icon

---

## 7. Report Summary Screen (35:2159) 📋 NOT IMPLEMENTED

**Screenshot**: Downloaded
**Status**: Not implemented
**Priority**: MEDIUM (Phase 6)

### Layout Structure
```
SafeAreaView
├── Header
│   ├── Back button
│   └── Title ("Nov 25 Report")
├── Content (ScrollView)
│   ├── Dragon greeting card
│   ├── Nora Score card
│   │   └── Score bar (70/100)
│   ├── PEN Skills section
│   │   ├── Praise (7/10)
│   │   ├── Echo (6/10)
│   │   └── Narrate (6/10)
│   ├── Goal reminder card
│   ├── Areas to avoid
│   │   ├── Questions (5 dots)
│   │   ├── Commands (4 dots)
│   │   └── Criticisms (4 dots)
│   ├── Dragon tip card
│   ├── Top Moment audio player
│   │   ├── Quote text
│   │   ├── Timestamp
│   │   ├── Waveform visualization
│   │   └── Play button
│   ├── Tips card
│   └── "Read full transcript" link
└── Footer
    └── Goal card ("Tomorrow's Goal: Use 3 Praises")
    └── "Back to Home" button
```

### Design Specifications

**Nora Score Card**
- Title: "Nora Score"
- Subtitle: "Overall"
- Score: Large number (70/100)
- Progress bar: Full width, purple fill
- Background: White card
- Border radius: 16px

**PEN Skills Bars**
- Title: "PEN Skills"
- 3 horizontal bars (Praise, Echo, Narrate)
- Each bar shows: Name, score (X/10), progress bar
- Bar color: Purple (#8C49D5)
- Background: Light gray (#E0E0E0)
- Height: 8px per bar

**Areas to Avoid**
- Dot indicators (5 dots max per metric)
- Filled dots: Dark gray (#1E2939)
- Empty dots: Light gray (#E0E0E0)
- Metrics: Questions, Commands, Criticisms

**Top Moment Player**
- Quote: Large text in quotes
- Timestamp: Small text (e.g., "at 2:16")
- Waveform: Audio visualization bars
- Play button: Triangle icon, centered
- Background: White card
- Border radius: 16px

**Goal Card** (bottom)
- Background: Light purple (#F5F0FF)
- Dragon icon: Centered, 64x64px
- Text: "Tomorrow's Goal: Use 3 Praises"
- Border radius: 16px
- Padding: 24px

### Components Needed
1. **ScoreCard** - Nora score display
2. **SkillProgressBar** - Individual PEN skill bar
3. **DotIndicator** - Dot-based metric display
4. **MomentPlayer** - Audio playback with waveform
5. **TipCard** - Dragon tip display
6. **GoalPreviewCard** - Tomorrow's goal preview

---

## 8. Progress Dashboard (68:992) 📋 NOT IMPLEMENTED

**Screenshot**: Downloaded
**Status**: Not implemented
**Priority**: LOW (Phase 5)

### Layout Structure
```
SafeAreaView
├── Header
│   └── Title ("Progress")
├── Content (ScrollView)
│   ├── Dragon encouragement card
│   ├── Stats cards row
│   │   ├── Lessons completed (13)
│   │   ├── Play sessions recorded (15)
│   │   └── Current Streak (2)
│   ├── "Your Streak" section
│   │   └── Monthly calendar
│   │       ├── Month navigation (← Nov 2025 →)
│   │       └── Calendar grid (7x5)
│   └── Nora Score graph (future feature)
└── Bottom Tab Navigation
```

### Design Specifications

**Dragon Card**
- Dragon avatar: 48x48px circle, left side
- Speech bubble: White background, rounded
- Text: "Look how far you've come! Keep up the amazing work."
- Shadow: Light drop shadow

**Stats Cards**
- 3 cards in a row
- Layout: Horizontal scroll or 3-column grid
- Each card:
  - Large number (bold, 48px)
  - Label text (14px, gray)
  - Background: White
  - Border radius: 16px
  - Padding: 16px
  - Shadow: Subtle

**Monthly Calendar**
- Title: "Your Streak"
- Navigation: ← Nov 2025 →
- Grid: 7 columns (MON-SUN) × 5-6 rows
- Day indicators:
  - Active days: Orange circle (#FF9F43)
  - Inactive days: Light gray circle (#E0E0E0)
  - Current day: Larger circle or special highlight
- Numbers: Centered, 14px
- Spacing: 8px between days

### Components Needed
1. **StatsCard** - Individual statistic display
2. **Calendar** - Monthly calendar view
   - Props: month, year, activeDays[]
3. **CalendarDayCell** - Individual day cell
4. **MonthNavigator** - Month switcher arrows

---

## 🎨 Shared Component Specifications

### ProgressBar Component
```typescript
interface ProgressBarProps {
  totalSegments: number;
  currentSegment: number;
  activeColor?: string;
  inactiveColor?: string;
  height?: number;
  gap?: number;
}
```

**Default Values**:
- height: 8px
- gap: 4px
- activeColor: #8C49D5
- inactiveColor: #E0E0E0

### ResponseButton Component
```typescript
interface ResponseButtonProps {
  text: string;
  state: 'default' | 'selected' | 'correct' | 'incorrect';
  onPress: () => void;
  disabled?: boolean;
}
```

**States Styling**:
- Default: White bg, gray border
- Selected: Light purple bg, purple border
- Correct: Light teal bg, teal border, checkmark icon
- Incorrect: Light red bg, red border, X icon

### CloseButton Component
```typescript
interface CloseButtonProps {
  onPress: () => void;
  color?: string;
  size?: number;
}
```

---

## 📝 Implementation Checklist

### Phase 2: Lesson Viewer (NEXT PRIORITY)
- [ ] Create ProgressBar component
- [ ] Create CloseButton component
- [ ] Create LessonViewerScreen with reading mode
- [ ] Implement lesson navigation (next/previous)
- [ ] Add lesson content rendering
- [ ] Test scroll behavior with long content

### Phase 3: Quiz System
- [ ] Create ResponseButton component with 4 states
- [ ] Create QuizQuestion component
- [ ] Add quiz mode to LessonViewerScreen
- [ ] Create FeedbackBanner component
- [ ] Implement quiz answer validation
- [ ] Add quiz progress tracking
- [ ] Create quiz completion flow

### Phase 4: Goals & Recording
- [ ] Create GoalScreen
- [ ] Build GoalCard speech bubble component
- [ ] Create PENSkillItem component
- [ ] Build TagButton component
- [ ] Implement RecordButton with mic icon
- [ ] Add recording UI and functionality

### Phase 5: Progress Dashboard
- [ ] Create ProgressScreen
- [ ] Build StatsCard component
- [ ] Create Calendar component
- [ ] Implement CalendarDayCell
- [ ] Add month navigation
- [ ] Build Nora Score graph (future)

### Phase 6: Review Reports
- [ ] Create ReportScreen
- [ ] Build ScoreCard component
- [ ] Create SkillProgressBar component
- [ ] Implement DotIndicator component
- [ ] Build MomentPlayer with waveform
- [ ] Create TipCard component
- [ ] Add transcript viewer

---

*Last Updated: December 1, 2025*
*All measurements from Figma file: iHkY0DURZnXQiYwmheSKdo*
