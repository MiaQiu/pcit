# Temporarily Hidden: Chat Bubble Entry Points

All three entry points to `CoachChat` have been commented out / suppressed. To restore, revert the changes noted below.

---

## 1. Home FAB (Floating Action Button)

**File:** `nora-mobile/src/screens/HomeScreen_v2.tsx` ~line 1037

The persistent floating chat icon shown on the home screen after the user's first play session. Wrapped in a block comment.

**To restore:** uncomment the `{hasAnySession && <TouchableOpacity …>` block.

---

## 2. Home Chat Intro Card

**File:** `nora-mobile/src/screens/HomeScreen_v2.tsx` ~line 974

An intro card shown once after the user reads their first report, prompting them to chat with the coach. The entire `hasRecordedSession && isReportRead && !chatIntroDismissed` branch was removed and replaced with an inline comment.

**To restore:** re-add the ternary branch:
```tsx
) : hasRecordedSession && isReportRead && !chatIntroDismissed ? (
  <>
    <View style={styles.massageHeader}>
      <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.mainPurple} />
      <Text style={styles.massageLabel}>{t('homeV2.meetCoachLabel')}</Text>
    </View>
    <Text style={styles.massageBody}>
      {t('homeV2.meetCoachBodyStart')}
      <Text style={styles.massageChildName}>{childName}</Text>
      {t('homeV2.meetCoachBodyEnd')}
    </Text>
    <TouchableOpacity style={styles.recordButton} onPress={handleChatIntroChat} activeOpacity={0.85}>
      <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
      <Text style={styles.recordButtonText}>{t('homeV2.chatWithCoach')}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.skipButton} onPress={handleChatIntroSkip} activeOpacity={0.7}>
      <Text style={styles.skipButtonText}>{t('homeV2.skipForNow')}</Text>
    </TouchableOpacity>
  </>
) : (
```

---

## 3. Report Screen Demo Bubble

**File:** `nora-mobile/src/screens/ReportScreen.tsx` ~line 1395

A one-time animated floating bubble shown on the report screen near the "about child" section. Guarded with `{false && showChatDemo && …}`.

**To restore:** remove `false &&` from the condition.
