/**
 * Home Screen v2
 * Redesigned homepage with arc hero, weekly emotional bank stats, and today's plan
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Video, ResizeMode } from 'expo-av';
import { ProfileCircle } from '../components/ProfileCircle';
import { COLORS, FONTS } from '../constants/assets';

const DRAGON_ANIMATION = require('../../assets/images/Dragon_anime.mov');
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService, useAuthService, useRecordingService } from '../contexts/AppContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getTodaySingapore, toSingaporeDateString, getStartOfTodaySingapore, getEndOfTodaySingapore } from '../utils/timezone';
import * as userStorage from '../lib/userStorage';
import type { RelationshipToChild } from '@nora/core';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WeeklyStats {
  daysCompleted: number;      // days with activity out of 7
  minutesPlayed: number;      // total minutes across all recordings this week
  timesRecorded: number;      // number of recordings this week
  lessonsCompleted: number;   // lessons completed this week
}

interface TodayPlanItem {
  id: string;
  type: 'lesson' | 'record';
  label: string;
  title: string;
  duration?: string;
  isCompleted: boolean;
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

const RING_SIZE = 52;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface StatPillProps {
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  total: string;
  unit: string;
  onPress?: () => void;
}

const StatPill: React.FC<StatPillProps> = ({ iconName, iconColor, value, total, unit, onPress }) => {
  const progress = Math.min(Number(value) / Number(total), 1);
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <TouchableOpacity style={styles.statPill} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      {/* Circular progress ring with icon centered */}
      <View style={styles.statRingWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          {/* Track */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="#E5E7EB"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          {/* Progress arc */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={iconColor}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={[RING_CIRCUMFERENCE, RING_CIRCUMFERENCE]}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
          />
        </Svg>
        {/* Icon overlaid in center */}
        <View style={styles.statRingIcon}>
          <Ionicons name={iconName} size={18} color="#9CA3AF" />
        </View>
      </View>

      <Text style={styles.statValue}>
        <Text style={styles.statValueBold}>{value}</Text>
        <Text style={styles.statValueMuted}>/{total}</Text>
      </Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </TouchableOpacity>
  );
};

// ─── Today Plan Item ─────────────────────────────────────────────────────────

interface PlanItemProps {
  item: TodayPlanItem;
  onPress: () => void;
}

const PlanItem: React.FC<PlanItemProps> = ({ item, onPress }) => (
  <TouchableOpacity style={styles.planItem} onPress={onPress} activeOpacity={0.7}>
    {/* Checkbox */}
    <View style={[styles.planCheckbox, item.isCompleted && styles.planCheckboxDone]}>
      {item.isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
    </View>

    {/* Rocket / Book icon */}
    {/* <View style={styles.planIconBg}>
      <Text style={styles.planEmoji}>{item.type === 'lesson' ? '🚀' : '🎙️'}</Text>
    </View> */}

    {/* Text */}
    <View style={styles.planTextWrap}>
      <Text style={styles.planItemText} numberOfLines={2}>
        <Text style={styles.planItemBold}>{item.label} </Text>
        {item.title}
        {item.duration ? <Text style={styles.planItemMuted}> ({item.duration})</Text> : null}
      </Text>
    </View>
  </TouchableOpacity>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const HomeScreen_v2: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { width: screenWidth } = useWindowDimensions();
  const lessonService = useLessonService();
  const authService = useAuthService();
  const recordingService = useRecordingService();
  const { isOnline } = useNetworkStatus();

  const dragonVideoRef = useRef<Video>(null);

  // ── User state ──
  const [userName, setUserName] = useState('');
  const [childName, setChildName] = useState('your child');
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>();
  const [relationshipToChild, setRelationshipToChild] = useState<RelationshipToChild | undefined>();

  // ── Data state ──
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    daysCompleted: 0,
    minutesPlayed: 0,
    timesRecorded: 0,
    lessonsCompleted: 0,
  });
  const [weeklyScore, setWeeklyScore] = useState<{ score: number; maxScore: number }>({ score: 0, maxScore: 300 });
  const [todayPlan, setTodayPlan] = useState<TodayPlanItem[]>([]);
  const [isLessonCompleted, setIsLessonCompleted] = useState(false);
  const [hasRecordedSession, setHasRecordedSession] = useState(false);
  const [isReportRead, setIsReportRead] = useState(false);
  const [latestRecordingId, setLatestRecordingId] = useState<string | null>(null);
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);

  // ── Derived ──
  // Initials from first two words of name, or first two chars
  const userInitials = userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || '??';

  // ─── Load user profile ────────────────────────────────────────────────────

  const loadUserProfile = async () => {
    try {
      if (!authService.isAuthenticated()) return;
      const user = await authService.getCurrentUser();
      setProfileImageUrl(user.profileImageUrl);
      setRelationshipToChild(user.relationshipToChild);
      if (user.name) setUserName(user.name);
      if (user.childName) setChildName(user.childName);
    } catch {
      // non-critical
    }
  };

  // ─── Load dashboard data ──────────────────────────────────────────────────

  // mode: 'full' = show loading spinner, 'refresh' = pull-to-refresh indicator, 'background' = no indicator
  const loadData = async (mode: 'full' | 'refresh' | 'background' = 'full') => {
    try {
      if (mode === 'full') setLoading(true);
      else if (mode === 'refresh') setIsRefreshing(true);

      const [dashboardData, lessonsResponse] = await Promise.all([
        recordingService.getDashboard(),
        lessonService.getLessons(),
      ]);

      const { todayRecordings, thisWeekRecordings, latestWithReport } = dashboardData;
      const { lessons } = lessonsResponse;

      // ── Weekly stats ──
      const today = getTodaySingapore();
      const uniqueDays = new Set(
        thisWeekRecordings.map((r: any) => toSingaporeDateString(new Date(r.createdAt)))
      );

      // Count lessons completed this week
      const startOfWeek = (() => {
        const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const day = d.getUTCDay();
        const monday = new Date(d);
        monday.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
        monday.setUTCHours(0, 0, 0, 0);
        return monday;
      })();

      const lessonsThisWeek = lessons.filter((l: any) => {
        if (l.progress?.status !== 'COMPLETED' || !l.progress?.completedAt) return false;
        return new Date(l.progress.completedAt) >= startOfWeek;
      });

      // Approximate minutes: assume 5 min per recording (actual duration not in API)
      const minutesPlayed = thisWeekRecordings.length * 5;

      setWeeklyStats({
        daysCompleted: uniqueDays.size,
        minutesPlayed,
        timesRecorded: thisWeekRecordings.length,
        lessonsCompleted: lessonsThisWeek.length,
      });

      // ── Lesson completed today ──
      const todayStart = getStartOfTodaySingapore();
      const todayEnd = getEndOfTodaySingapore();
      const todayCompletedLesson = lessons.find((l: any) => {
        if (l.progress?.status !== 'COMPLETED' || !l.progress?.completedAt) return false;
        const d = new Date(l.progress.completedAt);
        return d >= todayStart && d <= todayEnd;
      });
      setIsLessonCompleted(!!todayCompletedLesson);

      // ── Recording completed today ──
      const hasCompleted = todayRecordings.some(
        (r: any) => r.analysisStatus === 'COMPLETED'
      );
      setHasRecordedSession(hasCompleted);
      const latestCompleted = todayRecordings.find((r: any) => r.analysisStatus === 'COMPLETED');
      if (latestCompleted) {
        setLatestRecordingId(latestCompleted.id);
        // Check if report was already read today
        const reportReadKey = `report_read_${getTodaySingapore()}`;
        const reportReadId = await userStorage.getItem(reportReadKey);
        setIsReportRead(reportReadId === latestCompleted.id);
      } else {
        setIsReportRead(false);
      }

      // ── Weekly score — sum of all completed session scores this week (max 300) ──
      const weeklyScoreSum = thisWeekRecordings
        .filter((r: any) => r.analysisStatus === 'COMPLETED' && r.overallScore !== undefined)
        .reduce((sum: number, r: any) => sum + Math.round(r.overallScore), 0);
      setWeeklyScore({ score: Math.min(weeklyScoreSum, 300), maxScore: 300 });

      // ── Today's plan ──
      const nextLesson = lessons.find((l: any) => l.progress?.status !== 'COMPLETED');
      setNextLessonId(nextLesson?.id ?? null);
      const plan: TodayPlanItem[] = [];

      const lessonForPlan = todayCompletedLesson || nextLesson;
      if (lessonForPlan) {
        plan.push({
          id: lessonForPlan.id,
          type: 'lesson',
          label: 'Daily Learning:',
          title: lessonForPlan.title,
          duration: '5 min read',
          isCompleted: !!todayCompletedLesson,
        });
      }

      // Always show Record Session regardless of lesson completion
      plan.push({
        id: 'record',
        type: 'record',
        label: 'Record Session:',
        title: `5-minute play with ${childName}`,
        isCompleted: hasCompleted,
      });

      setTodayPlan(plan);
    } catch (err) {
      console.log('[HomeScreen_v2] Failed to load data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  useEffect(() => {
    loadUserProfile();
    loadData('full');
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData('background');
      dragonVideoRef.current?.playAsync();
    }, [])
  );

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleProfilePress = () => navigation.push('Profile');

  const handleRecordPress = () => {
    navigation.navigate('MainTabs', { screen: 'Record' });
  };

  const handleReadReport = async () => {
    if (!latestRecordingId) return;
    const reportReadKey = `report_read_${getTodaySingapore()}`;
    await userStorage.setItem(reportReadKey, latestRecordingId);
    setIsReportRead(true);
    navigation.push('Report', { recordingId: latestRecordingId });
  };

  const handleRecordAgain = async () => {
    const reportReadKey = `report_read_${getTodaySingapore()}`;
    await userStorage.removeItem(reportReadKey);
    setIsReportRead(false);
    navigation.navigate('MainTabs', { screen: 'Record' });
  };

  const handlePlanItemPress = (item: TodayPlanItem) => {
    if (item.type === 'lesson') {
      navigation.push('LessonViewer', { lessonId: item.id });
    } else {
      handleRecordPress();
    }
  };

  // ─── Arc dimensions ───────────────────────────────────────────────────────

  const arcDiameter = screenWidth * 0.82;
  const arcStrokeWidth = 10;
  const arcRadius = (arcDiameter - arcStrokeWidth) / 2;
  const arcCircumference = 2 * Math.PI * arcRadius;
  // Show 60% of the circle as the visible arc (216°), centered at 12 o'clock
  const arcFraction = 0.5;
  const arcVisibleLength = arcCircumference * arcFraction;
  // Rotate so the arc is centered at the top (270° in SVG = 12 o'clock)
  const arcRotation = 270 - arcFraction * 180;
  // Container height: enough to show the top portion + extra for rounded end caps
  const arcContainerHeight = arcDiameter * 0.52 + arcStrokeWidth;

  // ─── Arc positions ────────────────────────────────────────────────────────
  const svgTopOffset = arcContainerHeight - arcStrokeWidth - arcDiameter / 2 - arcStrokeWidth / 2;

  // Score dot — moves with the score
  const scoreAngleDeg = arcRotation + arcFraction * (weeklyScore.score / weeklyScore.maxScore) * 360;
  const scoreAngleRad = (scoreAngleDeg * Math.PI) / 180;
  const dotSvgX = screenWidth / 2 + arcRadius * Math.cos(scoreAngleRad);
  const dotSvgY = arcDiameter / 2 + arcRadius * Math.sin(scoreAngleRad);
  const dotX = dotSvgX;
  const dotY = svgTopOffset + dotSvgY;

  // Fixed right end of the arc track
  const arcEndAngleRad = ((arcRotation + arcFraction * 360) * Math.PI) / 180;
  const arcEndSvgX = screenWidth / 2 + arcRadius * Math.cos(arcEndAngleRad);
  const arcEndSvgY = arcDiameter / 2 + arcRadius * Math.sin(arcEndAngleRad);
  const arcEndX = arcEndSvgX;
  const arcEndY = svgTopOffset + arcEndSvgY;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
        </View>
      </SafeAreaView>
    );
  }

  const scoreText = `${weeklyScore.score}/${weeklyScore.maxScore}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadData('refresh')}
              enabled={isOnline}
              tintColor={COLORS.mainPurple}
            />
          }
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Home</Text>
            <ProfileCircle
              size={44}
              imageUrl={profileImageUrl}
              relationshipToChild={relationshipToChild}
              onPress={handleProfilePress}
            />
          </View>

          {/* Arc */}
          <View style={[styles.arcContainer, { height: arcContainerHeight }]}>

          {/* Dragon animation — rendered first so arc draws on top */}
          <Video
            ref={dragonVideoRef}
            source={DRAGON_ANIMATION}
            style={styles.dragonImage}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            isMuted
            useNativeControls={false}
          />

          {/* SVG arc — centered horizontally, circle center at container bottom */}
          <Svg
            width={screenWidth}
            height={arcDiameter}
            style={{
              position: 'absolute',
              top: arcContainerHeight - arcStrokeWidth - arcDiameter / 2 - arcStrokeWidth / 2,
            }}
          >
            <Defs>
              <SvgLinearGradient id="arcGradient" x1="100%" y1="0%" x2="0%" y2="0%">
                <Stop offset="0%" stopColor="#C8A8F0" />
                <Stop offset="100%" stopColor={COLORS.mainPurple} />
              </SvgLinearGradient>
            </Defs>

            {/* Grey track — full arc length */}
            <Circle
              cx={screenWidth / 2}
              cy={arcDiameter / 2}
              r={arcRadius}
              stroke="#E0D6F5"
              strokeWidth={arcStrokeWidth}
              fill="none"
              strokeDasharray={[arcVisibleLength, arcCircumference]}
              strokeLinecap="round"
              transform={`rotate(${arcRotation}, ${screenWidth / 2}, ${arcDiameter / 2})`}
            />
            {/* Gradient fill — proportional to score/300 */}
            <Circle
              cx={screenWidth / 2}
              cy={arcDiameter / 2}
              r={arcRadius}
              stroke="url(#arcGradient)"
              strokeWidth={arcStrokeWidth}
              fill="none"
              strokeDasharray={[arcVisibleLength * (weeklyScore.score / weeklyScore.maxScore), arcCircumference]}
              strokeLinecap="round"
              transform={`rotate(${arcRotation}, ${screenWidth / 2}, ${arcDiameter / 2})`}
            />
            {/* Score endpoint dot */}
            {weeklyScore.score > 0 && (
              <Circle
                cx={dotSvgX}
                cy={dotSvgY}
                r={7}
                fill="#ffffff"
                stroke={COLORS.mainPurple}
                strokeWidth={2.5}
              />
            )}
          </Svg>

          {/* Score label bubble at dot position */}
          {weeklyScore.score > 0 && (
            <View
              style={[
                styles.scoreBubble,
                {
                  left: Math.max(16, Math.min(screenWidth - 176, dotX - 80)),
                  top: dotY - 64,
                },
              ]}
            >
              <Text style={styles.scoreBubbleText}>
                {userInitials}'s Weekly Deposit
              </Text>
              <Text style={styles.scoreBubbleScore}>{scoreText}</Text>
            </View>
          )}
          </View>

          {/* ── Weekly title ── */}
        {/* <Text style={styles.weeklyTitle}>
          <Text style={styles.weeklyTitleBold}>{userInitials}'s Weekly Deposit</Text>
        </Text> */}

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatPill
            iconName="flame"
            iconColor={COLORS.mainPurple}
            value={String(weeklyStats.daysCompleted)}
            total="7"
            unit="days"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Record' })}
          />
          <StatPill
            iconName="flash"
            iconColor="#10B981"
            value={String(weeklyStats.minutesPlayed)}
            total="35"
            unit="mins"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Record' })}
          />
          <StatPill
            iconName="happy-outline"
            iconColor={COLORS.mainPurple}
            value={String(weeklyStats.timesRecorded)}
            total="7"
            unit="times"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Record' })}
          />
          <StatPill
            iconName="book-outline"
            iconColor="#10B981"
            value={String(weeklyStats.lessonsCompleted)}
            total="7"
            unit="lessons"
            onPress={() => nextLessonId && navigation.push('LessonViewer', { lessonId: nextLessonId })}
          />
        </View>

        {/* ── Daily Emotional Massage card ── */}
        <View style={styles.massageCard}>
          <View style={styles.massageHeader}>
            <View style={styles.greenDot} />
            <Text style={styles.massageLabel}>Daily Emotional Massage</Text>
          </View>

          {!hasRecordedSession && (
            <>
              <Text style={styles.massageBody}>
                {`Let `}
                <Text style={styles.massageChildName}>{childName}</Text>
                {` lead today's 5-minute play to grow their emotional bank. Enjoy easy progress every day and see `}
                <Text style={styles.massageChildName}>{childName}</Text>
                {`'s development.`}
              </Text>
              <TouchableOpacity
                style={[styles.recordButton, !isOnline && styles.recordButtonDisabled]}
                onPress={handleRecordPress}
                activeOpacity={0.85}
                disabled={!isOnline}
              >
                <Ionicons name="mic" size={20} color="#fff" />
                <Text style={styles.recordButtonText}>Record the Playtime Now</Text>
              </TouchableOpacity>
            </>
          )}

          {hasRecordedSession && !isReportRead && (
            <>
              <Text style={styles.massageBody}>
                {'Great job! Your session report is ready. See how '}
                <Text style={styles.massageChildName}>{childName}</Text>
                {' did today.'}
              </Text>
              <TouchableOpacity
                style={[styles.recordButton, !isOnline && styles.recordButtonDisabled]}
                onPress={handleReadReport}
                activeOpacity={0.85}
                disabled={!isOnline}
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.recordButtonText}>Read Today's Report</Text>
              </TouchableOpacity>
            </>
          )}

          {hasRecordedSession && isReportRead && (
            <>
              <Text style={styles.massageBody}>
                {'Want to practice again? Record another session with '}
                <Text style={styles.massageChildName}>{childName}</Text>
                {' to keep improving.'}
              </Text>
              <TouchableOpacity
                style={[styles.recordButton, !isOnline && styles.recordButtonDisabled]}
                onPress={handleRecordAgain}
                activeOpacity={0.85}
                disabled={!isOnline}
              >
                <Ionicons name="mic" size={20} color="#fff" />
                <Text style={styles.recordButtonText}>Record Again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Today's plan ── */}
        {todayPlan.length > 0 && (
          <View style={styles.planSection}>
            <Text style={styles.planTitle}>Today's plan</Text>
            {todayPlan.map(item => (
              <PlanItem
                key={item.id}
                item={item}
                onPress={() => handlePlanItemPress(item)}
              />
            ))}
          </View>
        )}
        </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textDark,
  },

  // Arc hero
  arcContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  dragonImage: {
    position: 'absolute',
    bottom: -50,
    width: 200,
    height: 200,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
  },
  scoreBubble: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
    width: 160,
  },
  scoreBubbleText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  scoreBubbleScore: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.mainPurple,
    textAlign: 'center',
    marginTop: 2,
  },

  // Weekly title
  weeklyTitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textDark,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 14,
    paddingHorizontal: 24,
  },
  weeklyTitleBold: {
    fontFamily: FONTS.regular,
    color: "#1E2939",
    marginRight:10,
    textAlign: 'right',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4,
    marginTop: 70,
  },
  statPill: {
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
  },
  statRingWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRingIcon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 13,
    textAlign: 'center',
  },
  statValueBold: {
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
  },
  statValueMuted: {
    fontFamily: FONTS.regular,
    color: '#9CA3AF',
  },
  statUnit: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#6B7280',
  },

  // Daily Emotional Massage card
  massageCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  massageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  massageLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: "#1E2939",
    letterSpacing: 0.2,
  },
  massageBody: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
    marginBottom: 18,
  },
  massageChildName: {
    fontFamily: FONTS.semiBold,
    color: COLORS.mainPurple,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  recordButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  recordButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#fff',
  },

  // Today's plan
  planSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  planTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: "#1E2939",
    marginBottom: 12,
  },
  planItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  planCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCheckboxDone: {
    backgroundColor: COLORS.mainPurple,
    borderColor: COLORS.mainPurple,
  },
  planIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planEmoji: {
    fontSize: 18,
  },
  planTextWrap: {
    flex: 1,
  },
  planItemText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 20,
  },
  planItemBold: {
    fontFamily: FONTS.bold,
  },
  planItemMuted: {
    fontFamily: FONTS.regular,
    color: '#9CA3AF',
  },
});
