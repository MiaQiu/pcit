# Error UX Review & Recommendations for Nora

**Date:** 2025-12-30
**Status:** Review Complete - Actionable Recommendations Below

---

## Executive Summary

Current error handling is **functionally complete** but has **UX redundancies** that create friction. The main issue: **layering multiple error messages for the same problem** (e.g., NetworkStatusBar + Alert for network errors).

**Key Finding:** You're showing the right information, but in too many places at once.

---

## Current Implementation Analysis

### ✅ What's Working Well

1. **Comprehensive Coverage** - Errors are caught and handled across all critical paths
2. **Centralized Messages** - `errorMessages.ts` provides consistent, user-friendly copy
3. **Network Detection** - `NetworkMonitor` accurately detects offline vs server issues
4. **Auto-Retry Logic** - Backend automatically retries failed processing (3 attempts)
5. **Good Copywriting** - Messages follow the "what + why + how to fix" pattern

### ❌ Current UX Problems

#### **Problem 1: Redundant Network Error Display** ⚠️ HIGH PRIORITY

**Scenario:** User goes offline while browsing lessons

**What Happens:**
1. `NetworkStatusBar` slides up showing "No Internet Connection" (persistent, bottom)
2. User tries to load lessons
3. `Alert.alert` pops up: "Unable to Load Lessons - No internet connection..."

**Why It's Bad:**
- User already knows they're offline (from the bar)
- The modal forces them to tap "OK" to dismiss
- Creates frustration: "Yes, I know, you already told me!"

**Example Code:**
```typescript
// LearnScreen.tsx:123
Alert.alert('Unable to Load Lessons', errorMessage);
// This shows even when NetworkStatusBar is already visible
```

---

#### **Problem 2: Inconsistent Error Patterns**

Different screens use different UI patterns for the same errors:

| Screen | Network Error Pattern | Upload Error Pattern |
|--------|----------------------|---------------------|
| **LearnScreen** | Alert modal (blocking) | N/A |
| **RecordScreen** | Alert modal (blocking) | Alert modal (blocking) |
| **HomeScreen** | Silent fail (no UI) | Toast/Alert hybrid |
| **UploadProcessing** | Silent fail → retry | Eventually shows error |

**Why It's Bad:**
- Users can't build a mental model
- Same problem = different experiences

---

#### **Problem 3: Modal Alerts Overused**

`Alert.alert` is used for **transient errors** that should use toasts:

```typescript
// RecordScreen.tsx:290
Alert.alert('Recording Error', ErrorMessages.RECORDING.START_FAILED);
// This is a transient error - user just retries. No need for modal.
```

**Why It's Bad:**
- Modals are **blocking** - user must dismiss before continuing
- Best practice: Use modals only for **critical, unrecoverable** errors

---

#### **Problem 4: NetworkStatusBar Design Issues**

```typescript
// NetworkStatusBar.tsx:70
backgroundColor: '#FFC0CB', // Light pink
color: '#DC2626', // Dark red text
```

**Problems:**
- **Position:** Bottom (above tab bar) - Users expect network status at top
- **Color:** Pink background is too light, doesn't convey urgency
- **Persistence:** Never auto-dismisses when back online (only slides down)
- **Message:** "Server Failure" is too technical

---

#### **Problem 5: No Empty States**

When data fails to load, screens show:
- Loading spinner forever, OR
- Error modal, then blank screen

**What's Missing:**
- Friendly empty state with illustration
- Clear "Retry" button
- Context about what failed

---

## Recommended Error Patterns by Type

### Pattern 1: Network Errors (No Internet)

**Current:** NetworkStatusBar (bottom) + Alert modal
**Recommended:** NetworkStatusBar ONLY (improved design)

**Changes:**

1. **Remove Alert modals when network is down**
   ```typescript
   // LearnScreen.tsx - BEFORE
   } catch (err) {
     const errorMessage = handleApiError(err);
     Alert.alert('Unable to Load Lessons', errorMessage); // ❌ Remove this
   }

   // LearnScreen.tsx - AFTER
   } catch (err) {
     const errorMessage = handleApiError(err);
     setError(errorMessage); // ✅ Set state only
     // NetworkStatusBar already shows network issue
   }
   ```

2. **Improve NetworkStatusBar design**
   ```typescript
   // Move to top (iOS standard)
   position: 'absolute',
   top: 0, // Changed from bottom: 75

   // Better colors
   backgroundColor: '#FFA500', // Amber/orange (more standard)
   color: '#000000', // Black text for readability

   // Better messages
   case 'offline':
     return 'No Internet Connection';
   case 'server_down':
     return 'Connection Issue - Retrying...'; // Less technical
   ```

3. **Auto-dismiss when back online**
   ```typescript
   useEffect(() => {
     if (status === 'online' && previousStatus !== 'online') {
       // Show brief "Back Online" message, then hide
       setTimeout(() => slideDown(), 2000);
     }
   }, [status]);
   ```

---

### Pattern 2: Transient Errors (Recording, Upload, etc.) - WITH PROGRESSIVE ESCALATION

**Current:** Alert modal (blocking) every time
**Recommended:** Toast (non-blocking) → Modal with guidance → Support escalation

**Key Principle: Progressive Error Escalation**

When users retry and continue to fail, escalate the response:

```
Attempt 1-2:  Toast (non-blocking)
              ↓ "Couldn't start recording. Try again."
              User can immediately retry

Attempt 3:    Modal with troubleshooting
              ↓ "We're having trouble. Please check:
              • Microphone permissions
              • Storage space
              • Other apps using mic"

Attempt 4+:   Escalate to support
              ↓ "This might be a compatibility issue.
              [Contact Support] [Try Again] [Cancel]"
```

**Why This Works:**
- **First failures:** Could be temporary glitches (don't alarm user)
- **Repeated failures:** Likely a deeper issue (give troubleshooting help)
- **Persistent failures:** User needs expert help (escalate to support)

---

### Pattern 2A: Transient Errors (Recording, Upload, etc.)

**Current:** Alert modal (blocking)
**Recommended:** Progressive toast → modal → support escalation

**When to Use:**
- Recording failed to start
- Upload failed (will auto-retry)
- Form submission failed
- Temporary server issues

**Implementation:**
```typescript
// RecordScreen.tsx - BEFORE
Alert.alert('Recording Error', ErrorMessages.RECORDING.START_FAILED);

// RecordScreen.tsx - AFTER
showToast(ErrorMessages.RECORDING.START_FAILED, 'error');
// User sees error but can still navigate/retry
```

**Toast Design Guidelines:**
- 4-5 second duration (longer than success toasts)
- Red/orange background for errors
- Position at top (not bottom - that's for network bar)
- Auto-dismiss (no manual close needed)

---

### Pattern 3: Critical Errors (Permanent Failures)

**Current:** Alert modal (good!)
**Recommended:** Keep Alert modal, improve copy

**When to Use:**
- Processing failed permanently (after 3 retries)
- Account creation failed
- Payment failed
- Data loss risk

**Improved Copy:**
```typescript
// BEFORE
Alert.alert(
  'Processing Failed',
  'It looks like something went wrong. Please try recording again.'
);

// AFTER
Alert.alert(
  'We\'re Sorry',
  'Your recording couldn\'t be processed. Our team has been notified and will investigate.\n\nYou can try recording again, or contact support if this continues.',
  [
    { text: 'Contact Support', onPress: () => navigation.push('Support') },
    { text: 'Try Again', onPress: resetRecording }
  ]
);
```

---

### Pattern 4: Empty States (Load Failures)

**Current:** Blank screen after error
**Recommended:** Full-screen empty state

**When to Use:**
- Lessons failed to load
- No recordings yet
- Profile data unavailable

**Implementation:**
```typescript
// LearnScreen.tsx - Add empty state component

{error && !loading && (
  <View style={styles.emptyState}>
    <Image source={sadDragonIllustration} style={styles.emptyImage} />
    <Text style={styles.emptyTitle}>Couldn't Load Lessons</Text>
    <Text style={styles.emptyMessage}>{error}</Text>
    <TouchableOpacity
      style={styles.retryButton}
      onPress={() => loadLessons()}
    >
      <Text style={styles.retryButtonText}>Try Again</Text>
    </TouchableOpacity>
  </View>
)}
```

---

## Specific Recommendations by Screen

### 1. LearnScreen (Lesson List)

**Current Issues:**
- Shows alert modal when offline (redundant with NetworkStatusBar)
- No empty state after error

**Recommended Changes:**

```typescript
// Remove modal, rely on NetworkStatusBar + empty state
} catch (err) {
  console.error('Failed to load lessons:', err);
  const errorMessage = handleApiError(err);
  setError(errorMessage); // Store for empty state display
  // Don't show Alert.alert - NetworkStatusBar already visible if network issue
} finally {
  setLoading(false);
}

// Add empty state in render
{error && !loading && phases.length === 0 && (
  <EmptyState
    illustration="dragon_confused"
    title="Couldn't Load Lessons"
    message={error}
    primaryAction={{
      label: "Try Again",
      onPress: () => loadLessons()
    }}
  />
)}
```

---

### 2. RecordScreen (Recording)

**Current Issues:**
- Recording errors use blocking modals (should be toasts)
- Upload errors show modal even though processing will auto-retry
- No escalation pattern when user retries multiple times

**Recommended Changes - Progressive Error Escalation:**

```typescript
// Track user retry attempts in component state
const [recordingFailureCount, setRecordingFailureCount] = useState(0);
const [uploadManualRetryCount, setUploadManualRetryCount] = useState(0);

// START RECORDING ERROR - Progressive escalation
} catch (error) {
  console.error('Failed to start recording:', error);
  const newCount = recordingFailureCount + 1;
  setRecordingFailureCount(newCount);

  if (newCount === 1 || newCount === 2) {
    // First 2 failures: Non-blocking toast
    showToast(ErrorMessages.RECORDING.START_FAILED, 'error');
  } else if (newCount === 3) {
    // Third failure: Escalate to modal with troubleshooting
    Alert.alert(
      'Recording Issue',
      'We\'re having trouble starting the recording.\n\nPlease check:\n• Microphone permissions are enabled\n• No other apps are using the microphone\n• Your device has enough storage',
      [
        { text: 'Check Settings', onPress: () => Linking.openSettings() },
        { text: 'Try Again', onPress: startRecording }
      ]
    );
  } else {
    // 4+ failures: Escalate to support
    Alert.alert(
      'We\'re Sorry',
      'Recording continues to fail. This might be a device compatibility issue.',
      [
        { text: 'Contact Support', onPress: () => navigation.push('Support') },
        { text: 'Try Again', onPress: startRecording },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }
}

// Reset failure count on success
const handleRecordingStarted = () => {
  setRecordingFailureCount(0); // Reset on success
  // ... rest of logic
};

// UPLOAD ERROR - Progressive escalation
if (uploadFailed && autoRetriesRemaining > 0) {
  // System auto-retry in progress (no user action needed)
  showToast(ErrorMessages.PROCESSING.RETRY_IN_PROGRESS, 'warning');

} else if (uploadFailed && autoRetriesRemaining === 0 && uploadManualRetryCount === 0) {
  // First time showing modal after auto-retries exhausted
  Alert.alert(
    'Upload Failed',
    'We couldn\'t upload your recording after multiple attempts.\n\nThis is usually due to network issues. Please check your connection and try again.',
    [
      { text: 'Cancel', style: 'cancel', onPress: () => saveRecordingLocally() },
      {
        text: 'Retry',
        onPress: () => {
          setUploadManualRetryCount(1);
          retryUpload();
        }
      }
    ]
  );

} else if (uploadManualRetryCount === 1) {
  // User manually retried once, failed again
  Alert.alert(
    'Still Having Trouble',
    'The upload is still failing. Your recording is saved locally and won\'t be lost.\n\nWould you like to try again later or get help?',
    [
      { text: 'Try Later', style: 'cancel', onPress: () => saveForLater() },
      {
        text: 'Retry Again',
        onPress: () => {
          setUploadManualRetryCount(2);
          retryUpload();
        }
      }
    ]
  );

} else {
  // 2+ manual retries failed - escalate to support
  Alert.alert(
    'Upload Not Working',
    'We\'ve tried multiple times but can\'t upload your recording.\n\nYour recording is saved locally. Our support team can help troubleshoot this issue.',
    [
      {
        text: 'Contact Support',
        onPress: () => {
          // Pre-fill support form with error details
          navigation.push('Support', {
            prefillCategory: 'Upload Failed',
            prefillDescription: `Upload failed after ${autoRetryCount} auto-retries and ${uploadManualRetryCount} manual retries.\n\nRecording ID: ${recordingId}\nError: ${lastError}`
          });
        }
      },
      { text: 'Save for Later', onPress: () => saveForLater() },
      { text: 'Try Once More', onPress: retryUpload }
    ]
  );
}

// Reset manual retry count on success
const handleUploadSuccess = () => {
  setUploadManualRetryCount(0); // Reset on success
  // ... rest of logic
};
```

---

### 3. HomeScreen (Main Feed)

**Current Issues:**
- Network errors fail silently (no user feedback)
- Failed recordings should show inline card, not modal

**Recommended Changes:**

```typescript
// loadUserProfile - Add toast on failure
} catch (error) {
  console.log('Could not load user profile:', error);
  showToast('Couldn\'t load profile. Pull down to refresh.', 'warning');
}

// Failed recordings - Keep inline card approach (already good!)
// This is the RIGHT pattern for showing errors contextually
{recording.analysisStatus === 'FAILED' && (
  <FailedRecordingCard recording={recording} />
)}
```

---

### 4. UploadProcessingContext

**Current Issues:**
- Errors during polling are silent until timeout
- No user feedback on retry attempts

**Recommended Changes:**

```typescript
// Show toast on first retry
if (retryCount === 1) {
  showToast(ErrorMessages.PROCESSING.RETRY_IN_PROGRESS, 'info');
}

// Show toast when processing takes > 2 minutes
if (pollAttempts > 24) { // 24 * 5s = 2 minutes
  showToast(ErrorMessages.PROCESSING.TIMEOUT, 'warning');
}
```

---

## Implementation Priority

### Phase 1: Fix Redundancies + Network-Aware UI (2-3 hours) 🔥 HIGH IMPACT

#### Step 1: Create `useNetworkStatus` Hook (15 mins)

**File:** `nora-mobile/src/hooks/useNetworkStatus.ts` (NEW)

```typescript
import { useState, useEffect } from 'react';
import { networkMonitor, ConnectionStatus } from '../utils/NetworkMonitor';

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>(
    networkMonitor.getConnectionStatus()
  );

  useEffect(() => {
    const unsubscribe = networkMonitor.addStatusListener((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  return {
    isOnline: status === 'online',
    isOffline: status === 'offline',
    isServerDown: status === 'server_down',
    status,
  };
};
```

---

#### Step 2: Update NetworkStatusBar Design (15 mins)

**File:** `nora-mobile/src/components/NetworkStatusBar.tsx`

**Changes:**
- Move to top of screen (not bottom)
- Update colors (amber background, black text)
- Add "Back Online" message with auto-dismiss

```typescript
// CHANGES:
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60, // ✅ Changed from bottom: 75
    left: 0,
    right: 0,
    backgroundColor: '#FFA500', // ✅ Changed from #FFC0CB (amber)
    paddingVertical: 12,
    alignItems: 'center',
    zIndex: 9998,
  },
  text: {
    color: '#000000', // ✅ Changed from #DC2626 (black for readability)
    fontSize: 14,
    fontWeight: '600',
  },
});

// Update messages
const getMessage = () => {
  switch (status) {
    case 'offline':
      return 'No Internet Connection';
    case 'server_down':
      return 'Connection Issue'; // ✅ Changed from "Server Failure"
    default:
      return '';
  }
};
```

---

#### Step 3: Update LearnScreen (30 mins)

**File:** `nora-mobile/src/screens/LearnScreen.tsx`

**Changes:**
- Remove Alert modal for network errors
- Disable pull-to-refresh when offline
- Add empty state for load failures

```typescript
// ADD IMPORT
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const LearnScreen: React.FC = () => {
  const { isOnline } = useNetworkStatus(); // ✅ Add hook
  // ... existing state ...

  const loadLessons = async (showLoadingSpinner = true) => {
    try {
      // ... existing logic ...
    } catch (err) {
      console.error('Failed to load lessons:', err);
      const errorMessage = handleApiError(err);
      setError(errorMessage);

      // ❌ REMOVE THIS LINE:
      // Alert.alert('Unable to Load Lessons', errorMessage);

      // ✅ NetworkStatusBar already shows if it's a network issue
      // ✅ Empty state will display the error message
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // ... existing code ...

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadLessons(false)}
            enabled={isOnline} // ✅ Disable pull-to-refresh when offline
            tintColor={COLORS.mainPurple}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.mainTitle}>All Lessons</Text>
        </View>

        {/* ✅ ADD: Empty state when error */}
        {error && !loading && phases.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Couldn't Load Lessons</Text>
            <Text style={styles.emptyMessage}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, !isOnline && styles.retryButtonDisabled]}
              onPress={() => loadLessons()}
              disabled={!isOnline}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Phases and Lessons */}
        {phases.map((phase) => (
          // ... existing rendering ...
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// ✅ ADD: Styles for empty state
const styles = StyleSheet.create({
  // ... existing styles ...

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: COLORS.mainPurple,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  retryButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
```

---

#### Step 4: Update RecordScreen (45 mins)

**File:** `nora-mobile/src/screens/RecordScreen.tsx`

**Changes:**
- Add progressive error escalation
- Use toasts for first 2 failures, modal for 3+
- Disable recording when offline

```typescript
// ADD IMPORTS
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useToast } from '../components/ToastManager';

export const RecordScreen: React.FC = () => {
  const { isOnline } = useNetworkStatus(); // ✅ Add hook
  const { showToast } = useToast(); // ✅ Add toast hook

  // ✅ ADD: Track failure counts for progressive escalation
  const [recordingFailureCount, setRecordingFailureCount] = useState(0);

  // ... existing state ...

  const startRecording = async () => {
    // ✅ ADD: Check network before starting
    if (!isOnline) {
      showToast('Recording requires internet connection', 'error');
      return;
    }

    try {
      // ... existing recording start logic ...

      // ✅ ADD: Reset failure count on success
      setRecordingFailureCount(0);

    } catch (error) {
      console.error('Failed to start recording:', error);

      // ✅ REPLACE Alert.alert with progressive escalation
      const newCount = recordingFailureCount + 1;
      setRecordingFailureCount(newCount);

      if (newCount === 1 || newCount === 2) {
        // First 2 failures: Non-blocking toast
        showToast(ErrorMessages.RECORDING.START_FAILED, 'error');
      } else if (newCount === 3) {
        // Third failure: Modal with troubleshooting
        Alert.alert(
          'Recording Issue',
          'We\'re having trouble starting the recording.\n\nPlease check:\n• Microphone permissions are enabled\n• No other apps are using the microphone\n• Your device has enough storage',
          [
            { text: 'Check Settings', onPress: () => Linking.openSettings() },
            { text: 'Try Again', onPress: startRecording }
          ]
        );
      } else {
        // 4+ failures: Escalate to support
        Alert.alert(
          'We\'re Sorry',
          'Recording continues to fail. This might be a device compatibility issue.',
          [
            { text: 'Contact Support', onPress: () => navigation.push('Support') },
            { text: 'Try Again', onPress: startRecording },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    }
  };

  const stopRecording = async () => {
    try {
      // ... existing logic ...

      // ❌ REMOVE: Alert.alert for stop errors
      // ✅ REPLACE with toast:
    } catch (error) {
      console.error('Failed to stop recording:', error);
      showToast(ErrorMessages.RECORDING.STOP_FAILED, 'error');
      setRecordingState('completed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <RecordingCard
        isRecording={isRecording}
        durationMillis={durationMillis}
        onRecordPress={isRecording ? stopRecording : startRecording}
        canRecord={isOnline} // ✅ Disable when offline
      />

      {/* ✅ ADD: Show hint when offline */}
      {!isOnline && !isRecording && (
        <View style={styles.offlineHint}>
          <Text style={styles.offlineHintText}>
            Recording requires internet connection
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// ✅ ADD: Styles
const styles = StyleSheet.create({
  // ... existing styles ...

  offlineHint: {
    position: 'absolute',
    bottom: 120,
    left: 32,
    right: 32,
    backgroundColor: '#FFF3CD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
  },
  offlineHintText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
});
```

---

#### Step 5: Update HomeScreen (20 mins)

**File:** `nora-mobile/src/screens/HomeScreen.tsx`

**Changes:**
- Add toast for silent failures
- Disable "Record" navigation when offline

```typescript
// ADD IMPORT
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useToast } from '../components/ToastManager';

export const HomeScreen: React.FC = () => {
  const { isOnline } = useNetworkStatus(); // ✅ Add hook
  const { showToast } = useToast(); // ✅ Add toast hook

  // ... existing state ...

  const loadUserProfile = async () => {
    try {
      // ... existing logic ...
    } catch (error) {
      console.log('Could not load user profile:', error);
      // ✅ ADD: Show toast instead of silent failure
      if (!isOnline) {
        showToast('Offline - Pull down to refresh when connected', 'warning');
      }
    }
  };

  // ... rest of component ...

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* ... existing content ... */}

        {/* ✅ UPDATE: Disable record navigation when offline */}
        <TouchableOpacity
          style={[styles.recordButton, !isOnline && styles.recordButtonDisabled]}
          onPress={() => navigation.navigate('Record')}
          disabled={!isOnline}
        >
          <Text style={[styles.recordButtonText, !isOnline && styles.recordButtonTextDisabled]}>
            Record New Session
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// ✅ ADD: Disabled button styles
const styles = StyleSheet.create({
  // ... existing styles ...

  recordButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  recordButtonTextDisabled: {
    color: '#888888',
  },
});
```

---

#### Step 6: Add Toast Provider to App Root (10 mins)

**File:** `nora-mobile/App.tsx`

```typescript
// ADD IMPORT
import { ToastProvider } from './src/components/ToastManager';
import { NetworkStatusBar } from './src/components/NetworkStatusBar';

export default function App() {
  return (
    <ToastProvider>
      <NavigationContainer>
        {/* Your app navigation */}
      </NavigationContainer>
      <NetworkStatusBar /> {/* ✅ Add at root level */}
    </ToastProvider>
  );
}
```

---

**Files to Create:**
- `nora-mobile/src/hooks/useNetworkStatus.ts` (NEW)

**Files to Modify:**
- `nora-mobile/src/components/NetworkStatusBar.tsx`
- `nora-mobile/src/screens/LearnScreen.tsx`
- `nora-mobile/src/screens/RecordScreen.tsx`
- `nora-mobile/src/screens/HomeScreen.tsx`
- `nora-mobile/App.tsx`

---

### Phase 2: Add Empty States (2-3 hours) 💡 MEDIUM IMPACT

1. **Create reusable EmptyState component**
   - Accepts illustration, title, message, action buttons
   - Use across LearnScreen, HomeScreen, ProfileScreen

2. **Add empty states to key screens**
   - LearnScreen: "Couldn't load lessons"
   - HomeScreen: "No recordings yet"
   - RecordScreen: Show helpful guidance when no recordings

**Files to Create:**
- `EmptyState.tsx` (new component)

**Files to Modify:**
- `LearnScreen.tsx`
- `HomeScreen.tsx`

---

### Phase 3: Improve Critical Error Modals (1 hour) ✨ LOW IMPACT

1. **Update permanent failure copy**
   - More apologetic tone
   - Clear next steps
   - Link to support

2. **Add "Contact Support" button to critical errors**
   - Processing failed permanently
   - Upload failed after retries

**Files to Modify:**
- `errorMessages.ts` (improve copy)
- `RecordScreen.tsx` (add support button)
- `UploadProcessingContext.tsx` (improve error alerts)

---

## Error Pattern Decision Tree

```
ERROR OCCURS
    ├─ Is it a network error?
    │  ├─ YES → NetworkStatusBar handles it (no modal, no toast)
    │  │          User sees: "No Internet Connection" at top
    │  │
    │  └─ NO → Continue
    │
    ├─ Is it critical/permanent?
    │  ├─ YES → Alert.alert modal
    │  │          - Processing failed (permanent)
    │  │          - Account creation failed
    │  │          - Payment failed
    │  │
    │  └─ NO → Continue
    │
    ├─ Is it transient/retriable?
    │  ├─ YES → Progressive escalation
    │  │          Attempt 1-2: Toast (non-blocking)
    │  │          Attempt 3: Modal with troubleshooting
    │  │          Attempt 4+: Escalate to support
    │  │
    │  └─ NO → Continue
    │
    └─ Is it a missing data scenario?
       └─ YES → Empty State (full screen)
                  - Lessons failed to load
                  - No recordings yet
                  - Profile unavailable
```

---

## Critical UX Principle: Safe Failures

**When errors involve user data (recordings), always save locally first:**

```typescript
// ANTI-PATTERN (data loss risk)
const handleRecordingStop = async () => {
  const uri = await stopRecording();
  await uploadRecording(uri); // ❌ If upload fails, might lose recording
};

// BEST PRACTICE (safe failure)
const handleRecordingStop = async () => {
  const uri = await stopRecording();
  await saveRecordingLocally(uri); // ✅ Save locally FIRST
  await uploadRecording(uri); // ✅ Then attempt upload
  // If upload fails, recording is still safe locally
};
```

**User-facing messaging for safe failures:**
- ✅ "Your recording is saved. Uploading..." (reassuring)
- ✅ "Upload failed but your recording is safe locally" (no data loss)
- ❌ "Upload failed" (user worries they lost their work)

**Implementation:**
```typescript
// After upload fails multiple times
Alert.alert(
  'Upload Not Working',
  'Your recording is saved on your device and won\'t be lost.\n\nWe can help you upload it later.',
  [
    { text: 'Contact Support', onPress: contactSupport },
    { text: 'Try Later', onPress: saveForLater }
  ]
);
```

---

## Updated Error Messages Copy

### Network Errors (NetworkStatusBar Only)

```typescript
// errorMessages.ts - NetworkStatusBar copy
NETWORK: {
  NO_CONNECTION: 'No Internet Connection', // Concise for bar
  SERVER_ISSUE: 'Connection Issue', // Less technical
  RECONNECTED: 'Back Online', // Show briefly when reconnected
}
```

### Critical Errors (Alert Modals)

```typescript
// errorMessages.ts - Alert modal copy
PROCESSING: {
  PERMANENT_FAILURE_TITLE: 'We\'re Sorry',
  PERMANENT_FAILURE_MESSAGE: 'Your recording couldn\'t be processed. Our team has been notified.\n\nYou can try again or contact support if this continues.',
}

RECORDING: {
  UPLOAD_PERMANENT_FAILURE: 'We couldn\'t upload your recording after multiple attempts.\n\nPlease check your connection and try again, or save your recording and contact support.',
}
```

### Transient Errors (Toasts)

```typescript
// errorMessages.ts - Toast copy (keep concise!)
RECORDING: {
  START_FAILED: 'Couldn\'t start recording. Try again.',
  STOP_FAILED: 'Couldn\'t stop recording. Try again.',
}

PROCESSING: {
  RETRY_IN_PROGRESS: 'Retrying...',
  STILL_PROCESSING: 'Still processing your recording...',
}
```

---

## Testing Checklist

After implementing changes, test these scenarios:

### Network Error Scenarios

- [ ] **Go offline** → Should see NetworkStatusBar only (no modal)
- [ ] **Try to load lessons offline** → Should see NetworkStatusBar + empty state (no modal)
- [ ] **Come back online** → NetworkStatusBar shows "Back Online" for 2s, then hides
- [ ] **Server down** → NetworkStatusBar shows "Connection Issue"

### Transient Error Scenarios (Without Progressive Escalation)

- [ ] **Recording fails to start (first time)** → See toast (not modal), can immediately retry
- [ ] **Upload fails (transient)** → See toast, auto-retries in background
- [ ] **Form validation fails** → See toast with specific field error

### Progressive Escalation Scenarios (NEW)

**Recording Start Failures:**
- [ ] **Attempt 1:** Start recording, fail → See toast "Couldn't start recording. Try again."
- [ ] **Attempt 2:** Retry, fail again → See toast again (still non-blocking)
- [ ] **Attempt 3:** Retry, fail again → See modal with troubleshooting steps (mic permissions, storage, etc.)
- [ ] **Attempt 4:** Retry, fail again → See modal with "Contact Support" option
- [ ] **Success after failures:** Start recording successfully → Failure count resets to 0

**Upload Failures (Manual Retries):**
- [ ] **Auto-retry exhausted** → See modal "Upload Failed - Please check connection" [Retry] [Cancel]
- [ ] **Manual retry 1, fails** → See modal "Still Having Trouble - Recording saved locally" [Try Later] [Retry Again]
- [ ] **Manual retry 2, fails** → See modal "Upload Not Working - Contact Support" [Contact Support] [Save for Later] [Try Once More]
- [ ] **Manual retry 3, succeeds** → Success! Manual retry count resets to 0
- [ ] **Cancel after first failure** → Recording saved locally, user can upload later from home screen

### Critical Error Scenarios

- [ ] **Processing fails permanently** → See modal with "Contact Support" button
- [ ] **Upload fails after 3 AUTO-retries** → See modal with retry/cancel options
- [ ] **Account creation fails** → See modal with clear next steps

### Empty State Scenarios

- [ ] **Lessons fail to load** → See empty state with retry button
- [ ] **No recordings exist** → See empty state with "Record first session" CTA
- [ ] **Profile unavailable** → See empty state with refresh option

### Safe Failure Scenarios (Data Protection)

- [ ] **Recording stops** → File saved locally BEFORE upload attempt
- [ ] **Upload fails** → User sees "Recording is saved locally" message
- [ ] **User closes app during upload** → Upload resumes when app reopens (or recording stays local)
- [ ] **Check local storage** → Failed uploads still accessible in device storage

---

## Success Metrics

After implementation, you should see:

**Quantitative:**
- ❌ **Reduced:** Alert.alert usage by ~60% (only critical errors)
- ✅ **Increased:** Toast usage for transient errors
- ✅ **Reduced:** User friction (no double-error messages)

**Qualitative:**
- Users understand **what went wrong** (clear, contextual)
- Users know **what to do** (retry, wait, contact support)
- Users aren't **annoyed** (no redundant messages)

---

## Code Examples - Before & After

### Example 1: LearnScreen Network Error

**BEFORE (Redundant):**
```typescript
} catch (err) {
  console.error('Failed to load lessons:', err);
  const errorMessage = handleApiError(err);
  Alert.alert('Unable to Load Lessons', errorMessage); // ❌ Redundant with NetworkStatusBar
} finally {
  setLoading(false);
}

// User sees:
// 1. NetworkStatusBar: "No Internet Connection"
// 2. Alert modal: "Unable to Load Lessons - No internet connection..."
// Result: Frustrated user must dismiss modal they already understand
```

**AFTER (Clear & Concise):**
```typescript
} catch (err) {
  console.error('Failed to load lessons:', err);
  const errorMessage = handleApiError(err);
  setError(errorMessage); // ✅ Store for empty state
  // NetworkStatusBar already handles network errors
} finally {
  setLoading(false);
}

// User sees:
// 1. NetworkStatusBar: "No Internet Connection" (persistent at top)
// 2. Empty state: "Couldn't Load Lessons" with retry button
// Result: User understands issue and knows how to fix it
```

---

### Example 2: RecordScreen Transient Error

**BEFORE (Blocking):**
```typescript
} catch (error) {
  console.error('Failed to start recording:', error);
  Alert.alert('Recording Error', ErrorMessages.RECORDING.START_FAILED); // ❌ Blocks user
}

// User must:
// 1. Read modal
// 2. Tap "OK"
// 3. Try again
// Result: Friction for a simple retry
```

**AFTER (Non-blocking):**
```typescript
} catch (error) {
  console.error('Failed to start recording:', error);
  showToast(ErrorMessages.RECORDING.START_FAILED, 'error'); // ✅ Non-blocking
}

// User sees:
// 1. Toast appears: "Couldn't start recording. Try again."
// 2. Toast auto-dismisses after 4s
// 3. User can immediately tap "Record" again
// Result: Smooth, frictionless retry
```

---

## Next Steps

1. **Review this document** - Confirm approach aligns with your UX vision
2. **Prioritize phases** - Start with Phase 1 (highest impact, lowest effort)
3. **Create tasks** - Break down into implementable chunks
4. **Test thoroughly** - Use the testing checklist above
5. **Gather feedback** - Ask users if errors are clearer after changes

---

**Questions or concerns?** This is a significant UX improvement that will reduce user frustration and improve clarity. Happy to discuss any recommendations before implementation.
