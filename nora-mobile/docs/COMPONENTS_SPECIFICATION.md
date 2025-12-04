# Components Specification

Detailed specifications for all reusable components extracted from Figma.

**Figma File**: `iHkY0DURZnXQiYwmheSKdo` - Nora

---

## ✅ Implemented Components

### 1. Card Component
**File**: `/src/components/Card.tsx`
**Figma Node**: N/A (custom wrapper)
**Status**: ✅ Implemented

```typescript
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'pressable';
  backgroundColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
}
```

**Specifications**:
- Border radius: 24px
- Overflow: 'hidden'
- Default background: #E4E4FF
- Supports pressable variant with onPress handler
- Active opacity: 0.8 (when pressable)

---

### 2. Badge Component
**File**: `/src/components/Badge.tsx`
**Figma Node**: Part of lesson card (35:794)
**Status**: ✅ Implemented

```typescript
interface BadgeProps {
  label: string;
  subtitle: string;
  variant?: 'default' | 'compact';
}
```

**Specifications**:
- Background: White (#FFFFFF)
- Border radius: 100px (fully rounded)
- Padding: 8px vertical, 16px horizontal
- **Label**:
  - Font: PlusJakartaSans_700Bold
  - Size: 10px
  - Line height: 13px
  - Letter spacing: -0.1px
  - Color: #8C49D5 (mainPurple)
- **Subtitle**:
  - Font: PlusJakartaSans_600SemiBold
  - Size: 14px
  - Line height: 18px
  - Letter spacing: -0.1px
  - Color: #1E2939 (textDark)
  - Margin top: 2px

---

### 3. Button Component (CTA)
**File**: `/src/components/Button.tsx`
**Figma Node**: 1:584
**Status**: ✅ Implemented

```typescript
interface ButtonProps {
  children: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outlined';
  disabled?: boolean;
  style?: ViewStyle;
}
```

**Specifications**:
- Height: 64px
- Width: Full width (382px content width)
- Border radius: 112px (fully rounded)
- **Primary (default)**:
  - Background: #8C49D5 (mainPurple)
  - Text color: White
  - Font: PlusJakartaSans_700Bold
  - Size: 16px
- **Disabled state**:
  - Background: #CCCCCC
  - Text color: #666666
  - Opacity: 0.6

---

### 4. LessonCard Component
**File**: `/src/components/LessonCard.tsx`
**Figma Node**: 35:791
**Status**: ✅ Implemented

```typescript
interface LessonCardProps {
  id: string;
  phase: string;
  phaseName: string;
  title: string;
  subtitle: string;
  description: string;
  dragonImageUrl: ImageSourcePropType;
  backgroundColor: string;
  ellipseColor?: string;
  isLocked?: boolean;
  onPress?: () => void;
}
```

**Specifications**:
- Card: 382x679px (adjusted to 90% width, 660px height)
- **Ellipses** (decorative backgrounds):
  - Ellipse 78: position absolute, left: -45, top: -88, size: 473x259
  - Ellipse 77: position absolute, left: -45, top: 153, size: 473x175
- **Dragon image**:
  - Position: absolute, left: 0, top: 42
  - Size: 350x223px
  - Resize mode: contain
- **Badge**:
  - Position: absolute, top: 302, centered
- **Content**:
  - Position: absolute, top: 383
  - Padding: 24px horizontal
  - Gap: 16px
  - **Subtitle**: 16px Bold, #1E2939
  - **Title**: 32px Bold, #1E2939, line height 38px
  - **Description**: 16px Regular, #1E2939, line height 22px
- **Button**:
  - Position: absolute, bottom: 15
  - Width: 300px
  - Left: 24px

---

### 5. TabNavigator Component
**File**: `/src/navigation/TabNavigator.tsx`
**Figma Node**: 90:3525
**Status**: ✅ Implemented

**Tabs**:
1. Home (house icon)
2. Record (microphone icon)
3. Learn (book icon)
4. Progress (chart icon)

**Specifications**:
- Height: 74px
- Background: White
- Active color: #8C49D5 (mainPurple)
- Inactive color: #9CA3AF (gray)
- Icon size: 24x24px
- Label font: 10px SemiBold
- Border top: 1px solid #E5E7EB

---

## 🔄 Ready for Implementation

### 6. ProgressBar Component
**Figma Node**: 1:644
**Status**: 🔄 Ready for implementation
**Priority**: HIGH (needed for LessonViewer)

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

**Specifications**:
- **Container**:
  - Width: Full width
  - Height: 8px (default)
  - Flex direction: row
  - Gap: 4px between segments
- **Segment**:
  - Flex: 1 (equal width distribution)
  - Height: 8px
  - Border radius: 4px
  - Active color: #8C49D5 (mainPurple)
  - Inactive color: #E0E0E0 (light gray)
- **Animation** (optional):
  - Smooth transition between segments
  - Duration: 300ms

**Example Usage**:
```jsx
<ProgressBar
  totalSegments={4}
  currentSegment={2}
/>
```

---

### 7. ResponseButton Component
**Figma Node**: 1:595 (with states: 1:596, 1:607, 1:599)
**Status**: 🔄 Ready for implementation
**Priority**: HIGH (needed for Quiz)

```typescript
interface ResponseButtonProps {
  text: string;
  state: 'default' | 'selected' | 'correct' | 'incorrect';
  onPress: () => void;
  disabled?: boolean;
  showIcon?: boolean;
}
```

**Specifications**:

**Common**:
- Height: 64px
- Width: Full width (382px)
- Border radius: 24px
- Padding: 24px horizontal
- Font: PlusJakartaSans_400Regular
- Size: 16px
- Text align: Left

**State: Default** (1:596)
- Background: White (#FFFFFF)
- Border: 2px solid #E0E0E0
- Text color: #1E2939

**State: Selected** (1:607)
- Background: #F5F0FF (light purple)
- Border: 2px solid #8C49D5 (mainPurple)
- Text color: #1E2939

**State: Correct** (1:599)
- Background: #E8F8F5 (light teal)
- Border: 2px solid #00B894 (teal)
- Text color: #1E2939
- Icon: ✓ (checkmark, right side, teal)

**State: Incorrect**
- Background: #FFEBEE (light red)
- Border: 2px solid #F44336 (red)
- Text color: #1E2939
- Icon: ✕ (X mark, right side, red)

**Layout**:
```
┌─────────────────────────────────┐
│ Response text           [icon]  │
└─────────────────────────────────┘
```

---

### 8. CloseButton Component
**Figma Node**: 1:613 (close icon)
**Status**: 🔄 Ready for implementation
**Priority**: HIGH (needed for LessonViewer)

```typescript
interface CloseButtonProps {
  onPress: () => void;
  color?: string;
  size?: number;
  style?: ViewStyle;
}
```

**Specifications**:
- Size: 24x24px (default)
- Icon: X (close mark)
- Color: #1E2939 (textDark, default)
- Background: Transparent
- Touchable area: 44x44px (iOS guideline)
- Position: Usually top-left, 16px from edges

---

### 9. FeedbackBanner Component
**Figma Node**: Custom (appears in 36:1238)
**Status**: 🔄 Ready for implementation
**Priority**: HIGH (needed for Quiz feedback)

```typescript
interface FeedbackBannerProps {
  isCorrect: boolean;
  explanation: string;
  onContinue: () => void;
}
```

**Specifications**:

**Correct State**:
- Background: #E8F8F5 (light teal)
- Border radius: 24px 24px 0 0 (top corners only)
- Padding: 24px
- **Title**: "Correct!"
  - Font: PlusJakartaSans_700Bold
  - Size: 20px
  - Color: #00B894 (teal)
- **Explanation**:
  - Font: PlusJakartaSans_400Regular
  - Size: 16px
  - Color: #1E2939
  - Line height: 22px
  - Margin top: 8px
- **Button**: Standard purple CTA

**Incorrect State**:
- Background: #FFEBEE (light red)
- Title: "Not quite right"
- Title color: #F44336 (red)
- Rest same as correct state

**Position**:
- Fixed at bottom of screen
- Above safe area inset
- Full width
- Animation: Slide up from bottom

---

## 📋 Not Yet Implemented

### 10. StreakWidget Component
**Figma Node**: 35:838
**Status**: 🔄 Partial implementation
**Priority**: MEDIUM

```typescript
interface StreakWidgetProps {
  streak: number;
  completedDays: boolean[]; // 7 days
  dragonImageUrl: ImageSourcePropType;
}
```

**Specifications**:
- **Container**:
  - Width: Full width (382px)
  - Height: ~100px
  - Background: White
  - Border radius: 16px
  - Padding: 16px
  - Shadow: Light drop shadow

- **Layout**:
  ```
  ┌──────────────────────────────┐
  │ [Dragon]  Streak             │
  │           M T W Th F Sa Su   │
  │           ✓ ✓ ✓ ✓  ✓ ✓  ○   │
  └──────────────────────────────┘
  ```

- **Dragon Avatar**:
  - Size: 48x48px
  - Border radius: 24px (circular)
  - Position: Left side

- **Streak Label**:
  - Font: PlusJakartaSans_600SemiBold
  - Size: 14px
  - Color: #1E2939

- **Day Labels**:
  - Font: PlusJakartaSans_600SemiBold
  - Size: 10px
  - Color: #9CA3AF (gray)
  - Layout: Horizontal row

- **Checkmarks**:
  - Completed: Orange circle (#FF9F43) with white checkmark
  - Incomplete: Light gray circle (#E0E0E0)
  - Size: 24x24px

---

### 11. GoalCard Component
**Figma Node**: Custom (appears in 36:1016)
**Status**: 📋 Not implemented
**Priority**: MEDIUM

```typescript
interface GoalCardProps {
  message: string;
  dragonImageUrl: ImageSourcePropType;
}
```

**Specifications**:
- **Container**: Speech bubble style
  - Background: White
  - Border radius: 16px
  - Padding: 16px
  - Shadow: Light drop shadow
  - Tail: Pointing to dragon (left side)

- **Dragon Avatar**:
  - Size: 48x48px
  - Border radius: 24px
  - Position: Left side, outside card

- **Message**:
  - Font: PlusJakartaSans_400Regular
  - Size: 16px
  - Line height: 22px
  - Color: #1E2939

---

### 12. PENSkillItem Component
**Figma Node**: Part of goal screen (36:1016)
**Status**: 📋 Not implemented
**Priority**: MEDIUM

```typescript
interface PENSkillItemProps {
  skill: 'Praise' | 'Echo' | 'Narrate';
  description: string;
  iconUrl?: ImageSourcePropType;
}
```

**Specifications**:
- **Container**:
  - Flex direction: row
  - Padding: 12px
  - Gap: 12px
  - Background: Transparent

- **Icon Container**:
  - Size: 40x40px
  - Border radius: 20px (circular)
  - Background: #E8F8F5 (light teal)
  - Center aligned

- **Dragon Icon**:
  - Size: 24x24px
  - Centered in container

- **Content**:
  - **Title**: Bold first letter + regular rest
    - Font: PlusJakartaSans_700Bold (first letter)
    - Size: 16px
    - Color: #1E2939
  - **Description**:
    - Font: PlusJakartaSans_400Regular
    - Size: 14px
    - Line height: 20px
    - Color: #6B7280 (gray)

---

### 13. TagButton Component
**Figma Node**: Custom (appears in goal screen)
**Status**: 📋 Not implemented
**Priority**: LOW

```typescript
interface TagButtonProps {
  label: string;
  variant?: 'default' | 'danger';
  onPress?: () => void;
}
```

**Specifications**:
- **Container**:
  - Height: 32px
  - Padding: 8px horizontal, 6px vertical
  - Border radius: 16px (pill shape)
  - Background: #FFEBEE (light pink, for "don't" tags)

- **Text**:
  - Font: PlusJakartaSans_600SemiBold
  - Size: 14px
  - Color: #F44336 (red)

- **Layout**: Horizontal row, 8px gap between tags

---

### 14. ScoreCard Component
**Figma Node**: 35:2171
**Status**: 📋 Not implemented
**Priority**: MEDIUM

```typescript
interface ScoreCardProps {
  title: string;
  subtitle?: string;
  score: number;
  maxScore: number;
  color?: string;
}
```

**Specifications**:
- **Container**:
  - Background: White
  - Border radius: 16px
  - Padding: 20px
  - Shadow: Light drop shadow

- **Title**:
  - Font: PlusJakartaSans_700Bold
  - Size: 16px
  - Color: #1E2939

- **Score Display**:
  - Font: PlusJakartaSans_700Bold
  - Size: 48px
  - Color: #8C49D5 (mainPurple)
  - Format: "70/100"

- **Progress Bar**:
  - Width: Full width
  - Height: 8px
  - Border radius: 4px
  - Background: #E0E0E0
  - Fill color: #8C49D5
  - Fill percentage: (score / maxScore) * 100

---

### 15. SkillProgressBar Component
**Figma Node**: 71:2460
**Status**: 📋 Not implemented
**Priority**: MEDIUM

```typescript
interface SkillProgressBarProps {
  skillName: string;
  score: number;
  maxScore: number;
  color?: string;
}
```

**Specifications**:
- **Container**:
  - Margin: 12px vertical
  - Gap: 8px

- **Header Row**:
  - **Skill Name**:
    - Font: PlusJakartaSans_600SemiBold
    - Size: 14px
    - Color: #1E2939
  - **Score**:
    - Font: PlusJakartaSans_700Bold
    - Size: 14px
    - Color: #8C49D5
    - Position: Right aligned

- **Progress Bar**:
  - Width: Full width
  - Height: 8px
  - Border radius: 4px
  - Background: #E0E0E0
  - Fill color: #8C49D5 (mainPurple)
  - Smooth animation when value changes

---

### 16. DotIndicator Component
**Figma Node**: Custom (appears in report)
**Status**: 📋 Not implemented
**Priority**: LOW

```typescript
interface DotIndicatorProps {
  label: string;
  count: number;
  maxCount?: number;
}
```

**Specifications**:
- **Container**:
  - Flex direction: row
  - Justify: space-between
  - Margin: 8px vertical

- **Label**:
  - Font: PlusJakartaSans_400Regular
  - Size: 14px
  - Color: #1E2939

- **Dots Row**:
  - Flex direction: row
  - Gap: 4px
  - **Filled Dot**:
    - Size: 12x12px
    - Border radius: 6px (circular)
    - Background: #1E2939 (dark)
  - **Empty Dot**:
    - Size: 12x12px
    - Border radius: 6px
    - Background: #E0E0E0 (light gray)

- **Count Display**:
  - Font: PlusJakartaSans_700Bold
  - Size: 14px
  - Color: #1E2939
  - Position: Right of dots

---

### 17. MomentPlayer Component
**Figma Node**: 35:2219
**Status**: 📋 Not implemented
**Priority**: MEDIUM

```typescript
interface MomentPlayerProps {
  quote: string;
  timestamp: string;
  audioUrl: string;
  waveformData?: number[];
}
```

**Specifications**:
- **Container**:
  - Background: White
  - Border radius: 16px
  - Padding: 20px
  - Shadow: Light drop shadow

- **Title**: "Top Moment"
  - Font: PlusJakartaSans_700Bold
  - Size: 16px
  - Color: #1E2939
  - Margin bottom: 12px

- **Quote**:
  - Font: PlusJakartaSans_400Regular
  - Size: 18px
  - Line height: 26px
  - Color: #1E2939
  - Format: "Quote text"
  - Margin bottom: 8px

- **Timestamp**:
  - Font: PlusJakartaSans_400Regular
  - Size: 12px
  - Color: #9CA3AF (gray)
  - Format: "at X:XX"

- **Waveform**:
  - Height: 60px
  - Bar width: 3px
  - Gap: 2px
  - Color: #8C49D5 (mainPurple)
  - Active/played bars: Full opacity
  - Inactive bars: 30% opacity

- **Play Button**:
  - Size: 48x48px
  - Border radius: 24px (circular)
  - Background: #8C49D5
  - Icon: Triangle (play), white
  - Centered over waveform

---

### 18. Calendar Component
**Figma Node**: 68:1013
**Status**: 📋 Not implemented
**Priority**: LOW

```typescript
interface CalendarProps {
  month: number;
  year: number;
  activeDays: number[];
  onDayPress?: (day: number) => void;
  onMonthChange?: (month: number, year: number) => void;
}
```

**Specifications**:
- **Container**:
  - Background: White
  - Border radius: 16px
  - Padding: 16px
  - Shadow: Light drop shadow

- **Month Navigator**:
  - **Title**: "Nov 2025"
    - Font: PlusJakartaSans_700Bold
    - Size: 16px
    - Color: #1E2939
  - **Arrows**: ← and →
    - Size: 24x24px
    - Color: #6B7280
    - Position: Left and right of title

- **Day Headers**:
  - Labels: MON, TUE, WED, THU, FRI, SAT, SUN
  - Font: PlusJakartaSans_600SemiBold
  - Size: 10px
  - Color: #9CA3AF
  - Letter spacing: 0.5px

- **Day Cells**:
  - Size: 40x40px
  - **Active Day**:
    - Background: #FF9F43 (orange circle)
    - Number color: White
  - **Inactive Day**:
    - Background: #E0E0E0 (light gray circle)
    - Number color: #9CA3AF
  - **Number**:
    - Font: PlusJakartaSans_600SemiBold
    - Size: 14px
    - Centered

- **Grid**:
  - 7 columns × 5-6 rows
  - Gap: 8px between cells

---

### 19. StatsCard Component
**Figma Node**: 68:1002
**Status**: 📋 Not implemented
**Priority**: MEDIUM

```typescript
interface StatsCardProps {
  value: number;
  label: string;
  icon?: React.ReactNode;
}
```

**Specifications**:
- **Container**:
  - Background: White
  - Border radius: 16px
  - Padding: 16px
  - Shadow: Light drop shadow
  - Min width: 100px

- **Value**:
  - Font: PlusJakartaSans_700Bold
  - Size: 48px
  - Line height: 56px
  - Color: #1E2939
  - Text align: Center

- **Label**:
  - Font: PlusJakartaSans_400Regular
  - Size: 14px
  - Color: #6B7280 (gray)
  - Text align: Center
  - Margin top: 4px

- **Icon** (optional):
  - Size: 24x24px
  - Position: Top of card
  - Color: #8C49D5

---

### 20. TipCard Component
**Figma Node**: 35:2254
**Status**: 📋 Not implemented
**Priority**: LOW

```typescript
interface TipCardProps {
  tip: string;
  dragonImageUrl?: ImageSourcePropType;
}
```

**Specifications**:
- **Container**:
  - Background: White
  - Border radius: 16px
  - Padding: 16px
  - Shadow: Light drop shadow

- **Title**: "Tips for next time"
  - Font: PlusJakartaSans_700Bold
  - Size: 16px
  - Color: #1E2939
  - Margin bottom: 12px

- **Dragon Icon** (optional):
  - Size: 32x32px
  - Border radius: 16px
  - Position: Left of text

- **Tip Text**:
  - Font: PlusJakartaSans_400Regular
  - Size: 14px
  - Line height: 20px
  - Color: #1E2939

---

## 🎨 Icon Library (24x24px)

**Figma Node**: 1:612

All icons are 24x24px with 2px stroke:

1. **close** (1:613) - X mark
2. **arrow-back** (1:615) - Left arrow
3. **Check** (1:619) - Checkmark ✓
4. **Record** (1:628) - Microphone icon
5. **home** - House icon (tab nav)
6. **learn** - Book icon (tab nav)
7. **progress** - Chart icon (tab nav)
8. **arrow-forward** - Right arrow →
9. **play** - Triangle play button
10. **pause** - Pause bars

**Colors**:
- Active: #8C49D5 (mainPurple)
- Inactive: #9CA3AF (gray)
- Dark: #1E2939 (textDark)

---

## 📊 Component Priority Matrix

### HIGH Priority (Phase 2-3)
1. ProgressBar - Needed for LessonViewer
2. ResponseButton - Needed for Quiz
3. CloseButton - Needed for LessonViewer
4. FeedbackBanner - Needed for Quiz

### MEDIUM Priority (Phase 4-6)
5. StreakWidget - Enhance home screen
6. GoalCard - Goals feature
7. PENSkillItem - Goals feature
8. ScoreCard - Reports feature
9. SkillProgressBar - Reports feature
10. MomentPlayer - Reports feature
11. StatsCard - Progress feature

### LOW Priority (Phase 5+)
12. TagButton - Goals feature
13. DotIndicator - Reports feature
14. Calendar - Progress feature
15. TipCard - Reports feature

---

*Last Updated: December 1, 2025*
*All specifications from Figma file: iHkY0DURZnXQiYwmheSKdo*
