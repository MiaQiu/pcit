# UI Implementation Plan - Nora Mobile

**Date:** December 1, 2025 (Updated: December 2, 2025)
**Status:** Phase 2 Complete - Ready for Phase 3 (API Integration)

---

## Current State ✅

### What's Already Built
1. **Foundation Complete** ✅
   - ✅ React Native app with Expo SDK 54
   - ✅ React 19.1.0 (all version conflicts resolved)
   - ✅ TypeScript configured and working
   - ✅ NativeWind v4 for Tailwind styling
   - ✅ Metro bundler building successfully (1030 modules)

2. **Navigation Structure** ✅
   - ✅ Bottom tab navigation (4 tabs: Home, Record, Learn, Progress)
   - ✅ Stack navigation (MainTabs → LessonViewer)
   - ✅ TypeScript navigation types
   - ✅ Safe area context configured
   - ✅ Seamless transitions (no modal animations)

3. **Design System** ✅
   - ✅ Brand colors (#8C49D5 purple, #1E2939 text, #FFFFFF white)
   - ✅ Plus Jakarta Sans font family (Regular, SemiBold, Bold)
   - ✅ Tailwind configured with Nora colors
   - ✅ Theme system (colors, spacing, fonts)

4. **Core Components** ✅
   - ✅ Button (primary purple CTA with loading states)
   - ✅ Input (email, password, text, numeric variants with error states)
   - ✅ Card (reusable container with custom backgrounds)
   - ✅ Badge (phase labels with label + subtitle)
   - ✅ ProgressBar (multi-segment progress indicator)
   - ✅ Highlight (purple label component)
   - ✅ Ellipse (decorative SVG backgrounds)

5. **Lesson Components** ✅
   - ✅ LessonCard (complete card with dragon, badge, CTA)
   - ✅ StreakWidget (weekly streak tracker with checkmarks)
   - ✅ ResponseButton (quiz option button with 4 states)
   - ✅ QuizFeedback (correct/incorrect feedback display)

6. **Screens** ✅
   - ✅ HomeScreen (lesson card list, navigation to lessons)
   - ✅ LessonViewerScreen (multi-segment lesson reader + integrated quiz)
   - ✅ QuizScreen (standalone - deprecated, quiz now integrated in LessonViewer)
   - ⏸️ RecordScreen (placeholder)
   - ⏸️ LearnScreen (placeholder)
   - ⏸️ ProgressScreen (placeholder)

---

## ✅ Completed Phases

### Phase 1: Foundation & Base Components ✅
**Completed:** Week 1
- ✅ React version conflicts resolved
- ✅ Navigation setup (tab + stack)
- ✅ Button component
- ✅ Highlight component
- ✅ Design system (colors, fonts, theme)

### Phase 2A: Core Components ✅
**Completed:** Week 2
- ✅ Input component (all variants: text, email, password, numeric)
- ✅ Card component (default, pressable)
- ✅ ProgressBar component (multi-segment)
- ✅ Badge component (phase labels)
- ⏸️ Avatar component (deferred - StreakWidget handles images)

### Phase 2C: Home/Learn Screen ✅
**Completed:** Week 2
- ✅ LessonCard component (complete with dragon, badge, ellipses)
- ✅ StreakWidget component (7-day grid with checkmarks)
- ✅ HomeScreen implementation (scrollable lesson cards)
- ✅ Navigation to LessonViewer
- ⏸️ Using mock data (API integration pending)

### Phase 2E: Lesson Viewer & Quiz ✅
**Completed:** Week 2
- ✅ LessonViewerScreen (multi-segment navigation)
- ✅ Quiz integrated as final segment in LessonViewer
- ✅ ResponseButton component (4 states)
- ✅ QuizFeedback component
- ✅ Progress tracking structure
- ✅ Back/Continue navigation
- ✅ Seamless transitions (no modal animations)
- ⏸️ Using mock data (API integration pending)

---

## 📊 Component Inventory

| Component | File | Status | Features |
|-----------|------|--------|----------|
| Button | `/components/Button.tsx` | ✅ Complete | Primary CTA, loading, disabled states |
| Input | `/components/Input.tsx` | ✅ Complete | 4 variants, error states, icons, password toggle |
| Card | `/components/Card.tsx` | ✅ Complete | Custom background, pressable variant |
| Badge | `/components/Badge.tsx` | ✅ Complete | Label + subtitle, purple theme |
| ProgressBar | `/components/ProgressBar.tsx` | ✅ Complete | Multi-segment indicator |
| Highlight | `/components/Highlight.tsx` | ✅ Complete | Purple label |
| Ellipse | `/components/Ellipse.tsx` | ✅ Complete | SVG decorative background |
| LessonCard | `/components/LessonCard.tsx` | ✅ Complete | Dragon, badge, CTA, ellipses, lock state |
| StreakWidget | `/components/StreakWidget.tsx` | ✅ Complete | 7-day grid, avatar, checkmarks |
| ResponseButton | `/components/ResponseButton.tsx` | ✅ Complete | Quiz option, 4 states, checkmark |
| QuizFeedback | `/components/QuizFeedback.tsx` | ✅ Complete | Correct/incorrect feedback |
| Avatar | - | ⏸️ Deferred | Not needed yet (StreakWidget has image) |

---

## 🎯 Current User Flow (Working)

### Lesson Learning Flow ✅
1. User opens app → HomeScreen
2. Sees lesson cards with dragon illustrations
3. Taps "Start Reading" → LessonViewerScreen opens
4. Reads through lesson segments (3 segments with progress bar)
5. Clicks "Continue" through each segment
6. Reaches final segment → "Take Quiz" button appears
7. Quiz displays as final segment (integrated in same screen)
8. Selects answer → "Check Answer"
9. Sees feedback (correct/incorrect)
10. Clicks "Continue" → Returns to HomeScreen

**All transitions are seamless (no modal animations)**

---

## 🚧 What's Using Mock Data

Currently using mock data (needs API integration):
1. **HomeScreen**
   - `MOCK_LESSONS` array (2 lessons)
   - Hardcoded lesson properties (phase, title, colors)

2. **LessonViewerScreen**
   - `mockData` in `loadLessonDetail()`
   - Hardcoded segments, quiz, user progress

3. **StreakWidget**
   - Commented out in HomeScreen
   - Uses hardcoded `completedDays` array

---

## 📝 Next Phase: Phase 3 - Backend API Integration

### Goal: Connect mobile app to backend services

#### Tasks:
1. **Set up Service Context** ⏳
   - Create AppContext with @nora/core services
   - Initialize LessonService, AuthService
   - Mobile storage adapter (SecureStore for tokens)
   - Provide services to all screens

2. **HomeScreen API Integration** ⏳
   - Replace MOCK_LESSONS with `LessonService.getLessons()`
   - Fetch user progress for each lesson
   - Show real completion status
   - Implement lesson locking based on prerequisites
   - Add loading states (skeleton screens)
   - Error handling (retry, offline message)

3. **LessonViewerScreen API Integration** ⏳
   - Replace mock data with `LessonService.getLessonDetail(lessonId)`
   - Call `LessonService.updateProgress()` on segment completion
   - Save time tracking data
   - Handle network errors

4. **Quiz API Integration** ⏳
   - Call `LessonService.submitQuizAnswer()` on quiz submission
   - Track attempt number
   - Show real feedback from backend

5. **StreakWidget Integration** ⏳
   - Uncomment in HomeScreen
   - Fetch user streak from `UserService.getStreak()`
   - Show real completion data
   - Update on lesson completion

6. **Testing** ⏳
   - Test full flow with backend running
   - Verify data persistence
   - Test error scenarios (network failures)
   - Test loading states

---

## 🔧 Implementation Details

### Phase 3A: Service Context Setup
**File:** `/App.tsx`

```typescript
// Create context for services
const AppContext = React.createContext<{
  lessonService: LessonService;
  authService: AuthService;
  // ... other services
}>(null!);

// In App component:
const lessonService = useMemo(() => {
  const storage = new SecureStoreAdapter();
  return new LessonService({
    baseUrl: process.env.EXPO_PUBLIC_API_URL,
    storage,
  });
}, []);

// Wrap app in provider
<AppContext.Provider value={{ lessonService }}>
  <NavigationContainer>
    <RootNavigator />
  </NavigationContainer>
</AppContext.Provider>
```

### Phase 3B: HomeScreen Changes
**File:** `/screens/HomeScreen.tsx`

```typescript
// Remove MOCK_LESSONS
// Add:
const { lessonService } = useContext(AppContext);
const [lessons, setLessons] = useState<Lesson[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  loadLessons();
}, []);

const loadLessons = async () => {
  try {
    setLoading(true);
    const data = await lessonService.getLessons();
    setLessons(data);
  } catch (error) {
    // Handle error
  } finally {
    setLoading(false);
  }
};
```

---

## 🎯 Phase 2B: Authentication (Deferred)

**Reason for Deferral:** Lesson system is higher priority for MVP. Auth can be added later.

When ready to implement:
1. LoginScreen (email + password)
2. SignupScreen (name + email + password)
3. AuthContext with @nora/core AuthService
4. Protected routes
5. Token refresh logic

---

## 📱 Other Screens (Future Phases)

### Phase 2D: Progress Screen (Priority 4)
- Streak calendar (more detailed than widget)
- Stats cards (lessons completed, sessions recorded)
- Nora Score chart
- **Dependency:** Chart library (react-native-chart-kit)

### Phase 2F: Record Screen (Priority 6 - Most Complex)
- Audio recording interface
- Waveform visualization
- Upload to backend
- Transcription display
- PCIT analysis results
- **Dependency:** expo-av

---

## 📦 Dependencies Status

### Already Installed ✅
- @react-navigation/* (navigation)
- nativewind (styling)
- expo-font (fonts)
- expo-secure-store (auth tokens)
- @react-native-async-storage (settings)
- @expo/vector-icons (Ionicons)

### Need to Install (Phase 2D):
- [ ] react-native-chart-kit or victory-native (Charts)

### Need to Install (Phase 2F):
- [ ] expo-av (Audio recording)
- [ ] expo-haptics (Tactile feedback)

---

## 🎉 Progress Summary

### Completed:
- ✅ Foundation (React Native, Navigation, TypeScript)
- ✅ Design System (Colors, Fonts, Theme)
- ✅ 11 Core Components
- ✅ Complete Lesson Learning Flow (HomeScreen → LessonViewer → Quiz)
- ✅ Multi-segment lesson navigation
- ✅ Integrated quiz experience
- ✅ Progress tracking UI
- ✅ Seamless transitions

### Current Focus:
- 🎯 **Phase 3: Backend API Integration**
- Connect all screens to real data
- Remove all mock data
- Test with backend running

### Deferred:
- ⏸️ Authentication (Phase 2B)
- ⏸️ Progress Screen (Phase 2D)
- ⏸️ Record Screen (Phase 2F)
- ⏸️ Avatar Component (not needed yet)

---

## 🚀 Next Immediate Steps

### This Week (Week 3):

1. **Day 1-2: Service Context Setup**
   - Create AppContext in App.tsx
   - Initialize @nora/core services
   - Set up SecureStore adapter
   - Test service connectivity

2. **Day 3: HomeScreen API Integration**
   - Replace MOCK_LESSONS with real API
   - Add loading states
   - Add error handling
   - Test lesson fetching

3. **Day 4: LessonViewer API Integration**
   - Replace mock lesson detail data
   - Implement progress tracking API calls
   - Test full lesson flow

4. **Day 5: Quiz & StreakWidget Integration**
   - Connect quiz submission to API
   - Enable StreakWidget with real data
   - End-to-end testing

---

## 📊 Files Modified in Last Update

### Recent Changes (Dec 2, 2025):
1. **LessonViewerScreen** - Integrated quiz as final segment (no separate screen)
2. **RootNavigator** - Removed modal animations (seamless transitions)
3. **HomeScreen** - Using LessonCard components with navigation

### Files Ready for API Integration:
- `/screens/HomeScreen.tsx` (replace MOCK_LESSONS)
- `/screens/LessonViewerScreen.tsx` (replace mockData)
- `/components/StreakWidget.tsx` (uncomment in HomeScreen)

---

**Status:** Phase 2 Complete ✅ | Ready for Phase 3: API Integration 🚀

**Next Task:** Set up AppContext with @nora/core services
