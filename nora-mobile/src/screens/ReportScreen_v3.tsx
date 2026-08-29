/**
 * ReportScreen v3
 * Restored from commit 8343f40 (original ReportScreen_v2). Compact
 * post-session celebration screen: emotional deposit, today's goal
 * progress, and parenting level — shown before the full Report screen.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { COLORS, FONTS, REPORT_DRAGON_GOOD, REPORT_DRAGON_AMAZING, REPORT_DRAGON_LEVELUP, REPORT_DRAGON_REGRESSED, REPORT_TARGET, REPORT_TARGET_ORANGE, REPORT_TARGET_SMALL, REPORT_STAR_SMALL } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService, useAuthService } from '../contexts/AppContext';
import type { RecordingAnalysis, ParentSkillLevel } from '@nora/core';
import { useTranslation, Trans } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';
import * as userStorage from '../lib/userStorage';
import { PARENT_SKILL_LEVEL_KEYS } from '../constants/parentSkillLevels';
import { deriveGoalFromLevel } from '../utils/goalFallback';

type ReportScreenV3RouteProp = RouteProp<RootStackParamList, 'ReportV3'>;

const SKILL_LABEL_I18N_KEY: Record<string, string> = {
  'Praise (Labeled)': 'praiseLabeleld',
  'Echo': 'echo',
  'Narrate': 'narrate',
  'Questions': 'questions',
  'Commands': 'commands',
  'Criticism': 'criticism',
};

const getSkillDisplayLabel = (apiLabel: string, t: Function): string => {
  const key = SKILL_LABEL_I18N_KEY[apiLabel];
  if (!key) return apiLabel;
  const translated = t(`report.skillLabel.${key}`);
  return translated || apiLabel;
};

// Level 7 is the pre-final gate: it needs 2 qualifying sessions to clear.
const LEVEL_7_QUALIFYING_TARGET = 2;

// Hexagon level badge for the "Level Up!" card — `filled` is the old level
// (solid purple), the outlined one is the level just reached.
const LevelHexagon: React.FC<{ level: number; filled?: boolean; size?: number }> = ({ level, filled, size = 52 }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <MaterialCommunityIcons
      name={filled ? 'hexagon' : 'hexagon-outline'}
      size={size}
      color={COLORS.mainPurple}
      style={{ position: 'absolute' }}
    />
    <Text
      style={{
        fontFamily: FONTS.bold,
        fontSize: size * 0.42,
        color: filled ? '#FFFFFF' : COLORS.mainPurple,
      }}
    >
      {level}
    </Text>
  </View>
);

// Sparkle burst directions (radians) for the "deposit landed" moment.
const DEPOSIT_SPARKLES = [-1.9, -1.3, -0.6, -2.6, 0.1, -3.3];

// Hermes' Intl is inconsistent across builds — group thousands by hand.
const formatDeposit = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Emotional Deposit card — shows the running TOTAL emotional deposit. On
 * mount it counts the number up from the previous total to the new one while
 * the heart pulses and a sparkle burst fires; the big centre-screen "+N"
 * celebration (see DepositCelebrationOverlay) plays in parallel and the
 * right-hand "today" panel reveals as the count lands.
 */
const EmotionalDepositCard: React.FC<{
  todayScore: number;
  totalBefore: number | null;
  scoreDelta: number | null;
  t: Function;
  // Reports the window-space centre of the running-total number so the
  // centre-screen "+N" celebration can fly precisely into it.
  onMeasureTarget?: (centre: { x: number; y: number }) => void;
}> = ({ todayScore, totalBefore, scoreDelta, t, onMeasureTarget }) => {
  const base = totalBefore ?? 0;
  const total = base + todayScore;

  const [display, setDisplay] = useState(totalBefore == null ? todayScore : base);

  const numberRef = useRef<any>(null);
  // Report the number's position once — re-measuring on every count-up tick
  // would thrash the parent with setState during the animation.
  const measuredRef = useRef(false);
  const countAnim = useRef(new Animated.Value(0)).current;
  const numberPop = useRef(new Animated.Value(0)).current;
  const heartPulse = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  // Right-hand "today's deposit" panel: hidden until the add-animation lands,
  // then reveals (stays at 1 on the no-animation path).
  const reveal = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (totalBefore == null) {
      setDisplay(todayScore);
      return;
    }
    setDisplay(base);
    countAnim.setValue(0);
    numberPop.setValue(0);
    heartPulse.setValue(0);
    burst.setValue(0);
    reveal.setValue(0);

    const listenerId = countAnim.addListener(({ value }) => {
      setDisplay(Math.round(base + (total - base) * value));
    });

    // Success buzz as the count-up reaches the new total, timed to the
    // centre-screen "+N" flying into the card.
    const h2 = setTimeout(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
      1650
    );

    const seq = Animated.sequence([
      // Hold while the centre-screen "+N" pops in and *starts* flying toward
      // the card (~1s in), then run the count-up as it travels in.
      Animated.delay(1050),
      Animated.parallel([
        Animated.timing(countAnim, {
          toValue: 1,
          duration: 640,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.delay(240),
          Animated.spring(numberPop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
          Animated.spring(numberPop, { toValue: 0, friction: 6, tension: 120, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(240),
          Animated.spring(heartPulse, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
          Animated.spring(heartPulse, { toValue: 0, friction: 5, tension: 120, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(260),
          Animated.timing(burst, {
            toValue: 1,
            duration: 720,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(520),
          Animated.timing(reveal, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);
    seq.start();

    return () => {
      countAnim.removeListener(listenerId);
      seq.stop();
      clearTimeout(h2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalBefore, todayScore]);

  const heartScale = heartPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.32] });
  const numberScale = numberPop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });

  return (
    <View style={styles.depositCard}>
      <Animated.View style={[styles.depositIconCircle, { transform: [{ scale: heartScale }] }]}>
        <Ionicons name="heart" size={28} color={'#6837EA'} />
      </Animated.View>

      <View style={styles.depositScoreCol}>
        <View style={styles.depositNumberWrap}>
          <Animated.Text
            ref={numberRef}
            numberOfLines={1}
            adjustsFontSizeToFit
            onLayout={() => {
              if (measuredRef.current) return;
              numberRef.current?.measureInWindow?.((x: number, y: number, w: number, h: number) => {
                if (w && h) {
                  measuredRef.current = true;
                  onMeasureTarget?.({ x: x + w / 2, y: y + h / 2 });
                }
              });
            }}
            style={[styles.depositScoreText, { transform: [{ scale: numberScale }] }]}
          >
            {formatDeposit(display)}
          </Animated.Text>

          {/* Sparkle burst — fires as the deposit lands in the total. */}
          <View style={styles.depositSparkleLayer} pointerEvents="none">
            {DEPOSIT_SPARKLES.map((angle, i) => {
              const dist = 34 + (i % 3) * 8;
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    opacity: burstOpacity,
                    transform: [
                      { translateX: Animated.multiply(burst, Math.cos(angle) * dist) },
                      { translateY: Animated.multiply(burst, Math.sin(angle) * dist) },
                      { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.1] }) },
                    ],
                  }}
                >
                  <Ionicons name={i % 2 === 0 ? 'sparkles' : 'star'} size={i % 2 === 0 ? 14 : 10} color="#F5B301" />
                </Animated.View>
              );
            })}
          </View>

        </View>

        <Text style={styles.depositLabel}>{t('reportV2.depositTotalLabel')}</Text>
      </View>

      {/* Right: today's deposit + how it compares to last session */}
      <Animated.View
        style={[
          styles.depositRightCol,
          {
            opacity: reveal,
            transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <View style={styles.depositDivider} />
        <View style={styles.depositRightInner}>
          <Text style={styles.depositTodayValue}>+{todayScore}</Text>
          <Text style={styles.depositTodayLabel}>{t('reportV2.depositToday')}</Text>
          {scoreDelta != null && (
            <View style={styles.depositDeltaRow}>
              <Ionicons
                name={scoreDelta >= 0 ? 'arrow-up' : 'arrow-down'}
                size={11}
                color={scoreDelta >= 0 ? '#10B981' : '#DC2626'}
              />
              <Text style={[styles.depositDeltaText, { color: scoreDelta >= 0 ? '#10B981' : '#DC2626' }]}>
                {scoreDelta >= 0 ? '+' : ''}{scoreDelta}
              </Text>
              <Text style={styles.depositDeltaSuffix}>{t('reportV2.depositVsLast')}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

// Radial directions for the big centre-screen sparkle burst.
const DEPOSIT_CELEBRATION_RAYS = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);

/**
 * Full-screen, one-shot "+N" celebration that plays when a session's
 * emotional deposit is added to the running total: a big heart + "+N"
 * springs in dead centre with a sparkle burst, holds, then shrinks and
 * flies into the Emotional Deposit card's total (measured position, see
 * `target`), vanishing as it lands. Purely decorative
 * (pointerEvents="none"); calls onDone when the sequence finishes.
 */
const DepositCelebrationOverlay: React.FC<{
  amount: number;
  // Window-space centre of the running-total number to fly into; null until
  // the card has measured itself (falls back to a straight upward flight).
  target: { x: number; y: number } | null;
  onDone: () => void;
}> = ({ amount, target, onDone }) => {
  const pop = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  const containerRef = useRef<View>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const hit = setTimeout(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
      180
    );
    const seq = Animated.sequence([
      // Pop in + burst, then start flying toward the card at ~1s.
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
        Animated.timing(burst, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.timing(fly, { toValue: 1, duration: 560, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    seq.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => {
      clearTimeout(hit);
      seq.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly from the overlay's own centre to the card's total. Scale is applied
  // after the translations (transform list order = CSS order) so the deltas
  // stay in screen pixels.
  const canAim = !!(target && origin);
  const deltaX = canAim ? target!.x - origin!.x : 0;
  const deltaY = canAim ? target!.y - origin!.y : -240;

  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const flyScale = fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.18] });
  const scale = Animated.multiply(popScale, flyScale);
  const translateX = fly.interpolate({ inputRange: [0, 1], outputRange: [0, deltaX] });
  const translateY = fly.interpolate({ inputRange: [0, 1], outputRange: [0, deltaY] });
  const opacity = Animated.multiply(
    pop,
    fly.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] })
  );
  const burstOpacity = burst.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 1, 0] });

  return (
    <View
      ref={containerRef}
      style={styles.depositOverlay}
      pointerEvents="none"
      onLayout={() =>
        containerRef.current?.measureInWindow((x, y, w, h) => {
          if (w && h) setOrigin({ x: x + w / 2, y: y + h / 2 });
        })
      }
    >
      <Animated.View
        style={[
          styles.depositOverlayInner,
          { opacity, transform: [{ translateX }, { translateY }, { scale }] },
        ]}
      >
        <View style={styles.depositOverlaySparkleLayer}>
          {DEPOSIT_CELEBRATION_RAYS.map((angle, i) => {
            const dist = 96 + (i % 4) * 24;
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  opacity: burstOpacity,
                  transform: [
                    { translateX: Animated.multiply(burst, Math.cos(angle) * dist) },
                    { translateY: Animated.multiply(burst, Math.sin(angle) * dist) },
                    { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.2] }) },
                  ],
                }}
              >
                <Ionicons
                  name={i % 3 === 0 ? 'sparkles' : 'star'}
                  size={i % 2 === 0 ? 22 : 14}
                  color={i % 2 === 0 ? COLORS.mainPurple : '#F5B301'}
                />
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.depositOverlayPill}>
          <Ionicons name="heart" size={44} color="#FFFFFF" />
          <Text style={styles.depositOverlayAmount}>+{amount}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

export const ReportScreen_v3: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<ReportScreenV3RouteProp>();
  const { t } = useTranslation();
  const recordingService = useRecordingService();
  const authService = useAuthService();
  const { recordingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<RecordingAnalysis | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  const [prevScore, setPrevScore] = useState<number | null>(null);
  const [prevAreaCounts, setPrevAreaCounts] = useState<Record<string, number> | null>(null);
  // Sum of every prior completed session's score — the running "Total
  // Emotional Deposit" this session's score animates on top of. null until
  // the recordings list resolves (offline / first session → card just shows
  // today's score, no add-animation).
  const [depositTotalBefore, setDepositTotalBefore] = useState<number | null>(null);
  // Big centre-screen "+N" celebration — shown once, when this session's
  // deposit is added onto the running total.
  const [showDepositCelebration, setShowDepositCelebration] = useState(false);
  // Window-space centre of the running-total number, so the "+N" can fly
  // straight into it.
  const [depositTarget, setDepositTarget] = useState<{ x: number; y: number } | null>(null);

  const [parentLevel, setParentLevel] = useState<ParentSkillLevel>(1);
  // API field is level5QualifyingCount for legacy reasons (see
  // ParentSkillLevelInfo) — it now tracks Level 7's qualifying-session count.
  const [qualifyingCount, setQualifyingCount] = useState(0);
  // Set when this session's analysis pushed the parent up a level — swaps the
  // Parenting Level card for its "Level Up!" variant. Same local-cache
  // detection as ReportScreen_v2's LevelUpModal (@parent_skill_level_seen).
  const [levelUpInfo, setLevelUpInfo] = useState<{ from: ParentSkillLevel; to: ParentSkillLevel } | null>(null);

  // DEV-only: force a goal-card / level-up scenario for on-device preview.
  // 'live' = real data. The picker is rendered at the bottom only when __DEV__.
  const [devScenario, setDevScenario] = useState<'live' | 'inProgress' | 'achieved' | 'regressed' | 'levelup'>('live');

  useEffect(() => {
    amplitudeService.trackScreenView('Report', { recordingId, version: 'v3' });
    loadReportData();
    loadParentSkillLevel();
  }, [recordingId]);

  const loadParentSkillLevel = async () => {
    try {
      const info = await authService.getParentSkillLevel();
      setParentLevel(info.currentLevel);
      setQualifyingCount(info.level5QualifyingCount);

      // No server signal for "did this session level you up" — diff against
      // the last level we saw this user at, cached locally (a number so it
      // works across every transition). Same shape as ReportScreen_v2.
      const seenRaw = await userStorage.getItem('@parent_skill_level_seen');
      const seenLevel = seenRaw ? parseInt(seenRaw, 10) : null;
      if (seenLevel != null && info.currentLevel > seenLevel) {
        setLevelUpInfo({ from: seenLevel as ParentSkillLevel, to: info.currentLevel });
      }
      if (seenLevel == null || info.currentLevel > seenLevel) {
        await userStorage.setItem('@parent_skill_level_seen', String(info.currentLevel));
      }
    } catch (err) {
      // Keep default level 1 if the fetch fails
    }
  };

  // Non-critical: finds the previous completed session to diff score/areas
  // against. Failing silently (no previous session, offline, etc.) just
  // means the delta and today's-goal comparisons fall back gracefully.
  const loadPreviousComparison = async (current: RecordingAnalysis) => {
    try {
      const { recordings } = await recordingService.getRecordings();

      // Running total of all *other* completed sessions; today's score is
      // added on top by the card's animation.
      const totalBefore = (recordings || [])
        .filter((r: any) => r.analysisStatus === 'COMPLETED' && r.id !== recordingId)
        .reduce((sum: number, r: any) => sum + (r.overallScore || 0), 0);
      setDepositTotalBefore(totalBefore);
      if ((current.noraScore ?? 0) > 0) setShowDepositCelebration(true);

      const currentTime = new Date(current.createdAt).getTime();
      const previous = (recordings || [])
        .filter((r: any) => r.analysisStatus === 'COMPLETED' && r.id !== recordingId && new Date(r.createdAt).getTime() < currentTime)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (!previous) return;
      const prevAnalysis = await recordingService.getAnalysis(previous.id);
      setPrevScore(prevAnalysis.noraScore ?? null);
      const counts: Record<string, number> = {};
      (prevAnalysis.areasToAvoid || []).forEach((a: any) => { counts[a.label] = a.count || 0; });
      setPrevAreaCounts(counts);
    } catch (err) {
      // No previous session to compare against — fine, sections adapt.
    }
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await recordingService.getAnalysis(recordingId);
      setReportData(data);
      setLoading(false);
      loadPreviousComparison(data);
    } catch (err: any) {
      console.log('Report error:', err.message);

      if (err.message.includes('processing') && pollingCount < 20) {
        setPollingCount(prev => prev + 1);
        setTimeout(() => {
          loadReportData();
        }, 3000);
      } else if (pollingCount >= 20) {
        setError('Analysis is taking longer than expected. Please try again later.');
        setLoading(false);
      } else {
        setError(err.message || t('report.failedToLoad'));
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleContinueToCoaching = () => {
    amplitudeService.trackEvent('Report V2 Continue To Coaching Tapped', { recordingId });
    navigation.navigate('ReportDetail', { recordingId });
  };

  const handleLevelCardPress = () => {
    amplitudeService.trackEvent('Report Parenting Level Tapped', { level: parentLevel, recordingId });
    navigation.navigate('ParentLevelDetail', { level: parentLevel });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
          <Text style={styles.loadingText}>
            {pollingCount > 0 ? t('report.analyzingSession') : t('report.loadingReport')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !reportData) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#E74C3C" />
          <Text style={styles.errorText}>{error || t('report.failedToLoad')}</Text>
          <Button onPress={loadReportData} variant="primary">
            {t('report.tryAgain')}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const score = reportData.noraScore ?? 0;
  const isAmazing = score >= 90;
  const scoreDelta = prevScore != null ? score - prevScore : null;

  // Today's Goal — the areasToAvoid entry (excluding PDI Commands) with the
  // highest count this session; skipped when nothing needs reducing.
  const filteredAreas = reportData.areasToAvoid.filter(
    a => !(reportData.mode === 'PDI' && a.label === 'Commands')
  );
  const goalArea = filteredAreas.reduce<{ label: string; count: number } | null>(
    (max, a) => (a.count > (max?.count ?? 0) ? a : max),
    null
  );
  const goalPreviousCount = goalArea && prevAreaCounts ? prevAreaCounts[goalArea.label] ?? null : null;
  // Three states for the goal card:
  //  - 'achieved'  : count reached zero → "You did it!"
  //  - 'regressed' : count went UP vs last session → "Not yet today.", with a
  //                  softer "we'll practice together" message
  //  - 'inProgress': everything else (improved but not zero, or no prior data)
  //                  → "Almost there!" + "You've already improved. Keep going!"
  // 'regressed' needs the previous-session count, so until loadPreviousComparison
  // resolves the card sits in 'inProgress'.
  const goalStateReal: 'achieved' | 'regressed' | 'inProgress' = !goalArea
    ? 'inProgress'
    : goalArea.count === 0
      ? 'achieved'
      : goalPreviousCount != null && goalArea.count > goalPreviousCount
        ? 'regressed'
        : 'inProgress';
  // DEV override (see devScenario). 'levelup' also puts the goal card in its
  // achieved state to match the celebration mock.
  const goalState: 'achieved' | 'regressed' | 'inProgress' =
    __DEV__ && devScenario !== 'live'
      ? (devScenario === 'levelup' ? 'achieved' : devScenario)
      : goalStateReal;
  const levelUp = __DEV__ && devScenario === 'levelup'
    ? { from: 3 as ParentSkillLevel, to: 4 as ParentSkillLevel }
    : levelUpInfo;
  const goalSkillLabel = goalArea ? getSkillDisplayLabel(goalArea.label, t) : null;
  const goalSkillForCount = (count: number) => {
    const plural = goalSkillLabel?.toLowerCase() ?? '';
    return count === 1 && plural.endsWith('s') ? plural.slice(0, -1) : plural;
  };

  // Hero (dragon + headline) adapts to the session outcome:
  //  - levelup   : centered celebration, "Amazing session!"
  //  - regressed : "Every play helps." + reassurance, row layout
  //  - amazing   : score >= 90, "Amazing session!", row layout
  //  - good      : default, "Good progress!" + "keep it up", row layout
  const heroVariant: 'levelup' | 'regressed' | 'amazing' | 'good' =
    levelUp ? 'levelup'
      : goalState === 'regressed' ? 'regressed'
        : isAmazing ? 'amazing'
          : 'good';
  const heroConfig = {
    levelup:   { image: REPORT_DRAGON_LEVELUP,   headlineKey: 'reportV2.headlineAmazing',   subtextKey: null as string | null,               centered: true },
    regressed: { image: REPORT_DRAGON_REGRESSED, headlineKey: 'reportV2.headlineEveryPlay',  subtextKey: 'reportV2.headlineEveryPlaySubtext', centered: false },
    amazing:   { image: REPORT_DRAGON_AMAZING,   headlineKey: 'reportV2.headlineAmazing',    subtextKey: null as string | null,               centered: false },
    good:      { image: REPORT_DRAGON_GOOD,      headlineKey: 'reportV2.headlineGood',       subtextKey: 'reportV2.headlineSubtext',          centered: false },
  }[heroVariant];

  // Parenting-level progress — the server exposes no "% toward next level",
  // so derive a rough fill from this session's counts vs the level's target
  // (same targets the level-up gate uses; see goalFallback /
  // parentLevelLadder.cjs). It's a single-session approximation, not the
  // real multi-session gate. Level 7's real 2-session counter takes over
  // when the session has no numeric target for that level.
  const levelGoal = deriveGoalFromLevel(parentLevel, reportData.stats, reportData.mode, t);
  let levelProgress: number | null = null;
  if (typeof levelGoal.targetNumber === 'number' && levelGoal.currentNumber != null && levelGoal.targetNumber > 0) {
    const n = levelGoal.currentNumber;
    const target = levelGoal.targetNumber;
    levelProgress = levelGoal.direction === 'build'
      ? Math.min(n / target, 1)
      : (n <= target ? 1 : Math.max(0, Math.min(target / n, 1)));
  } else if (parentLevel === 7) {
    levelProgress = Math.min(qualifyingCount / LEVEL_7_QUALIFYING_TARGET, 1);
  }
  const levelPercent = levelProgress != null ? Math.round(levelProgress * 100) : null;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.heroSection, heroConfig.centered && styles.heroSectionCentered]}>
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.heroBackButton, heroConfig.centered && styles.heroBackButtonAbs]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>

          {heroConfig.centered ? (
            <>
              <Image source={heroConfig.image} style={styles.dragonImageLarge} resizeMode="contain" />
              <Text style={[styles.headline, styles.headlineCentered]}>{t(heroConfig.headlineKey)}</Text>
            </>
          ) : (
            <>
              <Image source={heroConfig.image} style={styles.dragonImage} resizeMode="contain" />
              <View style={styles.heroTextCol}>
                <Text style={styles.headline}>{t(heroConfig.headlineKey)}</Text>
                {heroConfig.subtextKey && (
                  <Text style={styles.headlineSubtext}>{t(heroConfig.subtextKey)}</Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* Emotional Deposit — running total + "add today's deposit" animation */}
        <EmotionalDepositCard
          key={__DEV__ && devScenario !== 'live' ? `dev-${devScenario}` : 'live'}
          todayScore={score}
          totalBefore={
            __DEV__ && devScenario !== 'live' ? 1240 : depositTotalBefore
          }
          scoreDelta={scoreDelta}
          t={t}
          onMeasureTarget={setDepositTarget}
        />

        {/* Today's Goal */}
        {goalArea && goalSkillLabel && (
          <View style={[styles.goalCard, goalState === 'regressed' && styles.goalCardRegressed]}>
            <View style={styles.goalTopRow}>
              <View style={styles.goalHeaderCol}>
                <View style={styles.goalHeaderRow}>
                  <Image source={REPORT_TARGET_SMALL} style={styles.goalIconImage} resizeMode="contain" />
                  <Text style={[styles.goalLabel, goalState === 'regressed' && { color: '#D97706' }]}>
                    {t('reportV2.todaysGoal')}
                  </Text>
                </View>
                <Text style={styles.goalTitle}>{t('reportV2.reduceSkill', { skill: goalSkillLabel })}</Text>
                <View style={styles.goalTitleDivider} />

                <View style={styles.goalStatusRow}>
                  {goalState === 'achieved' ? (
                    <Ionicons name="checkmark-circle" size={16} color="#44A135" />
                  ) : goalState === 'regressed' ? (
                    <Ionicons name="alert-circle" size={16} color="#D97706" />
                  ) : (
                    <Image source={REPORT_STAR_SMALL} style={styles.goalStatusImage} resizeMode="contain" />
                  )}
                  <Text style={[styles.goalStatusText, { color: goalState === 'achieved' ? '#44A135' : '#D97706' }]}>
                    {goalState === 'achieved'
                      ? t('reportV2.youDidIt')
                      : goalState === 'regressed'
                        ? t('reportV2.notYetToday')
                        : t('reportV2.almostThere')}
                  </Text>
                </View>

                <Text style={styles.goalCountText}>
                  <Trans
                    i18nKey={goalState === 'achieved' ? 'reportV2.onlyCountToday' : 'reportV2.countToday'}
                    values={{ count: goalArea.count, skill: goalSkillForCount(goalArea.count) }}
                    components={[<Text style={styles.goalCountBold} />]}
                  />
                </Text>
                {goalPreviousCount != null && (
                  <Text style={styles.goalCountMuted}>
                    {t(goalState === 'achieved' ? 'reportV2.lastTime' : 'reportV2.lastSession', { count: goalPreviousCount })}
                  </Text>
                )}
              </View>
              <View style={styles.goalRightCol}>
                <Image
                  source={goalState === 'regressed' ? REPORT_TARGET_ORANGE : REPORT_TARGET}
                  style={styles.goalTargetImage}
                  resizeMode="contain"
                />
                {goalState === 'regressed' ? (
                  <Text style={styles.goalEncouragementRight}>{t('reportV2.goalRegressedEncouragement')}</Text>
                ) : goalState === 'inProgress' ? (
                  <Text style={styles.goalEncouragementRight}>{t('reportV2.goalEncouragement')}</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* Parenting Level — taps through to the full level ladder */}
        <TouchableOpacity style={styles.levelCard} activeOpacity={0.85} onPress={handleLevelCardPress}>
          <View style={styles.levelHeaderRow}>
            <View style={styles.levelStarBadge}>
              <Ionicons name="star" size={13} color={COLORS.mainPurple} />
            </View>
            <Text style={styles.levelHeaderLabel}>{t('reportV2.parentingLevel')}</Text>
            {!levelUp && (
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={styles.levelHeaderChevron} />
            )}
          </View>

          {levelUp ? (
            <View style={styles.levelUpBody}>
              <View style={styles.levelUpHexRow}>
                <LevelHexagon level={levelUp.from} filled size={44} />
                <Ionicons name="arrow-forward" size={16} color={COLORS.mainPurple} style={styles.levelUpArrow} />
                <LevelHexagon level={levelUp.to} size={52} />
              </View>
              <View style={styles.levelUpTextCol}>
                <Text style={styles.levelUpHeadline}>{t('reportV2.levelUpHeadline')}</Text>
                <Text style={styles.levelUpReached}>
                  <Trans
                    i18nKey="reportV2.levelUpReached"
                    values={{ level: levelUp.to }}
                    components={[<Text style={styles.levelUpReachedBold} />]}
                  />
                </Text>
                <Text style={styles.levelSubtitle}>
                  {t(`profileReport.levels.${PARENT_SKILL_LEVEL_KEYS[levelUp.to]}.title`)}
                </Text>
              </View>
              <MaterialCommunityIcons name="trophy" size={56} color="#E4B44C" style={styles.levelUpTrophy} />
            </View>
          ) : (
            <View style={styles.levelBodyRow}>
              <View style={styles.levelNumberBadge}>
                <Text style={styles.levelNumberText}>{parentLevel}</Text>
              </View>
              <View style={styles.levelProgressCol}>
                <Text style={styles.levelTitle}>{t('reportV2.levelHeading', { level: parentLevel })}</Text>
                <Text style={styles.levelSubtitle}>
                  {t(`profileReport.levels.${PARENT_SKILL_LEVEL_KEYS[parentLevel]}.title`)}
                </Text>
                {/* Approximate fill derived from this session vs the level's
                    target — see levelProgress above. Hidden when nothing can
                    be derived (e.g. top level, or a session off this level's track). */}
                {levelPercent != null && (
                  <View style={styles.levelProgressRow}>
                    <View style={styles.levelProgressTrack}>
                      <View style={[styles.levelProgressFill, { width: `${levelPercent}%` }]} />
                    </View>
                    <Text style={styles.levelPercentText}>{levelPercent}%</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.continueButton} onPress={handleContinueToCoaching} activeOpacity={0.85}>
          <Text style={styles.continueButtonText}>{t('reportV2.continueToCoaching')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {__DEV__ && (
          <View style={styles.devBar}>
            <Text style={styles.devBarLabel}>PREVIEW (dev only)</Text>
            <View style={styles.devBarRow}>
              {(['live', 'inProgress', 'achieved', 'regressed', 'levelup'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => { setDevScenario(s); setShowDepositCelebration(true); }}
                  style={[styles.devChip, devScenario === s && styles.devChipActive]}
                >
                  <Text style={[styles.devChipText, devScenario === s && styles.devChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {showDepositCelebration && score > 0 && (
        <DepositCelebrationOverlay
          key={__DEV__ ? devScenario : 'live'}
          amount={score}
          target={depositTarget}
          onDone={() => setShowDepositCelebration(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  devBar: {
    marginTop: 20,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  devBarLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  devBarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  devChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  devChipActive: {
    backgroundColor: COLORS.mainPurple,
  },
  devChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#4B5563',
  },
  devChipTextActive: {
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textDark,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#E74C3C',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // ── Hero ──
  heroSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  // Centered celebration variant (level-up): dragon stacked over the headline.
  // Kept compact so the report cards below stay near the top of the scroll.
  heroSectionCentered: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 12,
  },
  heroBackButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: 16,
  },
  heroBackButtonAbs: {
    position: 'absolute',
    left: 0,
    top: 4,
    marginTop: 0,
    zIndex: 2,
  },
  dragonImage: {
    width: 150,
    height: 150,
  },
  dragonImageLarge: {
    // fixed px (not %+aspectRatio — that collapsed the height calc and
    // letterboxed the dragon inside a screen-tall box). Ratio matches the
    // 2202×1952 source; negative margins clip its transparent padding.
    width: 228,
    height: 202,
    marginTop: -17,
    marginBottom: -19,
  },
  heroTextCol: {
    flex: 1,
    marginLeft: 10,
    marginTop: 16,
  },
  headline: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.mainPurple,
  },
  headlineCentered: {
    fontSize: 29,
    textAlign: 'center',
    marginTop: 0,
  },
  headlineSubtext: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textDark,
    marginTop: 10,
    lineHeight: 23,
  },

  // ── Emotional Deposit card ──
  depositCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7FE',
    borderRadius: 20,
    padding: 18,
    marginBottom: 10,
    gap: 12,
  },
  depositIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  depositScoreCol: {
    flex: 1,
  },
  depositNumberWrap: {
    alignSelf: 'stretch',
  },
  depositScoreText: {
    fontFamily: FONTS.bold,
    fontSize: 34,
    color: COLORS.mainPurple,
  },
  depositSparkleLayer: {
    position: 'absolute',
    left: 26,
    top: 20,
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textDark,
  },
  depositRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  depositDivider: {
    width: 1,
    height: 46,
    backgroundColor: '#E9DFFC',
  },
  depositRightInner: {
    alignItems: 'flex-end',
  },
  depositTodayValue: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: '#10B981',
  },
  depositTodayLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  depositDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  depositDeltaText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  depositDeltaSuffix: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 2,
  },

  // ── Deposit celebration overlay (big centre-screen "+N") ──
  depositOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  depositOverlayInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositOverlaySparkleLayer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositOverlayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#047857',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 999,
    shadowColor: '#047857',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  depositOverlayAmount: {
    fontFamily: FONTS.bold,
    fontSize: 64,
    color: '#FFFFFF',
  },

  // ── Today's Goal card ──
  goalCard: {
    backgroundColor: '#FAFBF6',
    borderRadius: 20,
    padding: 18,
    marginBottom: 10,
  },
  // Worse-than-last-session state: warm light-orange card.
  goalCardRegressed: {
    backgroundColor: '#FEF9F3',
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  goalHeaderCol: {
    flex: 1,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  goalIconImage: {
    width: 26,
    height: 26,
  },
  goalStatusImage: {
    width: 20,
    height: 20,
  },
  goalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#44A135',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'left',
  },
  goalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 10,
    textAlign: 'left',
    marginLeft:33,
  },
  goalTitleDivider: {
    height: 1,
    backgroundColor: '#DCE7DF',
    marginBottom: 10,
  },
  goalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  goalStatusText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    textAlign: 'left',
    marginLeft:7,
  },
  goalCountText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
    textAlign: 'left',
    marginLeft:33,
  },
  goalCountBold: {
    fontFamily: FONTS.bold,
    color: '#D97706',
  },
  goalCountMuted: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'left',
    marginLeft: 33,
  },
  goalRightCol: {
    width: 132,
    alignItems: 'center',
    marginLeft: 8,
    marginTop: -12,
  },
  goalTargetImage: {
    width: 108,
    height: 108,
  },
  goalEncouragementRight: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
    // pulled up so the first line sits level with "…次問句" on the left
    marginTop: -2,
    lineHeight: 20,
    textAlign: 'center',
  },

  // ── Parenting Level card ──
  // Kept roughly level with the Emotional Deposit card: tight vertical
  // padding, compact header gap, no separate "% toward next level" footer.
  levelCard: {
    backgroundColor: '#FAF7FE',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 24,
  },
  levelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  levelHeaderChevron: {
    marginLeft: 'auto',
  },
  levelStarBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelHeaderLabel: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.mainPurple,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelNumberBadge: {
    width: 40,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.mainPurple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelNumberText: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: '#FFFFFF',
  },
  levelProgressCol: {
    flex: 1,
  },
  levelTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
  },
  levelSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 6,
  },
  levelProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelProgressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5D9FA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    backgroundColor: COLORS.mainPurple,
    borderRadius: 3,
  },
  levelPercentText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.mainPurple,
  },

  // ── Parenting Level card — "Level Up!" variant ──
  levelUpBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelUpHexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelUpArrow: {
    marginHorizontal: 2,
  },
  levelUpTextCol: {
    flex: 1,
  },
  levelUpHeadline: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.mainPurple,
  },
  levelUpReached: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    marginTop: 2,
    lineHeight: 21,
  },
  levelUpReachedBold: {
    fontFamily: FONTS.bold,
    color: COLORS.mainPurple,
  },
  levelUpTrophy: {
    marginLeft: 'auto',
  },

  // ── CTA ──
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 28,
    paddingVertical: 16,
  },
  continueButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
});
