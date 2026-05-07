/**
 * Home Screen v2
 * Redesigned homepage with arc hero, weekly emotional bank stats, and today's plan
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Animated,
  Modal,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { scheduleDailyLessonReminder } from '../utils/notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Video, ResizeMode } from 'expo-av';
import { ProfileCircle } from '../components/ProfileCircle';
import { COLORS, FONTS } from '../constants/assets';

const DRAGON_ANIMATION = require('../../assets/images/Dragon_anime.mov');
import { RootStackNavigationProp, RootTabNavigationProp } from '../navigation/types';
import { useLessonService, useAuthService, useRecordingService } from '../contexts/AppContext';
import { useCoachUnread } from '../contexts/CoachUnreadContext';
import { useUploadProcessing } from '../contexts/UploadProcessingContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getTodaySingapore, toSingaporeDateString, getStartOfTodaySingapore, getEndOfTodaySingapore } from '../utils/timezone';
import * as userStorage from '../lib/userStorage';
import type { RelationshipToChild } from '@nora/core';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WeeklyStats {
  daysCompleted: number;      // days with activity out of 7
  minutesPlayed: number;      // total minutes across all recordings this week
  timesRecorded: number;      // number of recordings this week
  lessonsCompleted: number;   // lessons completed this week
}

interface TodayPlanItem {
  id: string;
  type: 'lesson' | 'record' | 'weekly-report' | 'setup-reminder';
  label: string;
  title: string;
  duration?: string;
  isCompleted: boolean;
}

// REMINDER_PRESETS moved inside component to use t()

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

// recordMessages moved inside component to use t()

export const HomeScreen_v2: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const tabNavigation = useNavigation<RootTabNavigationProp>();
  const { unreadCount } = useCoachUnread();
  const { width: screenWidth } = useWindowDimensions();
  const lessonService = useLessonService();
  const authService = useAuthService();
  const recordingService = useRecordingService();
  const uploadProcessing = useUploadProcessing();
  const { isOnline } = useNetworkStatus();
  const { t, i18n } = useTranslation();

  const dragonVideoRef = useRef<Video>(null);
  const tipOpacity = useRef(new Animated.Value(0)).current;
  const isFirstFocus = useRef(true);
  const [showTip, setShowTip] = useState(false);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPositionRef = useRef<number>(0);

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
  const [hasAnySession, setHasAnySession] = useState(false);
  const recordMessage = useMemo(() => {
    const idx = Math.floor(Math.random() * 5);
    return {
      start: t(`homeV2.recordMessages.${idx}start` as any),
      end: t(`homeV2.recordMessages.${idx}end` as any),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [latestWeeklyReport, setLatestWeeklyReport] = useState<{ id: string; weekStartDate: string; weekEndDate: string; headline: string | null; markedReadAt: string | null } | null>(null);
  const [isWeeklyReportDismissed, setIsWeeklyReportDismissed] = useState(false);
  const [sessionNotifications, setSessionNotifications] = useState<{ postSession?: string; tomorrow?: string } | null>(null);
  const [chatIntroDismissed, setChatIntroDismissed] = useState(false);

  // ── Reminder presets (inside component to use t()) ──
  const REMINDER_PRESETS = [
    { label: t('homeV2.reminderPresets.beforeSchool'), time: '07:00', display: '7:30 AM' },
    { label: t('homeV2.reminderPresets.afterSchool'), time: '15:30', display: '3:30 PM' },
    { label: t('homeV2.reminderPresets.beforeSleep'), time: '20:00', display: '8:30 PM' },
  ] as const;

  // ── Reminder setup modal ──
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(18, 30, 0, 0); return d;
  });
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

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

      const [dashboardData, lessonsResponse, weeklyReportsData, currentUser] = await Promise.all([
        recordingService.getDashboard(),
        lessonService.getLessons(undefined, i18n.language),
        recordingService.getVisibleWeeklyReports().catch(() => ({ reports: [] })),
        authService.getCurrentUser().catch(() => null),
      ]);

      const resolvedChildName = currentUser?.childName || childName;
      if (currentUser?.childName) setChildName(currentUser.childName);

      const { todayRecordings, thisWeekRecordings, latestWithReport } = dashboardData;
      const { lessons } = lessonsResponse;

      // ── Weekly stats ──
      const today = getTodaySingapore();
      const uniqueDays = new Set(
        thisWeekRecordings
          .filter((r: any) => r.analysisStatus === 'COMPLETED')
          .map((r: any) => toSingaporeDateString(new Date(r.createdAt)))
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
        setSessionNotifications({
          postSession: latestCompleted.coachingCards?.notifications?.postSession,
          tomorrow: latestCompleted.coachingCards?.notifications?.tomorrow ?? latestWithReport?.coachingCards?.notifications?.tomorrow,
        });
      } else {
        setIsReportRead(false);
        setSessionNotifications(latestWithReport?.coachingCards?.notifications ?? null);
      }

      // ── Has any completed session ever ──
      setHasAnySession(!!latestWithReport);

      // ── Latest weekly report ──
      const reports = weeklyReportsData.reports ?? [];
      const latestReport = reports.length > 0 ? reports[0] : null;
      setLatestWeeklyReport(latestReport);
      if (latestReport) {
        const locallyDismissed = await userStorage.getItem(`weekly_report_dismissed_${latestReport.id}`);
        setIsWeeklyReportDismissed(!!latestReport.markedReadAt || !!locallyDismissed);
      } else {
        setIsWeeklyReportDismissed(false);
      }

      // ── Chat intro dismissed ──
      const chatIntroDismissedVal = await userStorage.getItem('chat_intro_dismissed');
      setChatIntroDismissed(!!chatIntroDismissedVal);

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
          label: t('homeV2.planLessonLabel'),
          title: lessonForPlan.title,
          duration: t('homeV2.planLessonDuration'),
          isCompleted: !!todayCompletedLesson,
        });
      }

      // Always show Record Session regardless of lesson completion
      plan.push({
        id: 'record',
        type: 'record',
        label: t('homeV2.planRecordLabel'),
        title: t('homeV2.planRecordTitle', { childName: resolvedChildName }),
        isCompleted: hasCompleted,
      });

      // Show weekly report plan item: completed if read today, hidden if read on a prior day
      if (latestReport) {
        const reportReadDate = await userStorage.getItem(`weekly_report_read_date_${latestReport.id}`);
        const today = getTodaySingapore();
        if (!reportReadDate || reportReadDate === today) {
          plan.push({
            id: latestReport.id,
            type: 'weekly-report',
            label: t('homeV2.planWeeklyReportLabel'),
            title: t('homeV2.planWeeklyReportTitle'),
            isCompleted: reportReadDate === today,
          });
        }
      }

      // ── Setup daily reminder item (shown for first 3 days after account creation) ──
      const reminderDoneDate = await userStorage.getItem('reminder_setup_completed');
      const completedToday = reminderDoneDate === getTodaySingapore();
      if (!reminderDoneDate || completedToday) {
        try {
          const user = await authService.getCurrentUser();
          if (user.createdAt) {
            const created = new Date(user.createdAt);
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            const createdMidnight = new Date(created);
            createdMidnight.setHours(0, 0, 0, 0);
            const daysSinceCreation = Math.floor(
              (todayMidnight.getTime() - createdMidnight.getTime()) / 86400000
            );
            if (daysSinceCreation <= 2) {
              plan.push({
                id: 'setup-reminder',
                type: 'setup-reminder',
                label: t('homeV2.planReminderLabel'),
                title: t('homeV2.planReminderTitle'),
                isCompleted: completedToday,
              });
            }
          }
        } catch {}
      }

      setTodayPlan([...plan.filter(i => !i.isCompleted), ...plan.filter(i => i.isCompleted)]);
    } catch (err) {
      console.log('[HomeScreen_v2] Failed to load data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  useEffect(() => {
    amplitudeService.trackScreenView('Home');
    loadUserProfile();
    loadData('full');
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      loadData('background');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i18n.language])
  );

  // Reload when language changes so lesson titles come back in the right locale
  useEffect(() => {
    loadData('background');
  }, [i18n.language]);

  // Auto-refresh when upload processing completes
  useEffect(() => {
    if (uploadProcessing.reportCompletedTimestamp) {
      loadData('background');
    }
  }, [uploadProcessing.reportCompletedTimestamp]);

  // Show tip for 3 seconds starting 1s after animation begins or loops
  const showTipSequence = useCallback(() => {
    if (tipTimerRef.current) {
      clearTimeout(tipTimerRef.current);
      tipTimerRef.current = null;
    }
    tipOpacity.setValue(0);
    setShowTip(false);

    tipTimerRef.current = setTimeout(() => {
      setShowTip(true);
      Animated.timing(tipOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();

      tipTimerRef.current = setTimeout(() => {
        Animated.timing(tipOpacity, { toValue: 0, duration: 400, useNativeDriver: true })
          .start(() => setShowTip(false));
        tipTimerRef.current = null;
      }, 4000);
    }, 1000);
  }, [tipOpacity]);

  useFocusEffect(
    useCallback(() => {
      loadData('background');
      dragonVideoRef.current?.playAsync();
      lastPositionRef.current = 0;
      showTipSequence();

      return () => {
        if (tipTimerRef.current) {
          clearTimeout(tipTimerRef.current);
          tipTimerRef.current = null;
        }
        tipOpacity.setValue(0);
        setShowTip(false);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showTipSequence, i18n.language])
  );

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleProfilePress = () => navigation.push('Profile');

  const handleRecordPress = () => {
    tabNavigation.navigate('Record', { autoStart: true });
  };

  const handleReadReport = async () => {
    if (!latestRecordingId) return;
    const reportReadKey = `report_read_${getTodaySingapore()}`;
    await userStorage.setItem(reportReadKey, latestRecordingId);
    setIsReportRead(true);
    amplitudeService.trackReportViewed(latestRecordingId, undefined, { source: 'home' });
    navigation.push('Report', { recordingId: latestRecordingId });
  };

  const handleRecordAgain = () => {
    tabNavigation.navigate('Record', { autoStart: true });
  };

  const handleChatIntroChat = async () => {
    await userStorage.setItem('chat_intro_dismissed', 'true');
    setChatIntroDismissed(true);
    navigation.push('CoachChat');
  };

  const handleChatIntroSkip = async () => {
    await userStorage.setItem('chat_intro_dismissed', 'true');
    setChatIntroDismissed(true);
  };

  const handlePlanItemPress = async (item: TodayPlanItem) => {
    if (item.type === 'lesson') {
      amplitudeService.trackLessonStarted(item.id, item.title, { source: 'home_today_plan' });
      navigation.push('LessonViewer', { lessonId: item.id });
    } else if (item.type === 'weekly-report') {
      await userStorage.setItem(`weekly_report_read_date_${item.id}`, getTodaySingapore());
      await userStorage.setItem(`weekly_report_dismissed_${item.id}`, 'true');
      setIsWeeklyReportDismissed(true);
      recordingService.markWeeklyReportRead(item.id).catch(() => {});
      navigation.push('WeeklyReport', { reportId: item.id });
    } else if (item.type === 'setup-reminder') {
      handleSetupReminderPress();
    } else if (item.type === 'record') {
      tabNavigation.navigate('Record');
    }
  };

  const handleSetupReminderPress = () => {
    setSelectedPreset(null);
    setShowCustomPicker(false);
    const d = new Date(); d.setHours(18, 30, 0, 0);
    setReminderTime(d);
    setShowReminderModal(true);
  };

  const handleSelectPreset = (preset: typeof REMINDER_PRESETS[number]) => {
    const [h, m] = preset.time.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    setReminderTime(d);
    setSelectedPreset(preset.time);
    setShowCustomPicker(false);
  };

  const handleSaveReminder = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('homeV2.enableNotificationsTitle'),
        t('homeV2.enableNotificationsMessage'),
        [
          { text: t('homeV2.notNow'), style: 'cancel' },
          { text: t('homeV2.openSettings'), onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const h = reminderTime.getHours();
    const m = reminderTime.getMinutes();
    const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    await scheduleDailyLessonReminder(timeString);
    try {
      const saved = await userStorage.getItem('@notification_preferences');
      const prefs = saved ? JSON.parse(saved) : {};
      await userStorage.setItem('@notification_preferences', JSON.stringify({
        ...prefs,
        dailyLessonReminder: true,
        dailyLessonTime: timeString,
      }));
    } catch {}
    await userStorage.setItem('reminder_setup_completed', getTodaySingapore());
    setShowReminderModal(false);
    setTodayPlan(prev =>
      prev.map(item => item.id === 'setup-reminder' ? { ...item, isCompleted: true } : item)
    );
  };

  const formatReminderTime = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
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
            <Text style={styles.headerTitle}>{t('homeV2.headerTitle')}</Text>
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
            onPlaybackStatusUpdate={(status) => {
              if (!status.isLoaded) return;
              const pos = status.positionMillis ?? 0;
              // Detect loop: position jumped back to near 0 from a later point
              if (lastPositionRef.current > 500 && pos < 200) {
                showTipSequence();
              }
              lastPositionRef.current = pos;
            }}
          />

          {/* Tip bubble — shown 1s after animation plays */}
          {showTip && (
            <Animated.View style={[styles.tipBubble, { opacity: tipOpacity }]}>
              <Text style={styles.tipBubbleText}>
                {weeklyStats.daysCompleted === 7
                  ? t('homeV2.tipPerfect')
                  : weeklyStats.daysCompleted >= 4
                  ? t('homeV2.tipDaysDown', { count: weeklyStats.daysCompleted })
                  : t('homeV2.tipAimFor4')}
              </Text>
              <View style={styles.tipBubbleDot1} />
              <View style={styles.tipBubbleDot2} />
            </Animated.View>
          )}

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
                {t('homeV2.weeklyDeposit', { childName })}
              </Text>
              <Text style={styles.scoreBubbleScore}>{scoreText}</Text>
            </View>
          )}
          </View>

          {/* ── Weekly title ── */}
        {/* <Text style={styles.weeklyTitle}>
          <Text style={styles.weeklyTitleBold}>{childName}'s Weekly Deposit</Text>
        </Text> */}

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatPill
            iconName="flame"
            iconColor={COLORS.mainPurple}
            value={String(weeklyStats.daysCompleted)}
            total="7"
            unit={t('homeV2.statDays')}
            onPress={() => tabNavigation.navigate('Record')}
          />
          <StatPill
            iconName="flash"
            iconColor="#10B981"
            value={String(weeklyStats.minutesPlayed)}
            total="35"
            unit={t('homeV2.statMins')}
            onPress={() => tabNavigation.navigate('Record')}
          />
          <StatPill
            iconName="happy-outline"
            iconColor={COLORS.mainPurple}
            value={String(weeklyStats.timesRecorded)}
            total="7"
            unit={t('homeV2.statTimes')}
            onPress={() => tabNavigation.navigate('Record')}
          />
          <StatPill
            iconName="book-outline"
            iconColor="#10B981"
            value={String(weeklyStats.lessonsCompleted)}
            total="7"
            unit={t('homeV2.statLessons')}
            onPress={() => tabNavigation.navigate('Learn')}
          />
        </View>

        {/* ── Main Action Card — priority: weekly report > record > read report > record again ── */}
        <View style={styles.massageCard}>
          {latestWeeklyReport && !isWeeklyReportDismissed ? (
            <>
              <View style={styles.massageHeader}>
                <Ionicons name="bar-chart-outline" size={14} color={COLORS.mainPurple} />
                <Text style={styles.massageLabel}>{t('homeV2.weeklyReportLabel')}</Text>
              </View>
              <Text style={styles.massageBody}>
                {latestWeeklyReport.headline
                  ? latestWeeklyReport.headline
                  : t('homeV2.weeklyReportFallback', { childName })}
              </Text>
              <TouchableOpacity
                style={styles.recordButton}
                onPress={async () => {
                  await userStorage.setItem(`weekly_report_read_date_${latestWeeklyReport.id}`, getTodaySingapore());
                  await userStorage.setItem(`weekly_report_dismissed_${latestWeeklyReport.id}`, 'true');
                  setIsWeeklyReportDismissed(true);
                  recordingService.markWeeklyReportRead(latestWeeklyReport.id).catch(() => {});
                  navigation.push('WeeklyReport', { reportId: latestWeeklyReport.id });
                }}
                activeOpacity={0.85}
              >
                {/* <Ionicons name="stats-chart-outline" size={20} color="#fff" /> */}
                <Text style={styles.recordButtonText}>{t('homeV2.viewWeeklyReport')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={async () => {
                  await userStorage.setItem(`weekly_report_dismissed_${latestWeeklyReport.id}`, 'true');
                  setIsWeeklyReportDismissed(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.skipButtonText}>{t('homeV2.skipForNow')}</Text>
              </TouchableOpacity>
            </>
          ) : uploadProcessing.isProcessing ? (
            <>
              <View style={styles.massageHeader}>
                <View style={styles.greenDot} />
                <Text style={styles.massageLabel}>{t('homeV2.dailyEmotionalMassageLabel')}</Text>
              </View>
              <Text style={styles.massageBody}>
                {t('homeV2.analyzingSession')}
                <Text style={styles.massageChildName}>{childName}</Text>
                {t('homeV2.analyzingSessionSuffix')}
              </Text>
            </>
          ) : !hasRecordedSession ? (
            <>
              <View style={styles.massageHeader}>
                <View style={styles.greenDot} />
                <Text style={styles.massageLabel}>{t('homeV2.dailyEmotionalMassageLabel')}</Text>
              </View>
              <Text style={styles.massageBody}>
                {sessionNotifications?.tomorrow ?? (
                  <>
                    {t('homeV2.letChildLeadStart')}
                    <Text style={styles.massageChildName}>{childName}</Text>
                    {t('homeV2.letChildLeadMiddle')}
                    <Text style={styles.massageChildName}>{childName}</Text>
                    {t('homeV2.letChildLeadEnd')}
                  </>
                )}
              </Text>
              <TouchableOpacity
                style={[styles.recordButton, !isOnline && styles.recordButtonDisabled]}
                onPress={handleRecordPress}
                activeOpacity={0.85}
                disabled={!isOnline}
              >
                <Ionicons name="mic" size={20} color="#fff" />
                <Text style={styles.recordButtonText}>{t('homeV2.recordNow')}</Text>
              </TouchableOpacity>
            </>
          ) : hasRecordedSession && !isReportRead ? (
            <>
              <View style={styles.massageHeader}>
                <View style={styles.greenDot} />
                <Text style={styles.massageLabel}>{t('homeV2.dailyEmotionalMassageLabel')}</Text>
              </View>
              <Text style={styles.massageBody}>
                {sessionNotifications?.postSession ?? (
                  <>
                    {t('homeV2.reportReadyStart')}
                    <Text style={styles.massageChildName}>{childName}</Text>
                    {t('homeV2.reportReadyEnd')}
                  </>
                )}
              </Text>
              <TouchableOpacity
                style={[styles.recordButton, !isOnline && styles.recordButtonDisabled]}
                onPress={handleReadReport}
                activeOpacity={0.85}
                disabled={!isOnline}
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.recordButtonText}>{t('homeV2.readReport')}</Text>
              </TouchableOpacity>
            </>
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
              <TouchableOpacity
                style={styles.recordButton}
                onPress={handleChatIntroChat}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                <Text style={styles.recordButtonText}>{t('homeV2.chatWithCoach')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipButton} onPress={handleChatIntroSkip} activeOpacity={0.7}>
                <Text style={styles.skipButtonText}>{t('homeV2.skipForNow')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.massageHeader}>
                <View style={styles.greenDot} />
                <Text style={styles.massageLabel}>{t('homeV2.dailyEmotionalMassageLabel')}</Text>
              </View>
              <Text style={styles.massageBody}>
                {recordMessage.start}
                <Text style={styles.massageChildName}>{childName}</Text>
                {recordMessage.end}
              </Text>
              <TouchableOpacity
                style={[styles.recordButton, !isOnline && styles.recordButtonDisabled]}
                onPress={handleRecordAgain}
                activeOpacity={0.85}
                disabled={!isOnline}
              >
                <Ionicons name="mic" size={20} color="#fff" />
                <Text style={styles.recordButtonText}>{t('homeV2.recordAgain')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Today's plan ── */}
        {todayPlan.length > 0 && (
          <View style={styles.planSection}>
            <Text style={styles.planTitle}>{t('homeV2.todaysPlan')}</Text>
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

      {/* Floating chat bubble — only shown after first completed play session */}
      {hasAnySession && <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => navigation.push('CoachChat')}>
        <Ionicons name="chatbox-ellipses" size={26} color="#fff" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
          </View>
        )}
      </TouchableOpacity>}

      {/* ── Daily Reminder Setup Modal ── */}
      <Modal visible={showReminderModal} transparent animationType="slide" onRequestClose={() => setShowReminderModal(false)}>
        <View style={styles.reminderOverlay}>
          <View style={styles.reminderCard}>
            <Text style={styles.reminderTitle}>{t('homeV2.reminderModalTitle')}</Text>
            <Text style={styles.reminderBody}>
              {t('homeV2.reminderModalBody1')}{' '}
              <Text style={styles.reminderHighlight}>{t('homeV2.reminderModalHighlight1')}</Text>
              {' '}{t('homeV2.reminderModalOr')}{' '}
              <Text style={styles.reminderHighlight}>{t('homeV2.reminderModalHighlight2')}</Text>
              {' '}{t('homeV2.reminderModalOr')}{' '}
              <Text style={styles.reminderHighlight}>{t('homeV2.reminderModalHighlight3')}</Text>
              {' '}{t('homeV2.reminderModalBody2')}
            </Text>

            {/* Preset options */}
            <View style={styles.reminderPresets}>
              {REMINDER_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset.time}
                  style={[styles.reminderPresetBtn, selectedPreset === preset.time && styles.reminderPresetBtnActive]}
                  onPress={() => handleSelectPreset(preset)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.reminderPresetLabel, selectedPreset === preset.time && styles.reminderPresetLabelActive]}>
                    {preset.label}
                  </Text>
                  <Text style={[styles.reminderPresetTime, selectedPreset === preset.time && styles.reminderPresetLabelActive]}>
                    {preset.display}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom time row */}
            <TouchableOpacity
              style={[styles.reminderCustomRow, !selectedPreset && styles.reminderCustomRowActive]}
              onPress={() => {
                setSelectedPreset(null);
                if (Platform.OS === 'android') setShowCustomPicker(true);
                else setShowCustomPicker(v => !v);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="time-outline" size={18} color={!selectedPreset ? COLORS.mainPurple : '#6B7280'} />
              <Text style={[styles.reminderCustomLabel, !selectedPreset && styles.reminderCustomLabelActive]}>
                {t('homeV2.reminderCustomTime', { time: formatReminderTime(reminderTime) })}
              </Text>
              <Ionicons name="chevron-down" size={16} color={!selectedPreset ? COLORS.mainPurple : '#9CA3AF'} />
            </TouchableOpacity>

            {/* Time picker — inline on iOS, dialog on Android */}
            {(showCustomPicker || (Platform.OS === 'ios' && !selectedPreset)) && (
              <DateTimePicker
                mode="time"
                value={reminderTime}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  if (Platform.OS === 'android') setShowCustomPicker(false);
                  if (date) setReminderTime(date);
                }}
                style={styles.reminderPicker}
              />
            )}

            <TouchableOpacity style={styles.reminderSaveBtn} onPress={handleSaveReminder} activeOpacity={0.85}>
              <Text style={styles.reminderSaveBtnText}>{t('homeV2.setReminder')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reminderCancelBtn} onPress={() => setShowReminderModal(false)} activeOpacity={0.7}>
              <Text style={styles.reminderCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  skipButton: {
    alignItems: 'center',
    marginTop: 5,
    //paddingVertical: 6,
  },
  skipButtonText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8C49D5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },

  // Tip bubble — thought-bubble style above dragon
  tipBubble: {
    position: 'absolute',
    bottom: -30,
    left: 100,
    backgroundColor: '#ffffff',
    borderRadius: 36,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tipBubbleText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#1E2939',
    lineHeight: 18,
  },
  // Thought-bubble tail dots
  tipBubbleDot1: {
    position: 'absolute',
    top: -11,
    left: 72,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 3,
    elevation: 2,
  },
  tipBubbleDot2: {
    position: 'absolute',
    top: -20,
    left: 78,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },

  // Daily reminder modal
  reminderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  reminderCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
  },
  reminderTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: '#1E2939',
    marginBottom: 12,
  },
  reminderBody: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 20,
  },
  reminderHighlight: {
    fontFamily: FONTS.semiBold,
    color: COLORS.mainPurple,
  },
  reminderPresets: {
    gap: 8,
    marginBottom: 12,
  },
  reminderPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
  },
  reminderPresetBtnActive: {
    borderColor: COLORS.mainPurple,
    backgroundColor: '#F3EEFF',
  },
  reminderPresetLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#374151',
  },
  reminderPresetTime: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
  },
  reminderPresetLabelActive: {
    color: COLORS.mainPurple,
  },
  reminderCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  reminderCustomRowActive: {
    borderColor: COLORS.mainPurple,
    backgroundColor: '#F3EEFF',
  },
  reminderCustomLabel: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#374151',
  },
  reminderCustomLabelActive: {
    color: COLORS.mainPurple,
  },
  reminderPicker: {
    marginBottom: 8,
  },
  reminderSaveBtn: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  reminderSaveBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#fff',
  },
  reminderCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  reminderCancelText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#9CA3AF',
  },
});
