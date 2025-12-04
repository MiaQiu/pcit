# Figma Design Catalog

Complete catalog of all screens, components, and design specifications from Figma for future implementation.

**Figma File**: `iHkY0DURZnXQiYwmheSKdo` - Nora

## 📱 Screens & Pages

### 1. Home Page States + Flow (Section 35:1876)
Main home screen with lesson cards and navigation.

#### Screens:
- **Home Screen** (35:787) - Main entry point
  - Streak widget with weekly progress
  - Scrollable lesson cards
  - Bottom tab navigation
  - Status: ✅ **IMPLEMENTED**

- **Home with Completed Lesson** (35:835) - Shows streak after completion
  - Enhanced streak display
  - Updated lesson card states
  - Status: 🔄 **READY FOR IMPLEMENTATION**

#### Components Used:
- LessonCard (35:791) ✅ Implemented
- StreakWidget (35:838) 🔄 Partial
- TabNavigator (90:3525) ✅ Implemented

---

### 2. Lesson + Quiz Flow (Section 1:277)

#### Screens:
- **LessonViewer - Reading** (36:1210)
  - Progress bar at top
  - Lesson content with dragon image
  - Phase badge
  - "Continue" CTA button
  - Status: 🔄 **READY FOR IMPLEMENTATION**

- **LessonViewer - Quiz Question** (36:1223)
  - Multiple choice responses
  - Response buttons (3 options)
  - Same progress bar
  - Status: 🔄 **READY FOR IMPLEMENTATION**

- **LessonViewer - Quiz Feedback** (36:1238)
  - Shows correct/incorrect feedback
  - Explanation text
  - Green success banner at bottom
  - Status: 🔄 **READY FOR IMPLEMENTATION**

#### Components Needed:
- ProgressBar (1:644)
- ResponseButton (1:595) - Default, Selected, Correct states
- FeedbackBanner (custom)

---

### 3. Goals & Objectives (Section 1:322)

#### Screens:
- **Goal Screen** (36:1016)
  - Scrollable goal cards
  - Recording session list items
  - Statistics display
  - Step-by-step instructions
  - Status: 📋 **NOT IMPLEMENTED**

#### Components Needed:
- GoalCard (custom)
- RecordingSessionItem (127:1563)
- StepsList (127:1606)

---

### 4. Review Report + Insights (Section 1:433)

#### Screens:
- **Report Summary** (35:2159)
  - Nora Score display
  - PEN Skills breakdown (Praise, Echo, Narrate)
  - Progress bars for each skill
  - Areas to avoid metrics
  - Top moment playback
  - Tips section
  - Full transcript link
  - Status: 📋 **NOT IMPLEMENTED**

#### Components Needed:
- ScoreCard (35:2171)
- SkillProgressBar (71:2460)
- MomentPlayer (35:2219) - Audio waveform visualization
- TipsCard (35:2254)

---

### 5. Progress Dashboard (Section 68:811)

#### Screens:
- **Home/Progress Screen** (68:992)
  - Statistics cards (lessons completed, sessions, streak)
  - Monthly calendar view
  - Nora Score graph over time
  - Bottom navigation
  - Status: 📋 **NOT IMPLEMENTED**

#### Components Needed:
- StatsCard (68:1002)
- Calendar (68:1013)
- LineGraph (68:1112)
- AxisItem (68:1115)

---

## 🧩 Reusable Components Catalog

### Core Components (Section 1:581)

#### 1. **Text Components**
- `Text` (1:582) - Body text, 382x56
- `Text-med` (1:630) - Medium text, 536x30
- `Highlight` (1:610) - Label/tag text, 382x24
- `text-body` (1:642) - Body copy, 334x24

#### 2. **Buttons**
- `CTA` (1:584) - Call-to-action button, 382x64
  - Status: ✅ **IMPLEMENTED** as `Button.tsx`
- `Button container` (1:588) - Container wrapper, 382x64
- `Response Button` (1:595) - Quiz answer button with 3 states:
  - Default (1:596)
  - Selected (1:607)
  - Correct (1:599)

#### 3. **Icons** (1:612)
All 24x24px icons:
- `close` (1:613)
- `arrow-back` (1:615)
- `Check` (1:619)
- `Record` (1:628)
- Additional navigation icons

#### 4. **Progress Components**
- `Progress Bar` (1:643) - Two variants:
  - Default (1:644)
  - With Title (1:662)

---

## 🎨 Design System Tokens

### Colors
```typescript
{
  mainPurple: '#8C49D5',
  textDark: '#1E2939',
  white: '#FFFFFF',
  cardPurple: '#E4E4FF',
  cardOrange: '#FFE4C0',
  ellipseCyan: '#9BD4DF',
  ellipseOrange: '#FFB380',
  successGreen: '#4CAF50', // For correct answers
  errorRed: '#F44336', // For incorrect answers
}
```

### Typography
- **Font Family**: Plus Jakarta Sans
- **Weights**: 400 (Regular), 600 (SemiBold), 700 (Bold)
- **Sizes**:
  - Headline: 32px / Bold / -0.2px letter-spacing
  - Title: 16px / Bold / 24px line-height
  - Body: 16px / Regular / 22px line-height / -0.31px letter-spacing
  - Label: 14px / SemiBold
  - Caption: 10px / SemiBold / -0.1px letter-spacing

### Spacing
- Card padding: 24px
- Button height: 64px
- Border radius (card): 24px
- Border radius (button): 112px (fully rounded)
- Gap between cards: 8px

### Layout Dimensions
- Screen width: 430px
- Content width: 382px (24px side margins)
- Status bar height: 47-50px
- Bottom nav height: 74px
- Tab bar height: 106px (with background)

---

## 📦 Asset Inventory

### Images Currently Downloaded ✅
- dragon-purple.png (2.7MB)
- ellipse-77.png (278B)
- ellipse-78.png (280B)
- arrow-icon-1.png (687B)
- arrow-icon-2.png (687B)

### Assets Needed 📥
- Dragon variants (different poses/phases)
- Phase badge backgrounds
- Navigation icons (all states)
- Success/error icons
- Audio waveform visualization assets
- Calendar day indicators
- Graph line assets

---

## 🚀 Implementation Priority

### Phase 1: Core Reading Experience ✅ DONE
- [x] Home Screen with lesson cards
- [x] Tab Navigation
- [x] Basic components (Card, Badge, Button)

### Phase 2: Lesson Viewer (NEXT)
- [ ] LessonViewer - Reading mode
- [ ] Progress bar component
- [ ] Lesson content layout
- [ ] Navigation between lessons

### Phase 3: Quiz System
- [ ] LessonViewer - Quiz mode
- [ ] Response buttons with states
- [ ] Quiz feedback display
- [ ] Score tracking

### Phase 4: Goals & Recording
- [ ] Goal screen
- [ ] Recording session display
- [ ] Step-by-step instructions
- [ ] Audio recording UI

### Phase 5: Progress & Analytics
- [ ] Progress dashboard
- [ ] Calendar view
- [ ] Score graphs
- [ ] Statistics cards

### Phase 6: Review Reports
- [ ] Report summary screen
- [ ] PEN skills breakdown
- [ ] Audio moment playback
- [ ] Transcript viewer

---

## 📝 Implementation Notes

### Current Status
- **Implemented**: Home screen, LessonCard, StreakWidget (partial), TabNavigator, core components
- **Assets**: All images stored locally in `/assets/images/`
- **Design System**: Documented in `/src/constants/assets.ts`
- **Screenshots**: ✅ All 8 major screens downloaded and documented
- **Component Specs**: ✅ 20+ components fully specified

### Documentation
- **[SCREEN_IMPLEMENTATION_GUIDES.md](./SCREEN_IMPLEMENTATION_GUIDES.md)** - Detailed implementation guides for all 8 screens with exact specifications, layout structures, and component breakdowns
- **[COMPONENTS_SPECIFICATION.md](./COMPONENTS_SPECIFICATION.md)** - Complete specifications for all 20+ reusable components with TypeScript interfaces, styling details, and implementation priorities

### Next Steps
1. ✅ **Download remaining screen designs** - COMPLETED (8 screens)
2. ✅ **Extract component specifications** - COMPLETED (20+ components)
3. **Create component stubs** - Set up placeholder components for future implementation
4. **Update assets** - Download missing icons and images

### Integration Guidelines
- All screens use 430x860 viewport (iPhone 13/14 size)
- Maintain 24px horizontal padding for content
- Use exact Figma measurements for initial implementation
- Implement responsive behavior after pixel-perfect match
- Follow existing component patterns (Card, Button, Badge structure)

---

## 🔗 Figma References

### Node IDs Quick Reference
```typescript
const FIGMA_NODES = {
  // Screens
  homeScreen: '35:787',
  lessonViewer: '36:1210',
  quizScreen: '36:1223',
  goalScreen: '36:1016',
  reportScreen: '35:2159',
  progressScreen: '68:992',

  // Components
  lessonCard: '35:791',
  ctaButton: '1:584',
  responseButton: '1:595',
  progressBar: '1:644',
  highlight: '1:610',

  // Assets
  dragon: '35:798',
  ellipse77: '35:792',
  ellipse78: '35:793',
};
```

### Figma File Structure
- **Section 1:277**: Lesson + Quiz flow
- **Section 1:322**: Goals and objectives
- **Section 1:433**: Review reports
- **Section 1:581**: Reusable components library
- **Section 35:1876**: Home page states (main screens)
- **Section 68:811**: Progress dashboard

---

## 📊 Metrics

- **Total Screens**: 10+ unique screens
- **Reusable Components**: 15+ components
- **Assets**: 20+ images/icons needed
- **Implementation Progress**: ~20% complete (Home + Core components)
- **Estimated Remaining**: 8-10 major screens

---

*Last Updated: December 1, 2025*
*Figma File: iHkY0DURZnXQiYwmheSKdo*
