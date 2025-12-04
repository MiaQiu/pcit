# Nora Mobile Documentation

Complete documentation for the Nora mobile app React Native implementation.

---

## 📚 Documentation Index

### Design & Implementation

1. **[FIGMA_DESIGN_CATALOG.md](./FIGMA_DESIGN_CATALOG.md)**
   - Complete catalog of all screens and components from Figma
   - Asset inventory and design system tokens
   - Implementation priority and roadmap
   - Quick reference for Figma node IDs

2. **[SCREEN_IMPLEMENTATION_GUIDES.md](./SCREEN_IMPLEMENTATION_GUIDES.md)**
   - Detailed implementation guides for all 8 major screens
   - Exact specifications and measurements
   - Layout structures and component breakdowns
   - Implementation checklists by phase

3. **[COMPONENTS_SPECIFICATION.md](./COMPONENTS_SPECIFICATION.md)**
   - Complete specifications for 20+ reusable components
   - TypeScript interfaces and prop definitions
   - Styling details and design tokens
   - Component priority matrix

---

## 🎯 Quick Start

### For Designers
- See **FIGMA_DESIGN_CATALOG.md** for the complete design inventory
- Figma file: `iHkY0DURZnXQiYwmheSKdo`
- All screens documented with node IDs for easy reference

### For Developers
1. Start with **SCREEN_IMPLEMENTATION_GUIDES.md** for screen-specific details
2. Reference **COMPONENTS_SPECIFICATION.md** for component specs
3. Check **FIGMA_DESIGN_CATALOG.md** for design system tokens

### For Product Managers
- See Phase breakdown in **FIGMA_DESIGN_CATALOG.md** (section: Implementation Priority)
- Track progress: ~20% complete (Phase 1 done)
- Next priority: Lesson Viewer (Phase 2)

---

## 📱 Screens Overview

### ✅ Implemented (Phase 1)
- **Home Screen** (35:787) - Main entry with lesson cards
- **Tab Navigation** (90:3525) - Bottom navigation

### 🔄 Ready for Implementation

**Phase 2: Lesson Viewer** (HIGH PRIORITY)
- **LessonViewer - Reading** (36:1210)
- Components needed: ProgressBar, CloseButton

**Phase 3: Quiz System** (HIGH PRIORITY)
- **LessonViewer - Quiz** (36:1223)
- **LessonViewer - Feedback** (36:1238)
- Components needed: ResponseButton, FeedbackBanner

**Phase 4: Goals & Recording** (MEDIUM PRIORITY)
- **Goal Screen** (36:1016)
- Components needed: GoalCard, PENSkillItem, TagButton

**Phase 5: Progress Dashboard** (LOW PRIORITY)
- **Progress Screen** (68:992)
- Components needed: StatsCard, Calendar

**Phase 6: Review Reports** (MEDIUM PRIORITY)
- **Report Summary** (35:2159)
- Components needed: ScoreCard, SkillProgressBar, MomentPlayer

---

## 🧩 Components Overview

### ✅ Implemented (5 components)
1. Card - Container component
2. Badge - Phase labels
3. Button - CTA buttons
4. LessonCard - Main lesson card
5. TabNavigator - Bottom tabs

### 🔄 Ready to Build (15+ components)

**HIGH Priority** (needed for Phase 2-3):
- ProgressBar
- ResponseButton
- CloseButton
- FeedbackBanner

**MEDIUM Priority** (needed for Phase 4-6):
- StreakWidget
- GoalCard
- PENSkillItem
- ScoreCard
- SkillProgressBar
- MomentPlayer
- StatsCard

**LOW Priority**:
- TagButton
- DotIndicator
- Calendar
- TipCard

---

## 🎨 Design System

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
  successGreen: '#4CAF50',
  errorRed: '#F44336',
}
```

### Typography
- **Font**: Plus Jakarta Sans
- **Weights**: 400 (Regular), 600 (SemiBold), 700 (Bold)
- **Sizes**: 10px (caption), 14px (label), 16px (body/title), 32px (headline)

### Spacing
- Card padding: 24px
- Button height: 64px
- Border radius (card): 24px
- Border radius (button): 112px
- Gap between cards: 8px

---

## 📦 Assets

### Local Assets (✅ Downloaded)
Location: `/assets/images/`

- dragon-purple.png (2.7MB)
- ellipse-77.png (278B)
- ellipse-78.png (280B)
- arrow-icon-1.png (687B)
- arrow-icon-2.png (687B)

### Assets Needed
- Dragon variants (different poses)
- Navigation icons (24x24px, all states)
- Success/error icons
- Audio waveform visualization
- Calendar day indicators
- Graph line assets

---

## 🔗 External Resources

- **Figma File**: https://www.figma.com/design/iHkY0DURZnXQiYwmheSKdo/Nora
- **Asset Download Script**: `/scripts/download-figma-assets.cjs`
- **Design Tokens**: `/src/constants/assets.ts`

---

## 📊 Implementation Progress

- **Total Screens**: 8 major screens documented
- **Completed**: 2 screens (25%)
- **Components Implemented**: 5 of 20 (25%)
- **Assets Downloaded**: 5 core images
- **Documentation**: 100% complete

### Phase Status
- ✅ **Phase 1**: Core Reading Experience (DONE)
- 🔄 **Phase 2**: Lesson Viewer (NEXT)
- ⏳ **Phase 3**: Quiz System
- ⏳ **Phase 4**: Goals & Recording
- ⏳ **Phase 5**: Progress Dashboard
- ⏳ **Phase 6**: Review Reports

---

## 🛠️ Development Guidelines

### Component Creation
1. Reference **COMPONENTS_SPECIFICATION.md** for exact specs
2. Use TypeScript interfaces provided in docs
3. Follow existing component patterns (Card, Button, Badge)
4. Match Figma measurements exactly initially
5. Add responsive behavior after pixel-perfect match

### Screen Implementation
1. Reference **SCREEN_IMPLEMENTATION_GUIDES.md** for layout
2. Use SafeAreaView for all screens
3. Maintain 24px horizontal padding
4. Use exact Figma measurements (documented in comments)
5. Follow component hierarchy from layout structure

### Assets
- Import from `/src/constants/assets.ts`
- Never use remote URLs (assets expire)
- Run download script if new assets needed
- Commit all assets to repository

---

*Last Updated: December 1, 2025*
*Nora Mobile - React Native Implementation*
