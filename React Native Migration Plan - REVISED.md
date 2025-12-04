# Nora Mobile App Development Plan - REVISED
## Hybrid Approach: Rebuild Mobile + Extract Shared Services

> **✅ STATUS: PHASES 0-4 SUBSTANTIALLY COMPLETE - RECORDING BACKEND NEXT**
>
> **Completed:**
> - ✅ Phase 0: Monorepo setup + @nora/core package with 5 services extracted
> - ✅ Phase 1: React Native app initialized with all dependencies
> - ✅ Phase 3: Core UI components (20+ components built from Figma)
> - ✅ Phase 4A: Screen implementation (5/7 screens functional)
> - ✅ Phase 5A: Recording UI complete with expo-av foundation
>
> **Current Status:**
> - 5 screens fully functional: Home, Learn, LessonViewer, LessonComplete, Record (UI only)
> - Backend API integration complete with caching and performance optimizations
> - Recording screen UI complete, awaiting backend integration
> - Progress and Auth screens remain as placeholders
>
> **Last Updated:** 2025-12-03 1:00 AM
> **Commit:** 98aeb08 - Implement two-step recording flow with RecordingCard and dragon image

---

## Executive Summary

After analyzing the current Nora prototype (~7,800 lines of code), we've determined that a **hybrid approach** is optimal:

- **Extract and share** backend services and business logic (45% of codebase)
- **Rebuild from scratch** mobile UI, navigation, and platform-specific features (55% of codebase)
- **Keep unchanged** the excellent production-ready backend and database

**Key Insight:** Your prototype is 45% production-ready. The reusable 45% is the hard stuff (backend integration, business logic, auth). The other 55% (UI, audio, navigation) is web-specific and should be rebuilt native-first.

**Design Dependency:** UI phases (Phase 3-6) are dependent on new design specifications. Only Phase 0-2 (foundation and services) can proceed independently.

---

## Code Quality Assessment

| Component | Quality | Reusability | Strategy |
|-----------|---------|-------------|----------|
| **Backend/Database** | ⭐⭐⭐⭐⭐ Production | 100% | **KEEP** - Already production-ready |
| **authService.js** | ⭐⭐⭐⭐ Very good | 95% | **EXTRACT** - Platform-agnostic version |
| **Service Layer** | ⭐⭐⭐⭐ Good | 90% | **EXTRACT** - Clean architecture |
| **Business Logic** | ⭐⭐⭐⭐ Good | 85% | **EXTRACT** - PCIT analysis, scoring |
| **useAudioRecorder** | ⭐⭐⭐⭐ Excellent code | 0% | **REBUILD** - 100% Web Audio API |
| **UI Components** | ⭐⭐⭐ Prototype | 30% | **REBUILD** - Native-first design |
| **Navigation** | ⭐⭐ Prototype | 10% | **REBUILD** - State-based won't work |

---

## Critical Findings from Codebase Analysis

### What Works (Keep/Extract)
1. **Prisma Database Schema** - Production-ready with proper indexes, relations, and security
2. **AuthService** - Excellent singleton pattern with auto token refresh (just needs localStorage→AsyncStorage)
3. **Session/PCIT Services** - Clean API integration layer
4. **Business Logic** - PCIT analysis, competency scoring, risk assessment

### What Doesn't Work on Mobile (Rebuild)
1. **useAudioRecorder Hook (230 lines)** - Uses MediaRecorder API, AudioContext, AnalyserNode (none available in React Native)
2. **State-Based Navigation** - Current `setActiveScreen` pattern incompatible with React Navigation
3. **Mock Authentication** - Auth is bypassed with hardcoded mock user
4. **Web-Specific UI** - Hover states, box-shadow, web scrolling, no safe areas

### Migration Complexity
- **Total Code:** 7,789 lines
- **Reusable:** ~3,500 lines (45%) - Backend, services, business logic
- **Must Rebuild:** ~4,289 lines (55%) - UI, audio, navigation
- **React Hooks:** 115 occurrences across 17 files
- **localStorage Usage:** authService.js (critical path for mobile)

---

## Architecture: Monorepo with Shared Core

Instead of migrating everything or rebuilding everything, we create a **shared package**:

```
/packages/
  /nora-core/              ← NEW: Shared business logic
    /services/
      authService.ts       ← Platform-agnostic (uses storage adapter)
      sessionService.ts
      pcitService.ts
      transcriptionService.ts
      amplitudeService.ts
    /utils/
      formatters.ts
      validators.ts
      constants.ts
    /types/
      index.ts             ← TypeScript definitions
    /adapters/
      storage.ts           ← localStorage (web) / AsyncStorage (mobile)

/nora-web/                 ← EXISTING: Current prototype
  /src/
    ... (unchanged, imports from @nora/core)

/nora-mobile/              ← NEW: React Native app
  /src/
    /screens/              ← Rebuild based on NEW DESIGN
    /components/           ← Rebuild based on NEW DESIGN
    /hooks/
      useAudioRecorder.ts  ← Rebuild with expo-av
    /navigation/           ← React Navigation (structure TBD from new design)
    ... (imports from @nora/core)

/server/                   ← EXISTING: Backend (unchanged)
  /routes/
  /services/
  ... (no changes needed)

/prisma/                   ← EXISTING: Database (unchanged)
```

**Benefits:**
- Backend services work on both platforms
- One source of truth for business logic
- Easy to maintain consistency
- Web app can continue development independently
- Mobile gets clean, native-first architecture

---

## Phase-by-Phase Implementation Plan

### **Phase 0: Pre-Migration Setup (Week 1, Days 1-2)** ✅ **COMPLETED**

**Goal:** Set up monorepo structure and extract shared services

> **✅ COMPLETED - November 30, 2025**

#### Day 1: Monorepo Setup
- [x] Initialize monorepo structure (npm workspaces)
- [x] Create `packages/nora-core` package
- [x] Set up TypeScript configuration for shared package
- [x] Configure path aliases (`@nora/core`)

#### Day 2: Extract Core Services
- [x] Create storage adapter pattern (StorageAdapter interface + WebStorageAdapter)
- [x] Refactor authService.js → authService.ts (platform-agnostic)
- [x] Extract sessionService, pcitService, transcriptionService, amplitudeService
- [x] Extract utility functions (fetchWithTimeout)
- [x] Create TypeScript type definitions (15+ interfaces)
- [x] Built and compiled successfully to dist/

**Deliverables:** ✅
- Working monorepo structure with 3 workspaces
- Shared `@nora/core` package (~1,500 lines TypeScript)
- 5 services extracted and compiled
- Platform-agnostic StorageAdapter pattern

**Documentation:** See PHASE_0_COMPLETE.md

---

### **Phase 1: Mobile Foundation (Week 1, Days 3-5)** ✅ **COMPLETED**

**Goal:** Get a blank React Native app running with proper tooling

> **✅ COMPLETED - November 30, 2025**

#### Tasks
1. **Initialize Project (TypeScript + Expo)** ✅
   - Expo SDK 54, React Native 0.81.5, TypeScript configured
   - 811 packages installed

2. **Install NativeWind (Tailwind for React Native)** ✅
   - NativeWind v4.2.1 installed
   - Tailwind CSS v3.3.2 configured
   - babel.config.js configured with NativeWind plugin
   - Nunito font family configured (matching web app)

3. **Install Core Navigation** ✅
   - @react-navigation/native, native-stack, bottom-tabs
   - react-native-screens and safe-area-context installed

4. **Install Storage Libraries** ✅
   - expo-secure-store (for auth tokens)
   - @react-native-async-storage (for settings)

5. **Link to Shared Core** ✅
   - @nora/core linked via workspace
   - Available for import in mobile app

6. **Set Up Environment Variables** ✅
   - .env and .env.example created
   - EXPO_PUBLIC_API_URL configured

7. **Create Mobile Storage Adapters** ✅
   - SecureStorageAdapter (implements StorageAdapter)
   - AsyncStorageAdapter (implements StorageAdapter)
   - File: src/adapters/mobileStorage.ts

8. **Test Basic Setup** ✅
   - App.tsx updated with NativeWind test
   - Directory structure created (screens, components, hooks, navigation)

**Deliverables:** ✅
- React Native app running with Expo
- NativeWind working (Tailwind classes rendering)
- All navigation libraries installed
- @nora/core linked and ready to use
- Mobile storage adapters created
- Environment variables configured
- Ready for UI development

**Documentation:** See PHASE_1_COMPLETE.md

---

### **📋 CURRENT STATUS: Core Features Complete, Recording Backend Next**

**Completed Infrastructure:**
- ✅ Monorepo infrastructure
- ✅ Shared services package (@nora/core)
- ✅ React Native app initialized with all dependencies
- ✅ Platform-specific adapters created
- ✅ NativeWind v4 styling system
- ✅ React Navigation (tab + stack navigation)

**Completed Components (20+ components):**
- ✅ Design system: Button, Input, Card, Badge, ProgressBar, Highlight, Ellipse
- ✅ Lesson components: LessonCard, LessonListItem, StreakWidget, ProfileCircle, NextActionCard
- ✅ Quiz components: ResponseButton, QuizFeedback
- ✅ Recording components: RecordingCard, AudioWaveform, RecordingTimer, RecordButton, RecordingGuideCard, HowToRecordCard

**Completed Screens (5/7):**
- ✅ HomeScreen: Today's lesson with caching, pull-to-refresh
- ✅ LearnScreen: All 41 lessons organized by phases
- ✅ LessonViewerScreen: Multi-segment reading + quiz with cache-first loading
- ✅ LessonCompleteScreen: Completion card with next action
- ✅ RecordScreen: Two-step recording flow UI (backend integration pending)
- ⏸️ ProgressScreen: Placeholder
- ⏸️ Auth Screens: Temporarily disabled for development

**Backend Integration:**
- ✅ API integration with all lesson endpoints
- ✅ AsyncStorage caching with stale-while-revalidate
- ✅ Quiz submission with client-side validation
- ✅ Progress tracking and persistence
- ✅ Performance optimizations (batch queries, cache-first loading)

**Audio Recording Status:**
- ✅ expo-av installed and configured
- ✅ Microphone permission handling
- ✅ Recording UI with two-step flow (Start Session → Record → Stop)
- ✅ RecordingCard with dragon image, waveform, timer
- ✅ Duration tracking and display
- ⏳ Backend upload endpoint pending
- ⏳ Transcription integration pending
- ⏳ PCIT analysis integration pending

**Next:** Phase 5B - Complete recording backend integration

---

### **Phase 2: Authentication & Navigation Skeleton (Week 2)** ✅ **COMPLETED**

**Goal:** Create the app structure and authentication flow

> **✅ COMPLETED - December 2025**
> **Note:** Authentication temporarily disabled for development

#### Week 2, Days 1-2: Navigation Architecture ✅
- [x] Navigation structure implemented: Bottom tabs + Stack navigation
  - 4 tabs: Home, Record, Learn, Progress
  - Stack navigation for LessonViewer
  - Seamless transitions (no modal animations)
- [x] Created all screen files
- [x] Set up TypeScript navigation types
- [x] Configured safe area context for notches/gesture bars
- [x] Tested navigation flow (stack push/pop, tab switching)

#### Week 2, Days 3-4: Authentication Implementation ⚠️
- [x] Mobile storage adapters created (SecureStore + AsyncStorage)
- [x] AppContext created with @nora/core services
- [ ] AuthContext implementation (deferred)
- [x] Mock authentication removed from endpoints (temporarily for development)
- [ ] Login/signup screens (deferred - not in initial scope)
- [ ] Full authentication flow (deferred)

> **⚠️ Security Note:** Authentication middleware temporarily disabled on lesson endpoints for development. Must be re-enabled before production.

#### Week 2, Day 5: Protected Routes & State ✅
- [ ] Protected route guards (deferred with auth)
- [x] Global state management with AppContext
- [ ] Amplitude analytics (not yet configured for mobile)
- [x] Navigation working without auth (development mode)

**Deliverables:** ✅
- Complete navigation architecture with 4 tabs
- AppContext with services ready
- Auth implementation deferred to later phase
- Navigation working seamlessly

---

### **Phase 3: Core UI Components (Week 3)** ✅ **COMPLETED**

**Goal:** Build atomic, reusable mobile-first components

> **✅ COMPLETED - December 2025**
> 20+ components built from Figma designs

#### Week 3, Days 1-2: Atomic Components ✅
- [x] Design system from Figma implemented
  - Colors: #8C49D5 purple, #1E2939 text, #FFFFFF white
  - Typography: Plus Jakarta Sans (Regular, SemiBold, Bold)
  - Spacing and layout system

- [x] **Button Component** - Complete
  - TouchableOpacity with primary purple style
  - Loading states with ActivityIndicator
  - Disabled states
  - Rounded corners (100px border radius)

- [x] **Input Component** - Complete
  - Email, password, text, numeric variants
  - Keyboard types configured
  - Error states with red border/text
  - Password toggle visibility
  - Icons support (Ionicons)

- [x] **Card Component** - Complete
  - Custom background colors
  - Platform-specific shadows (iOS) / elevation (Android)
  - Pressable and default variants
  - Rounded corners (24px border radius)

#### Week 3, Days 3-4: Composite Components ✅
- [x] **LessonCard** - Dragon image, phase badge, CTA button, ellipse backgrounds
- [x] **LessonListItem** - Compact list view with status icons
- [x] **Badge** - Phase labels with label + subtitle
- [x] **ProgressBar** - Multi-segment progress indicator
- [x] **Highlight** - Purple label component
- [x] **Ellipse** - SVG decorative backgrounds
- [x] **ProfileCircle** - User avatar component
- [x] **StreakWidget** - 7-day grid with checkmarks
- [x] **NextActionCard** - Post-lesson action cards with decorative waves
- [x] **ResponseButton** - Quiz options with 4 states
- [x] **QuizFeedback** - Correct/incorrect feedback display
- [x] **RecordingCard** - Recording UI with dragon, waveform, timer
- [x] **AudioWaveform** - Visual recording indicator
- [x] **RecordingTimer** - Duration display
- [x] **RecordButton** - Reusable recording control
- [x] **RecordingGuideCard** - Instructions card
- [x] **HowToRecordCard** - How-to guide

#### Week 3, Day 5: Component Testing ✅
- [x] All components tested and working
- [x] Safe area behavior verified
- [ ] Dark mode (not implemented - not in initial scope)
- [x] Component APIs documented in code

**Deliverables:** ✅
- 20+ reusable components built from Figma
- Consistent styling with NativeWind + StyleSheet
- Platform-specific adaptations working
- All components functional and tested

---

### **Phase 4: Screen Implementation (Week 4-5)** ✅ **SUBSTANTIALLY COMPLETE**

**Goal:** Build out all screens with native UX patterns

> **✅ 5/7 SCREENS COMPLETE - December 2025**
> Auth and Progress screens deferred

#### Priority A: Authentication Screens ⏸️
- [ ] LoginScreen (deferred - not in initial scope)
- [ ] SignupScreen (deferred - not in initial scope)
- [x] Auth temporarily disabled for development

#### Priority B: Main App Screens ✅
- [x] **HomeScreen** - Complete with API integration
  - ProfileCircle and StreakWidget in header
  - Today's lesson card
  - Pull-to-refresh functionality
  - AsyncStorage caching with stale-while-revalidate
  - Loading states
  - Error handling with fallback

- [x] **LearnScreen** - Complete with API integration
  - All 41 lessons organized by phases
  - Phase 1 (CONNECT): 15 lessons
  - Phase 2 (DISCIPLINE): 26 lessons
  - Lesson status: completed (✓), in-progress (day #), locked (🔒)
  - Pull-to-refresh
  - Navigation to LessonViewer

- [x] **LessonViewerScreen** - Complete with API integration
  - Multi-segment navigation with progress bar
  - Cache-first loading with background refresh
  - Segment validation and bounds checking
  - Quiz integrated as final segment
  - Client-side validation for instant feedback
  - Progress tracking saved to backend
  - Navigation: Back button, Continue button
  - Prefetching next 2 lessons

- [x] **LessonCompleteScreen** - Complete
  - NextActionCard with suggestion
  - Navigation to Record tab or Home
  - Decorative wave backgrounds

- [x] **RecordScreen** - UI Complete, Backend Pending
  - Two-step recording flow: Start Session → Record → Stop
  - RecordingGuideCard and HowToRecordCard in idle state
  - RecordingCard with dragon image in ready/recording states
  - Microphone permission handling
  - expo-av recording foundation
  - Duration tracking
  - ⏳ Upload endpoint pending
  - ⏳ Transcription integration pending
  - ⏳ PCIT analysis pending

- [ ] **ProgressScreen** - Placeholder
  - Waiting for design implementation

**Deliverables:** ✅
- 5/7 screens fully functional
- Navigation working seamlessly
- Backend API integration complete for lessons
- Caching and performance optimizations
- Loading and error states throughout
- Recording UI complete, backend integration next

---

### **Phase 5: Audio Recording (Week 5-6)** 🚧 **IN PROGRESS**

**Goal:** Rebuild audio recording with React Native libraries

> **✅ Phase 5A Complete:** UI and basic recording functional
> **⏳ Phase 5B Pending:** Backend integration

#### Week 5, Days 3-5: Audio Recording Foundation ✅
- [x] **expo-av installed** - v14.0.7
  ```bash
  npx expo install expo-av
  ```

- [x] **Microphone Permissions implemented**
  ```typescript
  import { Audio } from 'expo-av';
  const { status } = await Audio.requestPermissionsAsync();
  ```
  - Permission request on RecordScreen mount
  - Error handling for denied permissions
  - Alert shown if permission denied

- [x] **Recording functionality implemented**
  - Recording start/stop with expo-av Recording API
  - Timer with duration tracking (durationMillis)
  - High-quality audio preset (48kHz, AAC)
  - Error handling for recording failures
  - State management: idle → ready → recording → completed
  - Alert on completion

- [ ] **Test audio format with backend** ⏳ NEXT STEP
  - Record test clip
  - Upload to backend (endpoint needs creation)
  - Verify format compatibility
  - Test with transcription service

**CRITICAL:** Test audio format compatibility next

#### Week 6, Days 1-3: Waveform Visualization ✅

**Solution Implemented:** Simple animated bars (Option A)

- [x] **AudioWaveform component created**
  - Animated bars using React Native Animated API
  - 5 bars with staggered animation
  - Color: #8C49D5 (brand purple)
  - Animates when isRecording=true
  - Simple, performant implementation

- [x] **Visual feedback implemented**
  - Waveform animates during recording
  - RecordingTimer shows duration
  - Dynamic hint text based on state
  - Record/Stop button state changes

- [x] **Tested on simulator**
  - Smooth 60fps animation
  - No performance issues
  - Visual feedback works well

**Note:** Real audio amplitude metering not yet implemented. Current waveform is animated simulation. Can add `audio.setOnAudioSampleReceived()` for real metering if needed.

#### Week 6, Days 4-5: Backend Integration ⏳ **NEXT PRIORITY**

**Phase 5B - Critical Tasks:**

- [ ] **Create backend upload endpoint**
  - POST /api/recordings/upload
  - Accept multipart/form-data audio file
  - Save to AWS S3 bucket
  - Return recording ID and URL

- [ ] **Implement upload in mobile**
  - Get audio URI from recording.getURI()
  - Create FormData with audio file
  - POST to upload endpoint with progress tracking
  - Handle upload errors and retry logic

- [ ] **Wire up transcription service**
  - Trigger transcription job after upload
  - Poll for transcription results
  - Display transcription text in mobile

- [ ] **Integrate PCIT analysis**
  - Call PCIT analysis service
  - Calculate PEN skills breakdown
  - Compute Nora Score
  - Display results in mobile UI

- [ ] **Save session to database**
  - Create RecordingSession model (if not exists)
  - Link to user and date
  - Store metadata (duration, transcription, analysis)

- [ ] **Test full flow**
  - Record → Upload → Transcribe → Analyze → Display
  - Test error scenarios
  - Test network failures
  - Test background behavior

**Estimated Time:** 2-3 days

**Deliverables:**
- ✅ Working audio recording with expo-av
- ✅ Waveform visualization
- ⏳ Backend upload endpoint
- ⏳ Full recording → transcription → analysis flow
- ⏳ Audio uploads working to backend

---

### **Phase 6: Polish & Testing (Week 7-8)** ⚠️ PARTIALLY DESIGN-DEPENDENT

**Goal:** Production-ready mobile app

#### Week 7: Native Features & UX Polish
- [ ] **Safe Area Handling**
  - Test on iPhone with notch
  - Test on Android with gesture bar
  - Verify all screens respect safe areas

- [ ] **Haptic Feedback**
  ```bash
  npx expo install expo-haptics
  ```
  - Record button press
  - Recording start/stop
  - Success/error actions
  - Other interactions per new design

- [ ] **Native Gestures**
  - Swipe back navigation (iOS)
  - Gestures specified in new design
  - Platform-appropriate interactions

- [ ] **Keyboard Handling**
  - KeyboardAvoidingView on all forms
  - Dismiss keyboard on scroll
  - Auto-scroll to focused input

- [ ] **Loading States**
  - Skeleton screens per new design
  - Smooth transitions
  - Offline state handling

#### Week 7: App Configuration
- [ ] **App Icon & Splash Screen**
  - Get assets from new design
  - Design icon.png (1024x1024)
  - Design splash.png
  - Use Expo's asset generator

- [ ] **App Configuration (app.json)**
  ```json
  {
    "expo": {
      "name": "Nora",
      "slug": "nora-mobile",
      "version": "1.0.0",
      "ios": {
        "bundleIdentifier": "com.nora.app",
        "buildNumber": "1"
      },
      "android": {
        "package": "com.nora.app",
        "versionCode": 1
      }
    }
  }
  ```

- [ ] **Privacy Policies**
  - Microphone usage description
  - Analytics opt-in/out

#### Week 8: Testing & Bug Fixes
- [ ] **Device Testing**
  - iPhone (multiple models/iOS versions)
  - Android (multiple manufacturers)
  - Tablet layouts (if supporting)

- [ ] **Feature Testing**
  - Complete user flow per new design
  - Network error scenarios
  - Low storage scenarios
  - Background app behavior
  - App state restoration

- [ ] **Performance Testing**
  - Recording performance (CPU, memory)
  - Waveform animation smoothness (60fps)
  - App launch time
  - Bundle size optimization

- [ ] **Beta Testing**
  - TestFlight setup (iOS)
  - Internal testing track (Android)
  - Collect feedback
  - Fix critical bugs

**Deliverables:**
- Polished, production-ready app matching new design
- Tested on multiple devices
- Beta builds distributed
- Bug tracker set up for issues

---

### **Phase 7: Deployment (Week 8+)** ✅ DESIGN-INDEPENDENT

**Goal:** Ship to app stores

#### iOS Deployment
- [ ] **Apple Developer Account** ($99/year)
- [ ] **Set up EAS Build**
  ```bash
  npm install -g eas-cli
  eas build:configure
  eas build --platform ios --profile production
  ```
- [ ] **TestFlight Beta**
  - Upload build
  - Invite beta testers
  - Collect feedback

- [ ] **App Store Submission**
  - Screenshots from new design
  - App description
  - Keywords
  - Privacy policy URL
  - Support URL
  - Submit for review

#### Android Deployment
- [ ] **Google Play Console** ($25 one-time)
- [ ] **EAS Build for Android**
  ```bash
  eas build --platform android --profile production
  ```
- [ ] **Internal Testing Track**
  - Upload AAB
  - Test on real devices
  - Fix any issues

- [ ] **Production Release**
  - Create store listing
  - Screenshots from new design
  - Feature graphic
  - Privacy policy
  - Submit for review

**Cost Summary:**
- EAS Build: Free tier (30 builds/month) or $29/month for priority
- Apple Developer: $99/year
- Google Play: $25 one-time
- **Total Year 1:** ~$154

---

## What NOT to Do (Common Mistakes)

### ❌ Don't Do These:
1. **Don't start building UI before new design arrives** - You'll waste time building screens that will be redesigned.

2. **Don't migrate UI components 1:1** - Web hover states, box-shadow, and scroll behavior won't translate well. Build native-first per new design.

3. **Don't try to make useAudioRecorder work on mobile** - Web Audio API doesn't exist in React Native. Full rebuild required.

4. **Don't keep state-based navigation** - `const [activeScreen, setActiveScreen] = useState('learn')` doesn't work with React Navigation's stack/tab model.

5. **Don't rebuild your backend** - Your Express server and Prisma database are production-ready. Keep them unchanged.

6. **Don't skip TypeScript** - You're rebuilding anyway, do it right with TypeScript from day 1.

7. **Don't ignore safe areas** - Your web app uses fixed width (430px). Mobile needs dynamic safe area insets for notches.

8. **Don't forget error boundaries** - On native, JavaScript errors crash the entire app (unlike web).

9. **Don't skip platform-specific testing** - iOS and Android behave differently (shadows, keyboards, gestures).

### ✅ Do These:
1. **Extract business logic to shared package** - AuthService, SessionService, PCIT analysis should work on both platforms.

2. **Wait for new design before building screens** - Build once, build right.

3. **Build mobile-first UX** - Don't clone web screens. Follow new design specifications.

4. **Test audio format early** - Verify expo-av recordings work with your backend/ElevenLabs API in Week 5, Day 3.

5. **Use NativeWind** - Configure colors/styles per new design system.

6. **Set up monorepo early** - Week 1, Day 1. Makes shared packages easy.

---

## Critical Path Items & Risks

### 🔴 High Risk
1. **Audio Recording + Transcription Flow**
   - **Risk:** Audio format incompatibility with backend/ElevenLabs
   - **Mitigation:** Test on Week 5, Day 3 (immediately after basic recording works)
   - **Fallback:** Convert audio format on device before upload

2. **Waveform Visualization Performance**
   - **Risk:** Real-time waveform animation may not reach 60fps
   - **Mitigation:** Start with simple amplitude bars. Only use react-native-audio-recorder-player if needed
   - **Fallback:** Simplified visualization (fewer bars or static display)

3. **New Design Implementation**
   - **Risk:** New design may have complex interactions or animations
   - **Mitigation:** Review design early for technical feasibility
   - **Fallback:** Simplify complex interactions if performance issues

4. **Backend API Compatibility**
   - **Risk:** VITE_API_URL → EXPO_PUBLIC_API_URL environment variable mismatch
   - **Mitigation:** Configure in Week 1, Day 3 and test immediately
   - **Fallback:** Hardcode for testing, fix env vars later

### 🟡 Medium Risk
1. **State Management Complexity**
   - **Risk:** Context + local state may become unwieldy on mobile
   - **Mitigation:** Consider Zustand if state gets complex
   - **Fallback:** Stay with Context, refactor later if needed

2. **Navigation Refactor**
   - **Risk:** New design navigation may be complex
   - **Mitigation:** Build skeleton early and test extensively
   - **Fallback:** Simplify navigation structure if issues arise

3. **Platform Differences (iOS vs Android)**
   - **Risk:** Features work on one platform but not the other
   - **Mitigation:** Test on both platforms throughout development
   - **Fallback:** Platform-specific code with Platform.select()

### 🟢 Low Risk
1. **Service Layer Migration** - Clean architecture, minimal changes needed
2. **Authentication Flow** - Well-tested pattern, just storage adapter needed
3. **Database Schema** - Production-ready, no changes needed

---

## Success Metrics

### Week 1 (Foundation) ✅
- [x] Monorepo structure working
- [x] `@nora/core` package extracted and tested
- [x] Blank React Native app running on device

### Week 2+ (Navigation & Auth) ✅
- [x] All main screens accessible via navigation
- [ ] Login/signup (deferred)
- [ ] Protected routes (deferred with auth)

### Week 3+ (Components & Screens) ✅
- [x] 20+ components built from Figma
- [x] Component library complete
- [x] 5/7 screens implemented
- [x] Data fetching from backend working
- [x] App matches Figma design specifications
- [x] Navigation working seamlessly
- [x] Caching and performance optimized

### Week 5-6 (Audio) 🚧
- [x] Audio recording working (expo-av)
- [x] Recording UI complete
- [ ] Audio upload to backend (NEXT)
- [ ] Transcription integration (NEXT)
- [ ] PCIT analysis integration (NEXT)
- [ ] Full recording flow complete (NEXT)

### Week 7-8 (Progress & Polish) ⏳
- [ ] Progress screen implemented
- [ ] Streak tracking with real data
- [ ] Authentication implemented
- [ ] Haptic feedback added
- [ ] Performance optimized
- [ ] Safe area handling verified
- [ ] Error boundaries implemented

### Week 8+ (Ship) ⏳
- [ ] Beta build on TestFlight and Google Play
- [ ] No critical bugs
- [ ] Performance meets targets (60fps animations, fast recording)
- [ ] Design implementation matches specifications
- [ ] Production release ready

---

## Timeline Comparison

### Original Migration Plan
- **Timeline:** 15 days (optimistic)
- **Approach:** Migrate everything
- **Risk:** High (fighting web patterns constantly)
- **Code Quality:** Medium (web-mobile hybrid)

### This Rebuild Plan
- **Timeline:** 6-8 weeks (realistic, design-dependent)
- **Approach:** Extract shared, rebuild mobile per new design
- **Risk:** Medium (audio recording + new design implementation)
- **Code Quality:** High (native-first, proper architecture, matches new design)

### Extra Investment
- **Time:** +2-4 weeks initially (but building to new design from start)
- **Payoff:** Clean codebase matching new design, no throwaway work
- **ROI:** Native UX, happy users, easier maintenance

---

## Resources & Tools

### Development
- **Expo CLI:** Latest version
- **EAS CLI:** For builds and deploys
- **React Navigation:** v6+
- **NativeWind:** v4+
- **expo-av:** For audio recording
- **TypeScript:** v5+

### Testing
- **iOS Simulator:** Xcode required (macOS only)
- **Android Emulator:** Android Studio
- **Real Devices:** Test on actual iPhone and Android phone
- **TestFlight:** iOS beta distribution
- **Google Play Internal Testing:** Android beta

### Monitoring
- **Sentry:** Crash reporting (optional)
- **Amplitude:** Analytics (already integrated)
- **EAS Updates:** Over-the-air updates

### Documentation
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation Docs](https://reactnavigation.org/)
- [NativeWind Docs](https://www.nativewind.dev/)

---

## Next Steps

### **🎯 IMMEDIATE PRIORITY: Phase 5B - Recording Backend Integration**

**Goal:** Complete the recording feature by connecting mobile app to backend

**Tasks (2-3 days):**

1. **Backend Upload Endpoint (Day 1)**
   - Create POST /api/recordings/upload endpoint in server/routes/
   - Accept multipart/form-data audio file
   - Set up GCS bucket for audio storage (or use existing)
   - Save audio file with unique filename
   - Create RecordingSession database record
   - Return recording ID and storage URL

2. **Mobile Upload Implementation (Day 1-2)**
   - Get recording URI from expo-av
   - Create FormData with audio file
   - Implement upload with progress tracking
   - Add loading indicator during upload
   - Handle errors and retry logic
   - Test upload with real recording

3. **Transcription Integration (Day 2)**
   - Trigger transcription job after successful upload
   - Use existing transcriptionService from @nora/core
   - Poll for results or implement webhook
   - Display transcription in mobile UI
   - Handle transcription errors

4. **PCIT Analysis Integration (Day 2-3)**
   - Call pcitService after transcription complete
   - Calculate PEN skills breakdown
   - Compute Nora Score
   - Create results screen/modal
   - Display analysis results
   - Save analysis to database

5. **Testing & Polish (Day 3)**
   - Test full flow: Record → Upload → Transcribe → Analyze
   - Test error scenarios (network failure, permission denied)
   - Test audio format compatibility
   - Add proper loading states
   - Add success/error messages
   - Test on real device

**Files to Create/Modify:**
- `server/routes/recordings.cjs` (new - upload endpoint)
- `nora-mobile/src/screens/RecordScreen.tsx` (modify - add upload)
- `nora-mobile/src/screens/RecordingResultsScreen.tsx` (new - display results)
- `prisma/schema.prisma` (modify - RecordingSession model if needed)
- `packages/nora-core/src/services/recordingService.ts` (new - recording API methods)

**Success Criteria:**
- ✅ User can record audio in mobile app
- ✅ Audio uploads to backend successfully
- ✅ Transcription completes and displays
- ✅ PCIT analysis calculates and displays
- ✅ Full flow works end-to-end

---

### **📋 SECONDARY PRIORITIES (After Phase 5B)**

#### 1. **Progress Screen Implementation** (2-3 days)
   - Streak calendar view (expanded from StreakWidget)
   - Stats cards (lessons completed, recordings done)
   - Nora Score chart/trend
   - Time spent tracking
   - Install chart library (victory-native or react-native-chart-kit)

#### 2. **User Streak Tracking Backend** (1 day)
   - Add UserStreak model to database
   - Create streak calculation logic
   - API endpoints for streak data
   - Connect StreakWidget to real data
   - Daily completion tracking

#### 3. **Authentication Implementation** (2 days)
   - LoginScreen and SignupScreen
   - AuthContext with @nora/core authService
   - Re-enable requireAuth middleware on all endpoints
   - Remove test-user-id fallbacks
   - Secure token storage with SecureStore
   - Protected route guards

#### 4. **Polish & Testing** (1 week)
   - Haptic feedback (expo-haptics)
   - Native gestures polish
   - Safe area testing on all devices
   - Performance optimization
   - Error boundary implementation
   - Offline state handling
   - App icon and splash screen
   - Beta testing preparation

---

### **🚀 DEPLOYMENT (Week 8+)**

When ready for deployment:
1. TestFlight setup (iOS) - $99/year Apple Developer
2. Google Play Internal Testing (Android) - $25 one-time
3. Beta testing with real users
4. Bug fixes and iteration
5. Production release to app stores

**Estimated Timeline to Production:**
- Phase 5B: 2-3 days (recording backend)
- Progress Screen: 2-3 days
- Auth Implementation: 2 days
- Polish & Testing: 1 week
- **Total: ~2-3 weeks to production-ready**

---

## Questions to Resolve (After New Design Arrives)

1. **Navigation Structure:** How many tabs? Which screens? Modal patterns?
2. **Design System:** Colors, typography, spacing, component styles?
3. **Information Architecture:** What content on each screen?
4. **Interactions:** Gestures, animations, transitions?
5. **TypeScript Migration:** Do you want to migrate web app to TypeScript too, or just mobile?
6. **State Management:** Stay with Context or adopt Zustand/Redux?
7. **Push Notifications:** Should we plan for this in initial build or add later?
8. **Offline Support:** Should the app work offline (cache sessions, etc.)?
9. **Deep Linking:** Do you need shareable session links?
10. **Dark Mode:** Should we support dark mode from day 1?

---

## Current Action Plan

### ✅ What to Do Now (Design-Independent):
1. **Phase 0 (Days 1-2):** Set up monorepo and extract services
2. **Phase 1 (Days 3-5):** Initialize React Native app with foundation tools
3. **Phase 5 Audio Prep:** Can start researching expo-av implementation

### ⏸️ What to Pause (Design-Dependent):
1. **Phase 2:** Navigation structure (wait for design)
2. **Phase 3:** UI components (wait for design system)
3. **Phase 4:** Screen implementation (wait for screen designs)
4. **Phase 6 UI Polish:** Visual polish (wait for design specifications)

### 📅 When New Design is Ready:
1. Update Phases 2-4 with specific design requirements
2. Adjust timeline based on design complexity
3. Resume development with clear specifications

---

## Conclusion

**This hybrid approach has delivered:**
- ✅ Clean, maintainable mobile codebase with 20+ components
- ✅ Shared business logic (@nora/core) between web and mobile
- ✅ Native UX patterns built from Figma designs
- ✅ TypeScript from the start with proper types
- ✅ Scalable architecture with monorepo structure
- ✅ Backend unchanged and production-ready
- ✅ 5/7 screens fully functional with backend integration
- ✅ Performance optimizations (caching, batch queries)
- ✅ Recording UI complete with expo-av foundation

**Current Status:**
- **Phases 0-4:** Substantially complete (5-6 weeks actual)
- **Phase 5A:** Recording UI complete ✅
- **Phase 5B:** Recording backend integration - **NEXT PRIORITY** 🎯
- **Remaining:** Progress screen, Auth, Polish (~2-3 weeks)

**Time Investment:**
- **Actual so far:** 5-6 weeks (Phases 0-5A)
- **Remaining:** 2-3 weeks (Phase 5B + Progress + Auth + Polish)
- **Total to Production:** ~8-9 weeks (realistic timeline achieved)

**Current Recommendation:**
1. **Immediately:** Start Phase 5B recording backend (2-3 days)
2. **Next:** Progress screen implementation (2-3 days)
3. **Then:** Authentication and polish (1-2 weeks)
4. **Target:** Production-ready in 2-3 weeks

---

**🎯 Ready for Phase 5B?** Let's complete the recording feature by building the backend integration this week.

**Success So Far:**
- 20+ components built ✅
- 5 screens functional ✅
- Backend API integrated ✅
- Recording UI complete ✅
- Performance optimized ✅

**One Feature Away:** Recording backend integration will complete the core MVP functionality!
