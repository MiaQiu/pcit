# Nora Mobile App Development Plan - REVISED
## Hybrid Approach: Rebuild Mobile + Extract Shared Services

> **⚠️ STATUS: PENDING NEW UI DESIGN**
>
> This plan is based on the current prototype UI. A new UI design is expected in a few days that may have:
> - Different number of navigation items
> - Different screen layouts
> - Different information architecture
>
> **Current Recommendation:** Complete Phase 0 only (extract shared services). Pause all UI work until new design arrives, then update this plan accordingly.
>
> **Last Updated:** 2025-11-30

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

### **Phase 0: Pre-Migration Setup (Week 1, Days 1-2)** ✅ SAFE TO START NOW

**Goal:** Set up monorepo structure and extract shared services

> **✅ This phase is design-independent and can proceed immediately**

#### Day 1: Monorepo Setup
- [ ] Initialize monorepo structure (use npm workspaces or yarn workspaces)
- [ ] Create `packages/nora-core` package
- [ ] Set up TypeScript configuration for shared package
- [ ] Configure path aliases (`@nora/core`)
- [ ] Set up ESLint/Prettier for consistency

#### Day 2: Extract Core Services
- [ ] Create storage adapter pattern:
  ```typescript
  // packages/nora-core/adapters/storage.ts
  interface StorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }
  ```
- [ ] Refactor authService.js → authService.ts (platform-agnostic)
- [ ] Extract sessionService, pcitService, transcriptionService
- [ ] Extract utility functions (formatters, validators)
- [ ] Create TypeScript type definitions
- [ ] Test services still work with web app

**Deliverables:**
- Working monorepo structure
- Shared `@nora/core` package
- Web app still functional, importing from core

---

### **Phase 1: Mobile Foundation (Week 1, Days 3-5)** ✅ SAFE TO START NOW

**Goal:** Get a blank React Native app running with proper tooling

> **✅ This phase is design-independent and can proceed immediately**

#### Tasks
1. **Initialize Project (TypeScript + Expo)**
   ```bash
   npx create-expo-app@latest nora-mobile --template blank-typescript
   cd nora-mobile
   ```

2. **Install NativeWind (Tailwind for React Native)**
   ```bash
   npm install nativewind
   npm install --save-dev tailwindcss
   npx tailwindcss init
   ```
   - Configure `tailwind.config.js` (colors TBD from new design)
   - Set up NativeWind in `babel.config.js`

3. **Install Core Navigation**
   ```bash
   npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
   npx expo install react-native-screens react-native-safe-area-context
   ```

4. **Install Storage Libraries**
   ```bash
   npx expo install expo-secure-store @react-native-async-storage/async-storage
   ```

5. **Link to Shared Core**
   ```bash
   npm install @nora/core
   # Configure workspace to use local package
   ```

6. **Set Up Environment Variables**
   - Create `.env` file
   - Configure `EXPO_PUBLIC_API_URL` (replaces `VITE_API_URL`)
   - Add environment variable loading

7. **Configure Error Boundaries**
   - Install error boundary library or create custom
   - Set up crash reporting (consider Sentry)

8. **Test Basic Setup**
   ```bash
   npx expo start
   ```
   - Test on iOS simulator
   - Test on Android emulator
   - Verify hot reload works

**Deliverables:**
- Blank React Native app running on device/simulator
- NativeWind configured and tested
- Navigation libraries installed
- Connected to shared `@nora/core` package
- Environment variables working

---

### **⏸️ PAUSE POINT: Wait for New UI Design**

**Before proceeding to Phase 2+, we need:**
1. Final UI design specifications
2. Navigation structure (how many tabs? which screens?)
3. Information architecture (what content on each screen?)
4. Screen flow diagrams
5. Design system (colors, typography, spacing)

**Once new design arrives, update the following phases accordingly.**

---

### **Phase 2: Authentication & Navigation Skeleton (Week 2)** ⚠️ PENDING DESIGN

**Goal:** Create the app structure and authentication flow

> **⚠️ Navigation structure depends on new design specifications**

#### Week 2, Days 1-2: Navigation Architecture
- [ ] **WAIT FOR DESIGN:** Determine navigation structure from new design
  - How many tabs?
  - Which screens?
  - Modal vs. stack navigation?
  - Deep linking requirements?

- [ ] Create navigation structure based on new design
- [ ] Create placeholder screens (View + Text only)
- [ ] Set up navigation types for TypeScript
- [ ] Configure safe area context for notches/gesture bars
- [ ] Test navigation flow (stack push/pop, tab switching)

#### Week 2, Days 3-4: Authentication Implementation
- [ ] Create mobile storage adapter:
  ```typescript
  // nora-mobile/src/adapters/mobileStorage.ts
  import * as SecureStore from 'expo-secure-store';
  import AsyncStorage from '@react-native-async-storage/async-storage';

  export const secureStorage: StorageAdapter = {
    async getItem(key) { return await SecureStore.getItemAsync(key); },
    async setItem(key, value) { await SecureStore.setItemAsync(key, value); },
    async removeItem(key) { await SecureStore.deleteItemAsync(key); },
  };
  ```
- [ ] Create AuthContext for mobile (similar to web)
- [ ] Wire up authService from `@nora/core` with mobile storage
- [ ] Remove mock authentication
- [ ] Implement login form (based on new design)
- [ ] Implement signup form (based on new design)
- [ ] Test authentication flow end-to-end

#### Week 2, Day 5: Protected Routes & State
- [ ] Implement protected route navigation guards
- [ ] Set up global state management (Context or Zustand)
- [ ] Configure Amplitude analytics for mobile
- [ ] Test authenticated vs. unauthenticated navigation

**Deliverables:**
- Complete navigation architecture (based on new design)
- Working authentication (login/signup/logout)
- Protected routes enforcing auth
- Smooth transitions between auth states

---

### **Phase 3: Core UI Components (Week 3)** ⚠️ PENDING DESIGN

**Goal:** Build atomic, reusable mobile-first components

> **⚠️ Component design depends on new design system**

#### Week 3, Days 1-2: Atomic Components
- [ ] **WAIT FOR DESIGN:** Get design system specifications
  - Colors, typography, spacing
  - Button styles and variants
  - Input field styles
  - Card styles

- [ ] **Button Component**
  ```tsx
  // Web: <button>
  // Mobile: <TouchableOpacity> or <Pressable>
  ```
  - Variants based on new design
  - Loading states
  - Disabled states
  - Haptic feedback on press

- [ ] **Input Component**
  ```tsx
  // Web: <input>
  // Mobile: <TextInput>
  ```
  - Email, password, text variants
  - Keyboard types (email-address, numeric, etc.)
  - Auto-capitalize controls
  - Error states
  - Style based on new design

- [ ] **Card Component**
  ```tsx
  // Web: <div> with shadow
  // Mobile: <View> with shadow (iOS) / elevation (Android)
  ```
  - Style based on new design
  - Platform-specific shadows
  - Touchable card variant

#### Week 3, Days 3-4: Composite Components
- [ ] **WAIT FOR DESIGN:** Determine which composite components are needed
- [ ] Build components based on new design specifications
- [ ] Custom tab bar (if needed by new design)
- [ ] Loading indicators
- [ ] Progress bars or other UI elements from new design

#### Week 3, Day 5: Component Testing & Storybook
- [ ] Test all components on iOS and Android
- [ ] Verify safe area behavior
- [ ] Test dark mode support (if planned)
- [ ] Document component APIs

**Deliverables:**
- Reusable component library matching new design
- Consistent styling with NativeWind
- Platform-specific adaptations working
- Components tested on both platforms

---

### **Phase 4: Screen Implementation (Week 4-5)** ⚠️ PENDING DESIGN

**Goal:** Build out all screens with native UX patterns

> **⚠️ All screen implementation depends on new design specifications**

#### Priority A: Authentication Screens (Week 4, Days 1-2)
- [ ] **WAIT FOR DESIGN:** Get login/signup screen designs
- [ ] Implement based on new design specs
- [ ] Test authentication flow

#### Priority B: Main App Screens (Week 4-5)
- [ ] **WAIT FOR DESIGN:** Get all screen designs and specifications
- [ ] Determine screen priority based on new design
- [ ] Implement screens based on new design
- [ ] Wire up data fetching
- [ ] Implement loading and error states

**Note:** Screen list and priorities will be updated once new design is available.

**Deliverables:**
- All screens implemented per new design
- Navigation between screens working
- Data fetching from backend working
- Loading and error states handled

---

### **Phase 5: Audio Recording (Week 5-6)** ✅ DESIGN-INDEPENDENT (mostly)

**Goal:** Rebuild audio recording with React Native libraries

> **✅ Core audio functionality is design-independent**
>
> **⚠️ UI presentation of waveform/recording controls depends on new design**

#### Week 5, Days 3-5: Audio Recording Foundation
- [ ] **Install expo-av**
  ```bash
  npx expo install expo-av
  ```

- [ ] **Request Microphone Permissions**
  ```typescript
  import { Audio } from 'expo-av';

  const { status } = await Audio.requestPermissionsAsync();
  ```

- [ ] **Create useAudioRecorder hook (mobile version)**
  - Recording start/stop
  - Timer (elapsed time, max duration)
  - Audio blob generation
  - Error handling
  - Auto-stop at max duration (5 minutes)

- [ ] **Test Basic Recording**
  - Record 10-second clip
  - Upload to backend
  - Verify audio format compatibility
  - Test with ElevenLabs transcription API

**CRITICAL:** Test audio format compatibility with backend/ElevenLabs on Day 3

#### Week 6, Days 1-3: Waveform Visualization

**Challenge:** Web uses `AudioContext` to draw waveforms. `expo-av` only provides amplitude metering (volume levels).

**Solution Options:**

1. **Option A: Simple Amplitude Bars (Recommended)**
   - Use `audio.setOnAudioSampleReceived()` for metering
   - Animate bars based on volume levels
   - Visual style TBD from new design
   - Simple, performant

2. **Option B: Advanced Waveform with Prebuild**
   - Install `react-native-audio-recorder-player`
   - Run `npx expo prebuild` (ejects to bare workflow)
   - More features but added complexity

**Implementation:**
- [ ] **WAIT FOR DESIGN:** Get recording screen UI design
- [ ] Implement waveform visualization per new design (start with Option A)
- [ ] Test performance on real devices
- [ ] Add visual feedback for recording state
- [ ] If performance issues, consider Option B

#### Week 6, Days 4-5: Integration & Testing
- [ ] Wire up recording to transcription service
- [ ] Integrate PCIT analysis
- [ ] Display results per new design
- [ ] Implement save session functionality
- [ ] Test full recording flow end-to-end
- [ ] Test error scenarios (permission denied, network errors)
- [ ] Test background behavior (what if user switches apps?)

**Deliverables:**
- Working audio recording with expo-av
- Waveform visualization matching new design
- Full recording → transcription → analysis flow
- Audio uploads working to backend

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

### Week 1 (Foundation)
- [ ] Monorepo structure working
- [ ] `@nora/core` package extracted and tested
- [ ] Blank React Native app running on device

### After New Design Arrives
- [ ] Navigation structure matches new design
- [ ] Component library matches new design system
- [ ] All screens implemented per new design

### Week 2+ (Navigation & Auth)
- [ ] All screens accessible via navigation (per new design)
- [ ] Login/signup working end-to-end
- [ ] Protected routes enforcing authentication

### Week 4+ (Screens)
- [ ] All screens implemented per new design
- [ ] Data fetching from backend working
- [ ] App matches new design specifications

### Week 6 (Audio)
- [ ] Audio recording working
- [ ] Transcription successful
- [ ] PCIT analysis displaying
- [ ] Full user flow complete

### Week 8 (Ship)
- [ ] Beta build on TestFlight and Google Play
- [ ] No critical bugs
- [ ] Performance meets targets (60fps animations, fast recording)
- [ ] Design implementation matches specifications

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

### Immediate Actions (This Week) ✅ SAFE TO START
1. **Complete Phase 0:** Extract services to `@nora/core` (design-independent)
2. **Complete Phase 1:** Set up blank React Native app (design-independent)
3. **Wait for new design:** Pause all UI work

### When New Design Arrives
1. **Review design specifications:**
   - Navigation structure (tabs, stacks, modals)
   - Screen list and priorities
   - Design system (colors, typography, spacing)
   - Component designs
   - Interaction patterns

2. **Update this plan:**
   - Revise Phase 2 navigation structure
   - Update Phase 3 component list
   - Update Phase 4 screen implementation priorities
   - Adjust timeline if needed

3. **Resume development:**
   - Proceed with Phase 2+ using new design specs

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

**This hybrid approach gives you:**
- ✅ Clean, maintainable mobile codebase
- ✅ Shared business logic between web and mobile
- ✅ Native UX patterns built per new design
- ✅ TypeScript from the start
- ✅ Scalable architecture
- ✅ Your excellent backend unchanged
- ✅ No throwaway work (wait for design before building UI)

**Time Investment:**
- 6-8 weeks (design-dependent timeline)
- Building to new design from day 1 = no rebuilding UI twice
- Extra time for proper architecture = years of easier maintenance

**Current Recommendation:**
1. Start Phase 0-1 immediately (design-independent foundation work)
2. Wait for new design before proceeding to Phase 2+
3. Update plan once design specifications are available

---

**Ready to start Phase 0?** Let's set up the monorepo and extract shared services this week.
