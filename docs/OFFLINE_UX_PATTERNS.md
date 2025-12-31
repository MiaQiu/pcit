# Offline UX Patterns - Blocking vs Disabling

**Date:** 2025-12-30
**Question:** When network is down, should we block all user interactions?

---

## Option 1: Transparent Overlay (Block Everything)

**Implementation:**
```typescript
// App.tsx or root component
import { networkMonitor } from './utils/NetworkMonitor';

export const App = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = networkMonitor.addStatusListener((status) => {
      setIsOnline(status === 'online');
    });
    return unsubscribe;
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <AppNavigator />
      <NetworkStatusBar />

      {/* Transparent overlay blocks ALL touches */}
      {!isOnline && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent', // or 'rgba(0,0,0,0.1)' for subtle dimming
            zIndex: 9997, // Below NetworkStatusBar (9998) but above content
          }}
          pointerEvents="box-only" // Blocks all touches to children
        />
      )}
    </View>
  );
};
```

### Pros ✅
- **Simple:** One component, 10 lines of code
- **Complete:** Blocks ALL interactions (buttons, scrolling, navigation)
- **Foolproof:** User can't trigger network errors

### Cons ❌
- **Confusing:** Buttons look enabled but don't respond (no visual feedback)
- **Feels broken:** Users might think app froze/crashed
- **Blocks everything:** Can't view cached content, can't navigate, can't even go to settings
- **Frustrating:** User might want to read cached lessons while offline

### When to Use
- Apps that are **100% useless offline** (e.g., stock trading app)
- Very simple apps with 1-2 screens
- Emergency "maintenance mode"

---

## Option 2: Disable Buttons (Selective Blocking) ⭐ RECOMMENDED

**Implementation:**
```typescript
// Create a hook to check network status
// hooks/useNetworkStatus.ts
import { useState, useEffect } from 'react';
import { networkMonitor } from '../utils/NetworkMonitor';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isServerAvailable, setIsServerAvailable] = useState(true);

  useEffect(() => {
    const unsubscribe = networkMonitor.addStatusListener((status) => {
      setIsOnline(status !== 'offline');
      setIsServerAvailable(status === 'online');
    });
    return unsubscribe;
  }, []);

  return { isOnline, isServerAvailable };
};

// Use in screens
// LearnScreen.tsx
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const LearnScreen = () => {
  const { isOnline } = useNetworkStatus();

  return (
    <ScrollView>
      {/* Refresh button disabled when offline */}
      <TouchableOpacity
        style={[styles.refreshButton, !isOnline && styles.disabledButton]}
        onPress={loadLessons}
        disabled={!isOnline} // ✅ Button disabled but still visible
      >
        <Text style={[styles.buttonText, !isOnline && styles.disabledText]}>
          Refresh Lessons
        </Text>
      </TouchableOpacity>

      {/* Allow viewing cached lessons even when offline */}
      {lessons.map(lesson => (
        <LessonCard
          key={lesson.id}
          {...lesson}
          onPress={() => navigation.push('LessonViewer', { lessonId: lesson.id })}
          // ✅ Can still view cached lessons offline
        />
      ))}
    </ScrollView>
  );
};

// RecordScreen.tsx
export const RecordScreen = () => {
  const { isOnline } = useNetworkStatus();
  const [isRecording, setIsRecording] = useState(false);

  return (
    <View>
      <RecordingCard
        isRecording={isRecording}
        onRecordPress={isRecording ? stopRecording : startRecording}
        canRecord={isOnline || isRecording} // ✅ Can record offline, but can't START if offline
      />

      {!isOnline && !isRecording && (
        <Text style={styles.offlineHint}>
          Recording requires internet connection
        </Text>
      )}
    </View>
  );
};
```

### Pros ✅
- **Clear visual feedback:** Buttons greyed out = user knows why they can't tap
- **Selective blocking:** Only block network-dependent actions
- **Allow offline features:** User can still view cached content, navigate, read
- **Industry standard:** This is how most apps handle offline mode (Gmail, Spotify, etc.)

### Cons ❌
- **More code:** Need to check network status in each screen
- **Inconsistent if not thorough:** Might miss some buttons

### When to Use ⭐
- Apps with **some offline functionality** (view cached content)
- Multi-screen apps (like Nora)
- Professional apps where users expect nuanced offline behavior

---

## Option 3: Full-Screen Offline State (Aggressive Blocking)

**Implementation:**
```typescript
// App.tsx
export const App = () => {
  const { isOnline } = useNetworkStatus();

  if (!isOnline) {
    return <OfflineScreen />;
  }

  return <AppNavigator />;
};

// OfflineScreen.tsx
export const OfflineScreen = () => (
  <SafeAreaView style={styles.container}>
    <Image source={require('./assets/no-wifi.png')} style={styles.image} />
    <Text style={styles.title}>No Internet Connection</Text>
    <Text style={styles.message}>
      Nora requires an internet connection to work.
      Please check your WiFi or cellular data.
    </Text>
    <TouchableOpacity style={styles.retryButton} onPress={checkConnection}>
      <Text style={styles.retryText}>Retry</Text>
    </TouchableOpacity>
  </SafeAreaView>
);
```

### Pros ✅
- **Very clear:** User immediately knows app requires internet
- **Simple:** One screen handles entire offline state
- **No confusion:** Can't accidentally trigger errors

### Cons ❌
- **Too aggressive:** Blocks everything, even non-network features
- **Can't view cached content:** Even if lessons were previously loaded
- **Annoying:** If connection flickers, screen keeps appearing/disappearing
- **Bad UX for intermittent connections:** Common on mobile

### When to Use
- Apps that are **completely useless offline** (e.g., video calling app)
- Apps with no cached data
- Very simple apps

---

## Recommended Approach for Nora

### Use Option 2: Selective Button Disabling ⭐

**Why:**
1. **Nora has cacheable content:** Lessons can be read offline
2. **Some features work offline:** User can view previous recording reports
3. **Professional UX:** Users expect nuanced offline behavior
4. **Clearer feedback:** Disabled buttons with visual state are better than mysterious unresponsive buttons

### Implementation Plan

#### Step 1: Create `useNetworkStatus` hook

```typescript
// nora-mobile/src/hooks/useNetworkStatus.ts
import { useState, useEffect } from 'react';
import { networkMonitor, ConnectionStatus } from '../utils/NetworkMonitor';

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>('online');

  useEffect(() => {
    const initialStatus = networkMonitor.getConnectionStatus();
    setStatus(initialStatus);

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

#### Step 2: Update button styles

```typescript
// nora-mobile/src/constants/styles.ts (or in StyleSheet)
export const buttonStyles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.mainPurple,
    paddingVertical: 16,
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC', // Greyed out
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#888888',
  },
});
```

#### Step 3: Apply to network-dependent buttons

**RecordScreen:**
```typescript
export const RecordScreen = () => {
  const { isOnline } = useNetworkStatus();

  return (
    <RecordingCard
      isRecording={isRecording}
      onRecordPress={isRecording ? stopRecording : startRecording}
      canRecord={isOnline || isRecording} // Can continue recording offline, but can't start new
    />
  );
};
```

**LearnScreen:**
```typescript
export const LearnScreen = () => {
  const { isOnline } = useNetworkStatus();

  return (
    <>
      {/* User can still scroll and read cached lessons */}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadLessons}
            enabled={isOnline} // ✅ Disable pull-to-refresh when offline
          />
        }
      >
        {lessons.map(lesson => (
          <LessonCard
            key={lesson.id}
            {...lesson}
            // ✅ Can still tap to view cached lesson
          />
        ))}
      </ScrollView>

      {/* Show hint when offline */}
      {!isOnline && (
        <View style={styles.offlineHint}>
          <Text>Viewing cached lessons. Connect to refresh.</Text>
        </View>
      )}
    </>
  );
};
```

**HomeScreen:**
```typescript
export const HomeScreen = () => {
  const { isOnline } = useNetworkStatus();

  return (
    <View>
      {/* "Record" navigation button disabled when offline */}
      <TouchableOpacity
        style={[styles.recordButton, !isOnline && styles.buttonDisabled]}
        onPress={() => navigation.navigate('Record')}
        disabled={!isOnline}
      >
        <Text style={[styles.buttonText, !isOnline && styles.buttonTextDisabled]}>
          Record New Session
        </Text>
      </TouchableOpacity>

      {/* Can still view previous recordings offline */}
      {recordings.map(recording => (
        <RecordingCard key={recording.id} {...recording} />
      ))}
    </View>
  );
};
```

---

## Hybrid Approach (Best of Both Worlds)

For critical actions, you can combine approaches:

```typescript
// RecordScreen - Example of hybrid approach
export const RecordScreen = () => {
  const { isOnline } = useNetworkStatus();
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  const handleRecordPress = () => {
    if (!isOnline) {
      // Show modal explaining why recording requires internet
      setShowOfflineModal(true);
      return;
    }
    startRecording();
  };

  return (
    <>
      <RecordingCard
        isRecording={isRecording}
        onRecordPress={handleRecordPress}
        canRecord={true} // Don't disable button...
      />

      {/* ...instead show modal with explanation */}
      <Modal visible={showOfflineModal}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Internet Required</Text>
          <Text style={styles.modalMessage}>
            Recording requires an internet connection to upload and process your session.

            Please connect to WiFi or cellular data to continue.
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => setShowOfflineModal(false)}
          >
            <Text>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};
```

---

## Summary: What to Block vs Allow Offline

### ❌ Block (Disable) When Offline:
- **Starting new recording** (requires upload)
- **Pull-to-refresh** (requires network)
- **Creating account** (requires server)
- **Submitting forms** (requires server)
- **Uploading files** (requires network)

### ✅ Allow (Keep Enabled) When Offline:
- **Viewing cached lessons** (data already local)
- **Reading previous reports** (data already local)
- **Navigating between screens** (local operation)
- **Scrolling, tapping on cached content** (local operation)
- **Going to Settings/Profile** (local operation)

### ⚠️ Special Cases:
- **Continuing recording** that was started online → Allow (don't interrupt user)
- **Saving recording locally** → Allow (critical for data safety)
- **Viewing in-progress uploads** → Allow (show upload status)

---

## Implementation Checklist

- [ ] Create `useNetworkStatus` hook
- [ ] Define `buttonDisabled` and `buttonTextDisabled` styles
- [ ] Update RecordScreen:
  - [ ] Disable "Start Recording" button when offline
  - [ ] Allow continuing recording if already started
  - [ ] Show hint: "Recording requires internet"
- [ ] Update LearnScreen:
  - [ ] Disable pull-to-refresh when offline
  - [ ] Allow viewing cached lessons
  - [ ] Show hint: "Viewing cached lessons"
- [ ] Update HomeScreen:
  - [ ] Disable "Record New Session" button when offline
  - [ ] Allow viewing previous recordings
- [ ] Test with Airplane Mode:
  - [ ] All network-dependent buttons disabled
  - [ ] All offline features still work
  - [ ] Clear visual feedback on why buttons disabled

---

## Final Recommendation

**Use Option 2 (Selective Button Disabling) with these enhancements:**

1. **Disable network-dependent buttons** with visual feedback (greyed out)
2. **Keep NetworkStatusBar** for global awareness
3. **Allow offline features** (view cached content, navigate)
4. **Add helpful hints** near disabled buttons ("Recording requires internet")
5. **For critical actions**, optionally show modal with explanation

**Don't use transparent overlay** - it's confusing and blocks too much.

**Files to Create:**
- `nora-mobile/src/hooks/useNetworkStatus.ts`

**Files to Modify:**
- `nora-mobile/src/screens/RecordScreen.tsx`
- `nora-mobile/src/screens/LearnScreen.tsx`
- `nora-mobile/src/screens/HomeScreen.tsx`
- `nora-mobile/src/constants/styles.ts` (add disabled button styles)

**Estimated Time:** 1-2 hours

---

**Questions?** This approach balances user experience (clear feedback, allows offline features) with preventing errors (disables network-dependent actions).
