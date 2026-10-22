/**
 * LearnModuleScreen_v2
 * Redesigned "Today" for a Learn module (e.g. Screen Time Management): goal
 * header, a daily check-in card (opens the coach chat) and today's practice
 * card (record in place) — always both, check-in first. Server-side day/report
 * state; "Read report" until the latest report is opened, then a new
 * recording; a past day via the `day` route param.
 * Bottom bar:
 * Today / My plan / Learn / Profile.
 *
 * First time in the module (no recording yet), Today is simpler: the Day 1
 * intro and a fuller practice card (tags, art, help links), no goal pill or
 * cheat sheet. Everything else — header, My plan, tabs — is shared.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import type { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { TrackedTouchable } from '../components/TrackedTouchable';
import { useToast } from '../components/ToastManager';
import { useAuthService, useRecordingService } from '../contexts/AppContext';
import { useUploadProcessing } from '../contexts/UploadProcessingContext';
import { useModuleRecorder } from '../hooks/useModuleRecorder';
import * as userStorage from '../lib/userStorage';
import { getReadReportIds, markModuleReportRead } from '../lib/moduleReportReads';
import amplitudeService from '../services/amplitudeService';
import { useModulePlan } from './LearnModulePlanView';
import { LearnModulePlanOverview } from './LearnModulePlanOverview';
import type { CalendarRecording } from '../components/ReportsCalendar';
import { ModuleLearnScreen } from './ModuleLearnScreen';
import { ProfileScreen } from './ProfileScreen';
import type { LearnModuleKey, ModuleDay } from '../constants/learnModules';
import { LEARN_MODULES, LEARN_MODULE_TABS, LearnModuleAction, LearnModuleConfig, LearnModuleTabKey, getGoalProgress } from '../constants/learnModules';
import { genderContext } from './onboarding/screenTime/screenTimeFlow';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
// How often to re-check while a module recording is being analyzed.
const PROCESSING_POLL_MS = 15_000;

// Card art (transparent PNGs): dragon with a chat bubble (check-in), dragon
// holding a tablet (practice).
const CHECK_IN_ART = require('../../assets/images/modules/dino_chat.png');
const PRACTICE_ART = require('../../assets/images/modules/dino_screen.png');
const PLAY_ART = require('../../assets/images/firstGuide.png');

// Card art sits on the first button below the text: its bottom edge meets the
// button's top edge (the button's marginTop), and it rises ART_RISE above the
// text block's top.
const SOFT_BUTTON_GAP = 12;   // styles.softButton.marginTop
const PRIMARY_BUTTON_GAP = 8; // styles.primaryButton.marginTop
const ART_RISE = 10;
const CHECK_IN_ART_SIZE = { width: 126, height: 126 };
const PRACTICE_ART_SIZE = { width: 150, height: 150 * (1792 / 2400) };
const PLAY_ART_SIZE = { width: 130, height: 130 * (966 / 1024) };
// Row height so the art (height) spans from ART_RISE above the row to `gap` below it.
const artRow = (height: number, gap: number) => ({ minHeight: height - ART_RISE - gap });
const artBottom = (gap: number) => ({ bottom: -gap });

// Per-user cache of "has a recording in this module" (see isFirstTime).
const startedKey = (moduleKey: string) => `@learn_module_started_${moduleKey}`;

const H_PAD = 20;
const BG = '#F7F5FC';
const PURPLE_TINT = '#F1EBFB';
const MUTED = '#6B7280';

// ─── Bottom tab bar ──────────────────────────────────────────────────────────

type TabKey = LearnModuleTabKey;

const ModuleTabBar: React.FC<{
  tabs: readonly (typeof LEARN_MODULE_TABS)[number][];
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
}> = ({ tabs, activeTab, onTabPress }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    // Sits 20pt into the home-indicator inset (lower on screen), never under 8pt.
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom - 20, 8) }]}>
      <View style={styles.tabBar}>
        {tabs.map(tab => {
          const active = tab.key === activeTab;
          const color = active ? COLORS.mainPurple : MUTED;
          return (
            <TrackedTouchable analyticsId={`Learn Module Tab: ${tab.key}`}
              key={tab.key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={active ? tab.activeIcon : tab.icon} size={22} color={color} />
              <Text style={[styles.tabLabel, { color }]}>{t(`learnV2.moduleScreen.tabs.${tab.key}`)}</Text>
            </TrackedTouchable>
          );
        })}
      </View>
    </View>
  );
};

// ─── Screen ──────────────────────────────────────────────────────────────────

interface Props {
  // Set when this module is the parent's home screen (HomeRootScreen renders
  // it as the MainTabs route): no back arrow, no header over Learn / Profile,
  // and the only way to the profile, so the Profile tab shows only here.
  homeModuleKey?: LearnModuleKey;
}

export const LearnModuleScreen_v2: React.FC<Props> = ({ homeModuleKey }) => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'LearnModule'>>();
  const { t } = useTranslation();
  const { showToast } = useToast();
  // As home, the route is MainTabs: its params only carry what returnToModule
  // merges in (initialTab, startRecordingAt, startPlayRecordingAt).
  const isHome = !!homeModuleKey;
  const params: RootStackParamList['LearnModule'] = homeModuleKey
    ? { ...(route.params as Partial<RootStackParamList['LearnModule']> | undefined), moduleKey: homeModuleKey }
    : route.params;
  const { moduleKey, day: dayParam, initialTab = 'today', startRecordingAt, startPlayRecordingAt } = params;
  const module: LearnModuleConfig = LEARN_MODULES[moduleKey];
  // Day 1 has its own practice card + copy; Day 2+ shows the parent's
  // current protocol.
  const config = module.days[1];
  const base = `learnV2.modules.${moduleKey}.days.1`;
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab === 'plan' ? 'plan' : 'today');
  // Learn / Profile render in place like Today and My plan (no push). Profile
  // is home-only (opened from Learn, the regular tabs have it); Learn only
  // where the module has its own lessons.
  const tabs = isHome ? LEARN_MODULE_TABS : LEARN_MODULE_TABS.filter(tab => tab.key !== 'profile');
  const hasLearnTab = moduleKey === 'screenTime';
  // navigate() to an already-open LearnModule (e.g. "See my plan" from the
  // module report) updates params instead of remounting.
  useEffect(() => {
    setActiveTab(initialTab === 'plan' ? 'plan' : 'today');
  }, [initialTab]);

  // Latest recording in this module (server-side, so it survives app
  // restarts): 'processing' swaps the record button for an analyzing notice,
  // 'ready' for "Read report" (until read). null = nothing in flight / no report.
  const authService = useAuthService();
  const recordingService = useRecordingService();
  const uploadProcessing = useUploadProcessing();
  const [childName, setChildName] = useState('');
  const [childGender, setChildGender] = useState<string | null>(null);
  const [latestSession, setLatestSession] = useState<{ id: string; createdAt: string; status: 'processing' | 'ready' } | null>(null);
  // Next day to complete (analyzed reports + 1), from the server.
  const [serverDay, setServerDay] = useState(1);
  // Day 2+ "Play time recording" card, for parents who reported a learning
  // and thinking difference in onboarding: their latest regular (non-module)
  // play recording, which gets the regular PCIT report.
  const [hasDifferences, setHasDifferences] = useState(false);
  // Agreed in the module chat to add special play time.
  const [specialPlayAdded, setSpecialPlayAdded] = useState(false);
  const [playSession, setPlaySession] = useState<{ id: string; createdAt: string; status: 'processing' | 'ready' } | null>(null);
  // Completed play time recordings, for My plan's past reports (special play only).
  const [playRecordings, setPlayRecordings] = useState<CalendarRecording[]>([]);
  // Unsubscribed and out of free play recordings: Start goes to Subscription.
  const [playLimitReached, setPlayLimitReached] = useState(false);
  // Analyzed reports in day order (report N = day N) with the plan each produced.
  const [days, setDays] = useState<ModuleDay[]>([]);
  // A specific day to show (route param); null = today.
  const viewDayChoice = dayParam ?? null;

  // Reports the parent has opened (module and play; ModuleReportScreen marks
  // them from anywhere), so a read report's card goes back to its record
  // button. Re-read on focus: the report may have been opened elsewhere.
  const [readReportIds, setReadReportIds] = useState<string[]>([]);
  const loadReadReports = useCallback(() => {
    getReadReportIds(moduleKey).then(setReadReportIds);
  }, [moduleKey]);
  useFocusEffect(loadReadReports);
  const markReportRead = (recordingId: string) => {
    setReadReportIds(prev => (prev.includes(recordingId) ? prev : [...prev, recordingId]));
    markModuleReportRead(moduleKey, recordingId);
  };

  // Once the latest report is ready, Today stays on its day with "Read
  // report" until the parent opens it — however many days later; then Today
  // moves on to the next day and its record button (another recording the
  // same day is fine).
  const unreadReport = latestSession?.status === 'ready' && !readReportIds.includes(latestSession.id)
    ? latestSession
    : null;
  const realDay = unreadReport ? Math.max(1, serverDay - 1) : serverDay;
  const currentDay = viewDayChoice ?? realDay;
  // past: browse that day's protocol + report. today: the live flow.
  // future (testers only): record / check in as if it were that day.
  const dayMode: 'past' | 'today' | 'future' =
    currentDay < realDay ? 'past' : currentDay > realDay ? 'future' : 'today';
  const canAct = dayMode === 'future' || (dayMode === 'today' && !unreadReport);
  // The report to open for this day: a past day's, or today's unread one.
  const dayReport = dayMode === 'past'
    ? (days[currentDay - 1] ? { id: days[currentDay - 1].reportId } : null)
    : dayMode === 'today' ? unreadReport : null;
  const isFollowupDay = currentDay > 1;
  const { masteredStrategies } = useModulePlan(moduleKey, serverDay);
  // Current goal on the "My plan" roadmap (first not yet complete; the last
  // one once all are) — shown in the Today header.
  const goalProgress = getGoalProgress(moduleKey, masteredStrategies.map(m => m.strategyId));
  const currentGoal = goalProgress.find(g => g.status === 'current') ?? goalProgress[goalProgress.length - 1];

  // First-time parents (no recording in this module yet) get a simpler
  // Today: the Day 1 intro, check-in and a fuller practice card.
  // Decided by the server's latest-session; a per-user cached "started" flag
  // lets returning parents skip the wait on a cold start.
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [progressFailed, setProgressFailed] = useState(false);
  const [cachedStarted, setCachedStarted] = useState<boolean | null>(null);
  useEffect(() => {
    userStorage.getItem(startedKey(moduleKey))
      .then(value => setCachedStarted(value === 'true'))
      .catch(() => setCachedStarted(false));
  }, [moduleKey]);
  // On a failed check with no cache, fall back to the regular Today rather
  // than an endless spinner.
  const hasStarted = progressLoaded ? !!latestSession || serverDay > 1
    : cachedStarted || progressFailed ? true
    : null;
  // __DEV__ only: force the Day 1 or following-day Today (null = real state).
  const [devFirstTime, setDevFirstTime] = useState<boolean | null>(null);
  // null = still finding out (Today shows a spinner).
  const isFirstTime = __DEV__ && devFirstTime !== null ? devFirstTime
    : hasStarted === null ? null : !hasStarted && currentDay === 1;

  // Last seen statuses, to notice a report finishing between polls.
  const lastStatusesRef = useRef<{ module?: string; play?: string }>({});
  const loadDays = useCallback(() => {
    authService.authenticatedRequest(`${API_URL}/api/learn-modules/${moduleKey}/days`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data?.days) setDays(data.days); })
      .catch(err => console.error('Failed to load module days:', err));
  }, [authService, moduleKey]);
  // full: also the past reports (days, play recordings) — not on every
  // processing poll, only when a report has just finished.
  const loadLatestSession = useCallback((full = true) => {
    if (full) loadDays();
    authService.authenticatedRequest(`${API_URL}/api/learn-modules/${moduleKey}/latest-session`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) {
          setProgressFailed(true);
          return;
        }
        const prev = lastStatusesRef.current;
        const moduleFinished = prev.module === 'processing' && data.session?.status === 'ready';
        const playFinished = prev.play === 'processing' && data.playSession?.status === 'ready';
        lastStatusesRef.current = { module: data.session?.status, play: data.playSession?.status };
        if (!full && moduleFinished) loadDays();
        setLatestSession(data.session);
        setServerDay(data.dayNumber ?? 1);
        setHasDifferences(!!data.hasDifferences);
        setSpecialPlayAdded(!!data.specialPlayAdded);
        setPlaySession(data.playSession ?? null);
        if ((full || playFinished) && (data.hasDifferences || data.specialPlayAdded)) {
          recordingService.getRecordings()
            .then(({ recordings }) => setPlayRecordings(
              (recordings ?? []).filter(r => r.mode === 'CDI' && r.analysisStatus === 'COMPLETED')))
            .catch(err => console.error('Failed to load play recordings:', err));
        }
        setPlayLimitReached(!!data.playLimitReached);
        setProgressLoaded(true);
        const started = !!data.session || (data.dayNumber ?? 1) > 1;
        (started
          ? userStorage.setItem(startedKey(moduleKey), 'true')
          : userStorage.removeItem(startedKey(moduleKey))
        ).catch(() => {});
      })
      .catch(err => {
        console.error('Failed to load latest module session:', err);
        setProgressFailed(true);
      });
  }, [authService, recordingService, moduleKey, loadDays]);

  useFocusEffect(useCallback(() => loadLatestSession(), [loadLatestSession]));
  // A report just finished (push or polling in UploadProcessingContext).
  useEffect(() => {
    if (uploadProcessing.reportCompletedTimestamp) loadLatestSession();
  }, [uploadProcessing.reportCompletedTimestamp, loadLatestSession]);
  const anyProcessing = latestSession?.status === 'processing' || playSession?.status === 'processing';
  useEffect(() => {
    if (!anyProcessing) return;
    const timer = setInterval(() => loadLatestSession(false), PROCESSING_POLL_MS);
    return () => clearInterval(timer);
  }, [anyProcessing, loadLatestSession]);
  useEffect(() => {
    authService.getCurrentUser()
      .then(user => {
        setChildName(user?.childName ?? '');
        setChildGender(user?.childGender ?? null);
      })
      .catch(() => {});
  }, [authService]);
  const openReport = (recordingId: string) => {
    amplitudeService.trackEvent('Learn Module Read Report Tapped', { moduleKey, day: currentDay, recordingId });
    markReportRead(recordingId);
    navigation.push('ModuleReport', { recordingId, moduleKey });
  };

  // Records in place (no Record tab: its 5-min play / 10-min discipline
  // session framing doesn't fit a screen-time ending).
  const recorder = useModuleRecorder({
    moduleKey,
    onUploaded: () => loadLatestSession(),
  });

  // Leaving mid-recording would orphan the native recording — confirm first.
  useEffect(() => {
    if (!recorder.isRecording) return;
    return navigation.addListener('beforeRemove', e => {
      e.preventDefault();
      Alert.alert(t('learnV2.moduleRecorder.leaveTitle'), t('learnV2.moduleRecorder.leaveMessage'), [
        { text: t('learnV2.moduleRecorder.keepRecording'), style: 'cancel' },
      ]);
    });
  }, [recorder.isRecording, navigation, t]);

  // The play card and the practice card share one recorder; each shows the
  // recording panel only for its own kind, and no action while the other records.
  const moduleRecording = recorder.isRecording && recorder.kind === 'module';
  const playRecording = recorder.isRecording && recorder.kind === 'play';
  // Same as unreadReport: "Read report" until opened, then "Start play recording".
  const unreadPlayReport = playSession?.status === 'ready' && !readReportIds.includes(playSession.id)
    ? playSession
    : null;
  // On the following-day Today (rendered only there) — incl. Day 1 once
  // today's report is in, which stays Day 1 until tomorrow.
  // For parents who reported a learning and thinking difference, or who
  // agreed to add it in the module chat.
  const showPlayCard = hasDifferences || specialPlayAdded;

  const elapsed = Math.floor(recorder.durationMillis / 1000);
  const recordingPanel = (
    <View style={styles.recordingPanel}>
      <View style={styles.recordingRow}>
        <View style={styles.recordingDot} />
        <Text style={styles.recordingLabel}>
          {recorder.state === 'stopping' ? t('learnV2.moduleRecorder.saving') : t('learnV2.moduleRecorder.recording')}
        </Text>
        <Text style={styles.recordingTime}>{`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`}</Text>
      </View>
      <Text style={styles.recordingHint}>
        {playRecording
          ? t('learnV2.moduleScreenV2.playTime.hint', { name: childName || t('learnV2.moduleScreen.yourChild') })
          : t('learnV2.moduleRecorder.hint')}
      </Text>
      {recorder.state === 'stopping' ? (
        <ActivityIndicator style={styles.recordingSaving} color={COLORS.mainPurple} />
      ) : (
        <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: stopRecording`}
          style={styles.stopButton}
          onPress={recorder.stop}
          activeOpacity={0.85}
        >
          <Ionicons name="stop" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{t('learnV2.moduleRecorder.stop')}</Text>
        </TrackedTouchable>
      )}
    </View>
  );

  const handleAction = (action: LearnModuleAction) => {
    amplitudeService.trackEvent('Learn Module Action Tapped', { moduleKey, day: currentDay, action });
    switch (action) {
      case 'record':
        recorder.start();
        return;
      case 'howToRecord':
      case 'whatToRecord': {
        const guide = action === 'howToRecord' ? 'howToRecord' : 'whyRecord';
        if (moduleKey === 'screenTime') {
          navigation.push('ModuleRecordGuide', {
            moduleKey,
            guide,
            canRecord: canAct && !recorder.isRecording && latestSession?.status !== 'processing',
          });
        } else {
          navigation.push('ModuleGuide', { moduleKey, guide });
        }
        return;
      }
      default:
        showToast(t('learnV2.moduleScreen.comingSoon'), 'info');
    }
  };

  // "Start recording" on the record guide brings the parent back here with
  // startRecordingAt set: start once per tap, then clear it.
  useEffect(() => {
    if (!startRecordingAt) return;
    navigation.setParams({ startRecordingAt: undefined });
    if (recorder.isRecording) return;
    amplitudeService.trackEvent('Learn Module Action Tapped', { moduleKey, day: currentDay, action: 'record', source: 'recordGuide' });
    recorder.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRecordingAt]);

  // "Start 5-Min Special Playtime" (ModuleSpecialPlay) brings the parent back
  // here with startPlayRecordingAt set: add special play (so the play card
  // shows from now on, as when accepted in the module chat) and start a play
  // recording on Today, once per tap — after the server state has loaded
  // (first time or not, play limit). The play card isn't on the first-time
  // Today, so there it only adds special play.
  const [pendingPlayStart, setPendingPlayStart] = useState(false);
  useEffect(() => {
    if (!startPlayRecordingAt) return;
    navigation.setParams({ startPlayRecordingAt: undefined });
    setActiveTab('today');
    setPendingPlayStart(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPlayRecordingAt]);
  useEffect(() => {
    if (!pendingPlayStart || !progressLoaded) return;
    setPendingPlayStart(false);
    if (!specialPlayAdded) {
      setSpecialPlayAdded(true);
      authService.authenticatedRequest(`${API_URL}/api/learn-modules/${moduleKey}/special-play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: 'accepted' }),
      }).catch(() => {});
    }
    if (recorder.isRecording || isFirstTime !== false) return;
    amplitudeService.trackEvent('Learn Module Action Tapped', { moduleKey, day: currentDay, action: 'recordPlay', source: 'specialPlay', limitReached: playLimitReached });
    if (playLimitReached) {
      navigation.navigate('Onboarding', { initialStep: 'Subscription' });
      return;
    }
    recorder.start('play');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlayStart, progressLoaded]);

  // Daily check-in with the coach: first card on every Today. First time, it's
  // a "start here" invitation instead (the user doesn't know what to say yet).
  const checkInKey = isFirstTime ? 'learnV2.moduleScreenV2.checkInFirstTime' : 'learnV2.moduleScreenV2.checkIn';
  const checkInCard = (
    <View style={[styles.card, styles.v2Card]}>
      <View style={[styles.v2CardRow, artRow(CHECK_IN_ART_SIZE.height, SOFT_BUTTON_GAP)]}>
        {/* Behind the text (rendered first, absolutely positioned); text may overlap it */}
        <Image source={CHECK_IN_ART} style={[styles.v2CardArt, CHECK_IN_ART_SIZE, artBottom(SOFT_BUTTON_GAP)]} resizeMode="contain" />
        <View style={styles.v2CardText}>
          <Text style={styles.eyebrow}>{t(`${checkInKey}.eyebrow`)}</Text>
          <Text style={styles.v2CardTitle}>{t(`${checkInKey}.title`)}</Text>
          <Text style={[styles.v2CardBody, isFirstTime && styles.checkInFirstTimeBody]}>{t(`${checkInKey}.body`)}</Text>
        </View>
      </View>
      <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: openCoachChat`}
        style={styles.softButton}
        onPress={() => {
          amplitudeService.trackEvent('Learn Module Coach Chat Tapped', { moduleKey, day: currentDay });
          navigation.push('ModuleChat', { moduleKey });
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.mainPurple} />
        <Text style={styles.softButtonText}>{t(`${checkInKey}.button`)}</Text>
        <Ionicons name="arrow-forward" size={18} color={COLORS.mainPurple} />
      </TrackedTouchable>
    </View>
  );

  // "How to record" / "What to record" links, on the first-time practice card only.
  const helpLinks = (
    <View style={styles.helpRow}>
      {config.helpLinks.map(link => (
        <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: ${link.action}`}
          key={link.key}
          style={styles.helpLink}
          onPress={() => handleAction(link.action)}
          activeOpacity={0.75}
        >
          <View style={styles.helpIconCircle}>
            <Ionicons name={link.icon} size={14} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.helpTitle}>{t(`${base}.helpLinks.${link.key}.title`)}</Text>
            <Text style={styles.helpSubtitle}>{t(`${base}.helpLinks.${link.key}.subtitle`)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={COLORS.mainPurple} />
        </TrackedTouchable>
      ))}
    </View>
  );

  const handleTabPress = (tab: TabKey) => {
    if (tab === activeTab) return;
    amplitudeService.trackEvent('Learn Module Tab Tapped', { moduleKey, tab });
    if (tab === 'today' || (tab === 'plan' && module.plan) || (tab === 'learn' && hasLearnTab) || (tab === 'profile' && isHome)) {
      setActiveTab(tab);
    } else if (tab === 'learn') navigation.navigate('MainTabs', { screen: 'Learn' });
    else showToast(t('learnV2.moduleScreen.comingSoon'), 'info');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Learn / Profile have their own header; as home there's nothing else to show here */}
      {!(isHome && (activeTab === 'learn' || activeTab === 'profile')) && (
        <View style={styles.navRow}>
          {/* No way back from home; the spacer keeps the goal pill centered */}
          {isHome ? <View style={styles.navSpacer} /> : (
            <TrackedTouchable analyticsId="Back"
              onPress={() => navigation.goBack()}
              style={styles.backCircle}
              activeOpacity={0.7}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
            </TrackedTouchable>
          )}
          {/* Goal in the header (Today tab) */}
          {activeTab === 'today' && isFirstTime === false && (
            <View style={styles.goalPill}>
              <Ionicons name="locate" size={16} color={COLORS.mainPurple} />
              <Text style={styles.goalPillText}>{t('learnV2.moduleScreenV2.goalLabel', { number: currentGoal?.number ?? 1 })}</Text>
            </View>
          )}
          <View style={styles.navSpacer} />
        </View>
      )}

      {activeTab === 'learn' ? (
        <ModuleLearnScreen embedded />
      ) : activeTab === 'profile' ? (
        <ProfileScreen embedded />
      ) : activeTab === 'plan' ? (
        <LearnModulePlanOverview
          moduleKey={moduleKey}
          onOpenPlan={goal => {
            amplitudeService.trackEvent('Learn Module Plan Goal Opened', { moduleKey, goal: goal.key, status: goal.status });
            if (goal.opens === 'routine') navigation.push('ModuleRoutine', { moduleKey });
            else if (goal.opens === 'specialPlay') navigation.push('ModuleSpecialPlay', { moduleKey });
            else navigation.push('ModulePlanDetail', { moduleKey });
          }}
          onLockedGoal={goal => {
            amplitudeService.trackEvent('Learn Module Plan Goal Locked Tapped', { moduleKey, goal: goal.key });
            showToast(t('learnV2.moduleScreenV2.planOverview.lockedToast'), 'info');
          }}
          days={days}
          playRecordings={showPlayCard ? playRecordings : []}
          onOpenPlayReport={recordingId => {
            amplitudeService.trackEvent('Learn Module Plan Past Play Report Tapped', { moduleKey, recordingId });
            markReportRead(recordingId);
            navigation.push('ReportV3', { recordingId });
          }}
          onOpenReport={day => {
            amplitudeService.trackEvent('Learn Module Plan Past Report Tapped', { moduleKey, day: day.dayNumber, recordingId: day.reportId });
            navigation.push('ModuleReport', { recordingId: day.reportId, moduleKey });
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {__DEV__ && (
            <View style={styles.devBar}>
              <Text style={styles.devBarLabel}>PREVIEW (dev only)</Text>
              <View style={styles.devChipRow}>
                {([[null, 'Real'], [true, 'Day 1'], [false, 'Following day']] as const).map(([value, label]) => (
                  <TrackedTouchable key={label} analyticsId={`Dev Today Preview: ${label}`}
                    onPress={() => setDevFirstTime(value)}
                    style={[styles.devChip, devFirstTime === value && styles.devChipActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.devChipText, devFirstTime === value && styles.devChipTextActive]}>{label}</Text>
                  </TrackedTouchable>
                ))}
              </View>
            </View>
          )}
          {isFirstTime === null ? (
            <ActivityIndicator style={styles.firstTimeLoading} color={COLORS.mainPurple} />
          ) : isFirstTime ? (
            <>
              {/* First time: Day 1 intro (the original big, bold header) */}
              <Text style={styles.firstTimeTitle}>{t(`${base}.title`)}</Text>
              <Text style={styles.firstTimeSubtitle}>{t(`${base}.subtitle`)}</Text>

              {checkInCard}

              {/* First time: today's practice with what/where tags and art */}
              <View style={[styles.card, styles.v2Card]}>
                <Text style={styles.practiceTitle}>{t(`${base}.practiceTitle`)}</Text>

                <View style={styles.tagRow}>
                  {config.tags.map(tag => (
                    <View key={tag.key} style={styles.tag}>
                      <Ionicons name={tag.icon} size={14} color={COLORS.textDark} />
                      <Text style={styles.tagText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {t(`${base}.tags.${tag.key}`)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Sized by the wrapper: a static Image's style defaults to the
                    asset's pixel dimensions, which would override aspectRatio. */}
                <View style={[styles.heroWrap, { aspectRatio: config.heroAspectRatio }]}>
                  <Image source={config.heroImage} style={styles.hero} resizeMode="cover" />
                </View>

                {/* Any recording ends first time, so only record or recording here */}
                {recorder.isRecording ? (moduleRecording ? recordingPanel : null) : (
                  <>
                    <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: ${config.primaryAction.action} (first time)`}
                      style={styles.primaryButton}
                      onPress={() => handleAction(config.primaryAction.action)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={config.primaryAction.icon} size={20} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>{t(`${base}.primaryCta`)}</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </TrackedTouchable>
                    <Text style={styles.primaryNote}>{t(`${base}.primaryNote`)}</Text>
                  </>
                )}

                {helpLinks}
              </View>
            </>
          ) : (
            <>
            {/* Goal */}
            <Text style={styles.title}>
              {currentGoal ? t(`learnV2.modules.${moduleKey}.goals.${currentGoal.key}.title`) : t(`learnV2.modules.${moduleKey}.goal.title`)}
            </Text>
            <Text style={styles.subtitle}>{t(`learnV2.modules.${moduleKey}.goal.subtitle`)}</Text>

            {/* The plan the last report produced, always first under the goal */}
            <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: cheatSheet`}
              style={[styles.softButton, styles.cheatSheetTop]}
              onPress={() => {
                amplitudeService.trackEvent('Learn Module Cheat Sheet Tapped', { moduleKey, day: currentDay });
                navigation.push('ModuleCheatSheet', { moduleKey });
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.softButtonText, styles.cheatSheetTopText]}>{t('learnV2.moduleScreenV2.cheatSheet')}</Text>
            </TrackedTouchable>

            {checkInCard}

            {/* Today's practice */}
            <View style={[styles.card, styles.v2Card]}>
              <View style={[styles.v2CardRow, artRow(PRACTICE_ART_SIZE.height, PRIMARY_BUTTON_GAP)]}>
                {/* Behind the text (rendered first, absolutely positioned); text may overlap it */}
                <Image source={PRACTICE_ART} style={[styles.v2CardArt, PRACTICE_ART_SIZE, artBottom(PRIMARY_BUTTON_GAP)]} resizeMode="contain" />
                <View style={styles.v2CardText}>
                  <Text style={styles.v2CardTitle}>
                    {isFollowupDay ? t('learnV2.moduleScreenV2.practiceNextTitle') : t(`${base}.practiceTitle`)}
                  </Text>
                  <Text style={[styles.v2CardBody, styles.practiceBody]}>{t('learnV2.moduleScreenV2.practiceBody', { name: childName || t('learnV2.moduleScreen.yourChild') })}</Text>
                </View>
              </View>

              {recorder.isRecording ? (moduleRecording ? recordingPanel : null) : canAct && latestSession?.status === 'processing' ? (
                <View style={styles.processingBox}>
                  <ActivityIndicator color={COLORS.mainPurple} />
                  <Text style={styles.processingText}>
                    {t('learnV2.moduleScreen.processingStart')}
                    <Text style={styles.processingChildName}>{childName || t('learnV2.moduleScreen.yourChild')}</Text>
                    {t('learnV2.moduleScreen.processingEnd')}
                  </Text>
                </View>
              ) : !canAct && dayReport ? (
                <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: readReport (day ${currentDay})`}
                  style={styles.primaryButton}
                  onPress={() => openReport(dayReport.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>{t('learnV2.moduleScreen.readReport')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TrackedTouchable>
              ) : !canAct ? null : (
                <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: record (day ${currentDay})`}
                  style={styles.primaryButton}
                  onPress={() => handleAction('record')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="mic-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>{t(`${base}.primaryCta`)}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TrackedTouchable>
              )}
            </View>

            {/* Play time recording: a regular 5-minute play session, recorded
                in place. Shown on every following-day Today; its state is
                today's, not the browsed day's. */}
            {showPlayCard && (
              <View style={[styles.card, styles.v2Card]}>
                <View style={[styles.v2CardRow, artRow(PLAY_ART_SIZE.height, PRIMARY_BUTTON_GAP)]}>
                  {/* Behind the text (rendered first, absolutely positioned); text may overlap it */}
                  <Image source={PLAY_ART} style={[styles.v2CardArt, PLAY_ART_SIZE, artBottom(PRIMARY_BUTTON_GAP)]} resizeMode="contain" />
                  <View style={styles.v2CardText}>
                    <Text style={styles.eyebrow}>{t('learnV2.moduleScreenV2.playTime.eyebrow')}</Text>
                    <Text style={styles.v2CardTitle}>{t('learnV2.moduleScreenV2.playTime.title')}</Text>
                    <Text style={[styles.v2CardBody, styles.playBody]}>
                      {t('learnV2.moduleScreenV2.playTime.body', { name: childName || t('learnV2.moduleScreen.yourChild'), context: genderContext(childGender) })}
                    </Text>
                  </View>
                </View>
                {recorder.isRecording ? (playRecording ? recordingPanel : null) : playSession?.status === 'processing' ? (
                  <View style={styles.processingBox}>
                    <ActivityIndicator color={COLORS.mainPurple} />
                    <Text style={styles.processingText}>{t('learnV2.moduleScreenV2.playTime.processing')}</Text>
                  </View>
                ) : unreadPlayReport ? (
                  <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: readPlayReport`}
                    style={styles.primaryButton}
                    onPress={() => {
                      amplitudeService.trackEvent('Learn Module Read Play Report Tapped', { moduleKey, day: currentDay, recordingId: unreadPlayReport.id });
                      markReportRead(unreadPlayReport.id);
                      navigation.push('ReportV3', { recordingId: unreadPlayReport.id });
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>{t('learnV2.moduleScreen.readReport')}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </TrackedTouchable>
                ) : (
                  <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: recordPlay`}
                    style={styles.primaryButton}
                    onPress={() => {
                      amplitudeService.trackEvent('Learn Module Action Tapped', { moduleKey, day: currentDay, action: 'recordPlay', limitReached: playLimitReached });
                      if (playLimitReached) {
                        navigation.navigate('Onboarding', { initialStep: 'Subscription' });
                        return;
                      }
                      recorder.start('play');
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="mic-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>{t('learnV2.moduleScreenV2.playTime.cta')}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </TrackedTouchable>
                )}
              </View>
            )}
            </>
          )}

        </ScrollView>
      )}

      <ModuleTabBar tabs={tabs} activeTab={activeTab} onTabPress={handleTabPress} />
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: { paddingHorizontal: H_PAD, paddingBottom: 24 },

  // ── Dev preview bar (__DEV__ only) ──
  devBar: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  devBarLabel: { fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 0.5, color: '#9CA3AF', marginBottom: 8 },
  devChipRow: { flexDirection: 'row', gap: 8 },
  devChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#F3F4F6' },
  devChipActive: { backgroundColor: COLORS.mainPurple },
  devChipText: { fontFamily: FONTS.semiBold, fontSize: 12, color: '#4B5563' },
  devChipTextActive: { color: '#FFFFFF' },

  // ── Tab bar ──
  tabBarWrap: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: BG },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 6,
    shadowColor: '#5B3A9E',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: 26,
  },
  tabItemActive: { backgroundColor: PURPLE_TINT },
  tabLabel: { fontFamily: FONTS.semiBold, fontSize: 12 },

  // ── Nav ──
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    // Bordered: plain white barely shows on BG.
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4D9F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSpacer: { width: 36, height: 36 },

  // ── Intro ──
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: COLORS.textDark,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
    marginTop: 8,
    // Narrower than the goal title above it.
    maxWidth: 260,
    alignSelf: 'center',
  },

  // ── v2 header + cards ──
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PURPLE_TINT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  goalPillText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: COLORS.mainPurple,
    textTransform: 'uppercase',
  },
  v2Card: { marginTop: 16 },
  // Longer than the other cards' bodies: keep it clear of the art (right: -10).
  playBody: { width: undefined, marginRight: PLAY_ART_SIZE.width - 10 },
  practiceBody: { width: undefined, marginRight: PRACTICE_ART_SIZE.width - 10 },
  checkInFirstTimeBody: { width: undefined, marginRight: CHECK_IN_ART_SIZE.width - 10 },
  firstTimeLoading: { marginTop: 48 },
  firstTimeTitle: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: COLORS.textDark,
    textAlign: 'center',
    marginTop: 8,
  },
  firstTimeSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  // First-time practice card
  practiceTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: COLORS.textDark,
    marginTop: 6,
  },
  // One row: chips shrink (text scales down) rather than wrap on narrow screens.
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 4,
    backgroundColor: '#F6F4FA',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  tagText: { flexShrink: 1, fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.textDark },
  heroWrap: { width: '100%', borderRadius: 18, overflow: 'hidden', marginTop: 12 },
  hero: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  primaryNote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    marginTop: 10,
  },
  v2CardRow: { position: 'relative', justifyContent: 'center' },
  v2CardText: { zIndex: 1 },
  v2CardArt: { position: 'absolute', right: -10 },
  v2CardTitle: {
    width: 200,
    fontFamily: FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: COLORS.textDark,
    marginTop: 6,
  },
  v2CardBody: { width: 250, fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: MUTED, marginTop: 6 },
  softButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PURPLE_TINT,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 12,
  },
  // On the page background (not a card): tinted with a purple outline so it stands out
  // without competing with the filled primary CTA below.
  cheatSheetTop: {
    marginTop: 16,
    paddingVertical: 16,
    backgroundColor: PURPLE_TINT,
    borderWidth: 1.5,
    borderColor: COLORS.mainPurple,
    shadowColor: '#5B3A9E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  cheatSheetTopText: { fontFamily: FONTS.bold, fontSize: 16 },
  softButtonText: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.mainPurple },

  // ── Practice card ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#5B3A9E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  eyebrow: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: MUTED,
    textTransform: 'uppercase',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 999,
    paddingVertical: 15,
    marginTop: 8,
  },
  primaryButtonText: { fontFamily: FONTS.bold, fontSize: 16, color: '#FFFFFF' },
  recordingPanel: {
    backgroundColor: '#FDF2F2',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5484D' },
  recordingLabel: { flex: 1, fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textDark },
  recordingTime: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.textDark, fontVariant: ['tabular-nums'] },
  recordingHint: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, color: MUTED, marginTop: 6 },
  recordingSaving: { marginTop: 14 },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E5484D',
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 12,
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PURPLE_TINT,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  processingText: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: COLORS.textDark },
  processingChildName: { fontFamily: FONTS.bold, color: COLORS.mainPurple },
  helpRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  helpLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6F4FA',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  helpIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.mainPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.mainPurple },
  helpSubtitle: { fontFamily: FONTS.regular, fontSize: 11, color: MUTED, marginTop: 1 },
});
