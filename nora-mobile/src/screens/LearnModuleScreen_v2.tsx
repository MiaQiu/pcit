/**
 * LearnModuleScreen_v2
 * Redesigned "Today" for a Learn module (e.g. Screen Time Management): goal
 * header, a daily check-in card (opens the coach chat), today's practice card
 * (cheat sheet from the last session + record in place), and, on Day 1, the
 * "Not ready to record?" card. Server-side day/report state, one report a day, a past day
 * via the `day` route param, in-place recording and survey-backed reports.
 * Bottom bar:
 * Today / My plan / Learn / Profile.
 *
 * First time in the module (no recording or survey yet), Today is simpler:
 * the Day 1 intro and practice card (tags, art, Start recording), no goal pill
 * or check-in card. Everything else — header, My plan,
 * tabs — is shared.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import type { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { TrackedTouchable } from '../components/TrackedTouchable';
import { useToast } from '../components/ToastManager';
import { useAuthService } from '../contexts/AppContext';
import { useUploadProcessing } from '../contexts/UploadProcessingContext';
import { useModuleRecorder } from '../hooks/useModuleRecorder';
import * as userStorage from '../lib/userStorage';
import amplitudeService from '../services/amplitudeService';
import { buildPlanDisplay, useModulePlan } from './LearnModulePlanView';
import { LearnModulePlanOverview } from './LearnModulePlanOverview';
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

// Per-user cache of "has a recording or survey in this module" (see isFirstTime).
const startedKey = (moduleKey: string) => `@learn_module_started_${moduleKey}`;

const H_PAD = 20;
const BG = '#F7F5FC';
const PURPLE_TINT = '#F1EBFB';
const MUTED = '#6B7280';

// ─── Bottom tab bar ──────────────────────────────────────────────────────────

const TABS = LEARN_MODULE_TABS;
type TabKey = LearnModuleTabKey;

const ModuleTabBar: React.FC<{
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
}> = ({ activeTab, onTabPress }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    // Sits 20pt into the home-indicator inset (lower on screen), never under 8pt.
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom - 20, 8) }]}>
      <View style={styles.tabBar}>
        {TABS.map(tab => {
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
  // it as the MainTabs route): no back arrow, and Profile opens the profile.
  homeModuleKey?: LearnModuleKey;
}

export const LearnModuleScreen_v2: React.FC<Props> = ({ homeModuleKey }) => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'LearnModule'>>();
  const { t } = useTranslation();
  const { showToast } = useToast();
  // As home, the route is MainTabs: its params only carry what returnToModule
  // merges in (initialTab, startRecordingAt).
  const isHome = !!homeModuleKey;
  const params: RootStackParamList['LearnModule'] = homeModuleKey
    ? { ...(route.params as Partial<RootStackParamList['LearnModule']> | undefined), moduleKey: homeModuleKey }
    : route.params;
  const { moduleKey, day: dayParam, initialTab = 'today', startRecordingAt } = params;
  const module: LearnModuleConfig = LEARN_MODULES[moduleKey];
  // Day 1 has its own practice card + copy; Day 2+ shows the parent's
  // current protocol. The "Not ready to record?" card uses Day 1's copy on
  // every day.
  const config = module.days[1];
  const base = `learnV2.modules.${moduleKey}.days.1`;
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab === 'plan' ? 'plan' : 'today');
  // Learn / Profile render in place like Today and My plan (no push), where available.
  const hasLearnTab = moduleKey === 'screenTime';
  // navigate() to an already-open LearnModule (e.g. "See my plan" from the
  // module report) updates params instead of remounting.
  useEffect(() => {
    setActiveTab(initialTab === 'plan' ? 'plan' : 'today');
  }, [initialTab]);

  // Latest recording in this module (server-side, so it survives app
  // restarts): 'processing' swaps the record button for an analyzing notice,
  // 'ready' for "Read report". null = nothing in flight / no report.
  const authService = useAuthService();
  const uploadProcessing = useUploadProcessing();
  const [childName, setChildName] = useState('');
  const [childGender, setChildGender] = useState<string | null>(null);
  const [latestSession, setLatestSession] = useState<{ id: string; createdAt: string; status: 'processing' | 'ready'; fromSurvey?: boolean } | null>(null);
  // Next day to complete (analyzed reports + 1), from the server.
  const [serverDay, setServerDay] = useState(1);
  // Day 2+ "Play time recording" card, for parents who reported a learning
  // and thinking difference in onboarding: their latest regular (non-module)
  // play recording, which gets the regular PCIT report.
  const [hasDifferences, setHasDifferences] = useState(false);
  const [playSession, setPlaySession] = useState<{ id: string; createdAt: string; status: 'processing' | 'ready' } | null>(null);
  // Unsubscribed and out of free play recordings: Start goes to Subscription.
  const [playLimitReached, setPlayLimitReached] = useState(false);
  // Analyzed reports in day order (report N = day N) with the plan each produced.
  const [days, setDays] = useState<ModuleDay[]>([]);
  // A specific day to show (route param); null = today.
  const viewDayChoice = dayParam ?? null;

  // One report a day: once today's report (recording or survey) is ready,
  // today stays on that day with "Read report" — no second recording or
  // check-in — and moves on to the next day tomorrow.
  const todayReport = latestSession?.status === 'ready' &&
    new Date(latestSession.createdAt).toDateString() === new Date().toDateString()
    ? latestSession
    : null;
  const realDay = todayReport ? Math.max(1, serverDay - 1) : serverDay;
  const currentDay = viewDayChoice ?? realDay;
  // past: browse that day's protocol + report. today: the live flow.
  // future (testers only): record / check in as if it were that day.
  const dayMode: 'past' | 'today' | 'future' =
    currentDay < realDay ? 'past' : currentDay > realDay ? 'future' : 'today';
  const canAct = dayMode === 'future' || (dayMode === 'today' && !todayReport);
  // The report to open for this day: a past day's, or today's once ready.
  const dayReport = dayMode === 'past'
    ? (days[currentDay - 1] ? { id: days[currentDay - 1].reportId, fromSurvey: days[currentDay - 1].fromSurvey } : null)
    : dayMode === 'today' ? todayReport : null;
  const isFollowupDay = currentDay > 1;
  const { generatedPlan, childName: planChildName, masteredStrategies } = useModulePlan(moduleKey, serverDay);
  // Current goal on the "My plan" roadmap (first not yet complete) — shown in the Today header.
  const currentGoal = getGoalProgress(moduleKey, masteredStrategies.map(m => m.strategyId))
    .find(g => g.status === 'current');
  const planDisplay = generatedPlan === undefined ? undefined : buildPlanDisplay(t, moduleKey, generatedPlan, planChildName);
  // Day N practices the plan from day N-1's report; days without one yet
  // (today before any newer report, future days) use the latest plan.
  const dayPlan = days[currentDay - 2]?.plan ?? null;
  const dayStrategy = dayPlan?.activeStrategy ?? planDisplay?.strategy;
  const dayStrategyId = dayPlan ? dayPlan.activeStrategyId : generatedPlan?.activeStrategyId;

  // First-time parents (no recording or survey in this module yet) get a
  // simpler Today: the Day 1 intro and practice card, no check-in card.
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

  const loadLatestSession = useCallback(() => {
    authService.authenticatedRequest(`${API_URL}/api/learn-modules/${moduleKey}/latest-session`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) {
          setProgressFailed(true);
          return;
        }
        setLatestSession(data.session);
        setServerDay(data.dayNumber ?? 1);
        setHasDifferences(!!data.hasDifferences);
        setPlaySession(data.playSession ?? null);
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
    authService.authenticatedRequest(`${API_URL}/api/learn-modules/${moduleKey}/days`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data?.days) setDays(data.days); })
      .catch(err => console.error('Failed to load module days:', err));
  }, [authService, moduleKey]);

  useFocusEffect(loadLatestSession);
  // A report just finished (push or polling in UploadProcessingContext).
  useEffect(() => {
    if (uploadProcessing.reportCompletedTimestamp) loadLatestSession();
  }, [uploadProcessing.reportCompletedTimestamp, loadLatestSession]);
  const anyProcessing = latestSession?.status === 'processing' || playSession?.status === 'processing';
  useEffect(() => {
    if (!anyProcessing) return;
    const timer = setInterval(loadLatestSession, PROCESSING_POLL_MS);
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
  // A recording's status shows on the practice card; a survey-based report's
  // (parent tapped "Tell Nora" instead of recording) on the alternative card.
  const recordingSession = latestSession && !latestSession.fromSurvey ? latestSession : null;
  const surveySession = latestSession?.fromSurvey ? latestSession : null;

  // Gap between the practice card's text and its first button (see artRow).

  const openReport = (recordingId: string, source: 'recording' | 'survey') => {
    amplitudeService.trackEvent('Learn Module Read Report Tapped', { moduleKey, day: currentDay, recordingId, source });
    navigation.push('ModuleReport', { recordingId, moduleKey });
  };

  // Records in place (no Record tab: its 5-min play / 10-min discipline
  // session framing doesn't fit a screen-time ending).
  const recorder = useModuleRecorder({
    moduleKey,
    onUploaded: loadLatestSession,
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
  const playReportToday = playSession?.status === 'ready' &&
    new Date(playSession.createdAt).toDateString() === new Date().toDateString()
    ? playSession
    : null;
  // On the following-day Today (rendered only there) — incl. Day 1 once
  // today's report is in, which stays Day 1 until tomorrow.
  const showPlayCard = hasDifferences;

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
            canRecord: canAct && !recorder.isRecording && recordingSession?.status !== 'processing',
          });
        } else {
          navigation.push('ModuleGuide', { moduleKey, guide });
        }
        return;
      }
      case 'tellNora':
        navigation.push('LearnModuleSurvey', isFollowupDay && dayStrategy
          ? { moduleKey, variant: 'followup', strategy: dayStrategy, strategyId: dayStrategyId ?? undefined }
          : { moduleKey });
        return;
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
            navigation.push('ModulePlanDetail', { moduleKey });
          }}
          onLockedGoal={goal => {
            amplitudeService.trackEvent('Learn Module Plan Goal Locked Tapped', { moduleKey, goal: goal.key });
            showToast(t('learnV2.moduleScreenV2.planOverview.lockedToast'), 'info');
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

              {/* First time: today's practice with what/where tags and art */}
              <View style={[styles.card, styles.v2Card]}>
                <Text style={styles.eyebrow}>{t('learnV2.moduleScreen.todaysPractice')}</Text>
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

                {/* Any recording/survey ends first time, so only record or recording here */}
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
              <Ionicons name="document-text-outline" size={20} color={COLORS.mainPurple} />
              <Text style={styles.softButtonText}>{t('learnV2.moduleScreenV2.cheatSheet')}</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.mainPurple} />
            </TrackedTouchable>

            {/* Daily check-in with the coach */}
            <View style={[styles.card, styles.v2Card]}>
              <View style={[styles.v2CardRow, artRow(CHECK_IN_ART_SIZE.height, SOFT_BUTTON_GAP)]}>
                {/* Behind the text (rendered first, absolutely positioned); text may overlap it */}
                <Image source={CHECK_IN_ART} style={[styles.v2CardArt, CHECK_IN_ART_SIZE, artBottom(SOFT_BUTTON_GAP)]} resizeMode="contain" />
                <View style={styles.v2CardText}>
                  <Text style={styles.eyebrow}>{t('learnV2.moduleScreenV2.checkInEyebrow')}</Text>
                  <Text style={styles.v2CardTitle}>{t('learnV2.moduleScreenV2.checkInTitle')}</Text>
                  <Text style={styles.v2CardBody}>{t('learnV2.moduleScreenV2.checkInBody')}</Text>
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
                <Text style={styles.softButtonText}>{t('learnV2.moduleScreenV2.openChat')}</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.mainPurple} />
              </TrackedTouchable>
            </View>

            {/* Today's practice */}
            <View style={[styles.card, styles.v2Card]}>
              <View style={[styles.v2CardRow, artRow(PRACTICE_ART_SIZE.height, PRIMARY_BUTTON_GAP)]}>
                {/* Behind the text (rendered first, absolutely positioned); text may overlap it */}
                <Image source={PRACTICE_ART} style={[styles.v2CardArt, PRACTICE_ART_SIZE, artBottom(PRIMARY_BUTTON_GAP)]} resizeMode="contain" />
                <View style={styles.v2CardText}>
                  <Text style={styles.eyebrow}>{t('learnV2.moduleScreen.todaysPractice')}</Text>
                  <Text style={styles.v2CardTitle}>
                    {isFollowupDay ? t('learnV2.moduleScreenV2.practiceNextTitle') : t(`${base}.practiceTitle`)}
                  </Text>
                  <Text style={styles.v2CardBody}>{t('learnV2.moduleScreenV2.practiceBody')}</Text>
                </View>
              </View>

              {recorder.isRecording ? (moduleRecording ? recordingPanel : null) : canAct && recordingSession?.status === 'processing' ? (
                <View style={styles.processingBox}>
                  <ActivityIndicator color={COLORS.mainPurple} />
                  <Text style={styles.processingText}>
                    {t('learnV2.moduleScreen.processingStart')}
                    <Text style={styles.processingChildName}>{childName || t('learnV2.moduleScreen.yourChild')}</Text>
                    {t('learnV2.moduleScreen.processingEnd')}
                  </Text>
                </View>
              ) : !isFollowupDay && dayMode === 'today' && todayReport?.fromSurvey ? (
                <Text style={styles.doneForToday}>{t('learnV2.moduleScreen.doneForToday')}</Text>
              ) : !canAct && dayReport && (isFollowupDay || !dayReport.fromSurvey) ? (
                <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: readReport (day ${currentDay})`}
                  style={styles.primaryButton}
                  onPress={() => openReport(dayReport.id, dayReport.fromSurvey ? 'survey' : 'recording')}
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
                ) : playReportToday ? (
                  <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: readPlayReport`}
                    style={styles.primaryButton}
                    onPress={() => {
                      amplitudeService.trackEvent('Learn Module Read Play Report Tapped', { moduleKey, day: currentDay, recordingId: playReportToday.id });
                      navigation.push('ReportV3', { recordingId: playReportToday.id });
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

          {/* Day 1 only: the survey alternative, or a survey report's Read
              report once done. Hidden after a recording (its report is on the
              practice card). Day 2+ reads either report from the practice card.
              Always on the first-time template (incl. the dev Day 1 preview). */}
          {config.alternative && (isFirstTime || (isFirstTime === false && !isFollowupDay && (canAct || !!dayReport?.fromSurvey))) && (
            <View style={styles.altCard}>
              <View style={styles.altArt} pointerEvents="none">
                <View style={[styles.altTile, styles.altTileBack]}>
                  <Ionicons name="alarm-outline" size={26} color="#F472B6" />
                </View>
                <View style={[styles.altTile, styles.altTileFront]}>
                  <Ionicons name="chatbubble-ellipses" size={26} color={COLORS.mainPurple} />
                </View>
              </View>
              <Text style={styles.eyebrow}>{t(`${base}.alternative.eyebrow`)}</Text>
              <Text style={styles.altTitle}>{t(`${base}.alternative.title`)}</Text>
              {canAct && surveySession?.status === 'processing' ? (
                <View style={styles.altProcessing}>
                  <ActivityIndicator color={COLORS.mainPurple} />
                  <Text style={styles.processingText}>{t('learnV2.moduleScreen.processingSurvey')}</Text>
                </View>
              ) : !canAct && dayReport?.fromSurvey ? (
                <>
                  <Text style={styles.altBody}>{t('learnV2.moduleScreen.surveyReportReady')}</Text>
                  <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: readSurveyReport (day ${currentDay})`}
                    style={styles.altButton}
                    onPress={() => openReport(dayReport.id, 'survey')}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="document-text-outline" size={20} color={COLORS.mainPurple} />
                    <Text style={styles.altButtonText}>{t('learnV2.moduleScreen.readReport')}</Text>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.mainPurple} />
                  </TrackedTouchable>
                </>
              ) : (
                <>
                  <Text style={styles.altBody}>
                    {!isFirstTime && isFollowupDay && dayStrategy
                      ? t('learnV2.moduleScreen.followup.altBody', { strategy: dayStrategy })
                      : t(`${base}.alternative.body`)}
                  </Text>
                  <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: ${config.alternative.action}`}
                    style={styles.altButton}
                    onPress={() => handleAction(config.alternative!.action)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={config.alternative.icon} size={20} color={COLORS.mainPurple} />
                    <View style={styles.altButtonTextWrap}>
                      <Text style={styles.altButtonText}>{t(`${base}.alternative.cta`)}</Text>
                      <Text style={styles.altButtonMeta}>{t(`${base}.alternative.ctaMeta`)}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.mainPurple} />
                  </TrackedTouchable>
                </>
              )}
            </View>
          )}

        </ScrollView>
      )}

      <ModuleTabBar activeTab={activeTab} onTabPress={handleTabPress} />
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
    backgroundColor: '#FFFFFF',
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
  cheatSheetTop: { marginTop: 16 },
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
  doneForToday: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    marginTop: 14,
  },
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

  // ── Alternative card ──
  altCard: {
    backgroundColor: PURPLE_TINT,
    borderRadius: 24,
    padding: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  altArt: { position: 'absolute', top: 16, right: 14, width: 96, height: 72 },
  altTile: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  altTileBack: { left: 0, top: 10, backgroundColor: '#FDE7F0', transform: [{ rotate: '-10deg' }] },
  altTileFront: { right: 0, top: 4, backgroundColor: '#FFFFFF', transform: [{ rotate: '6deg' }] },
  altTitle: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    lineHeight: 24,
    color: COLORS.textDark,
    marginTop: 4,
    marginRight: 100,
  },
  altBody: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
    marginTop: 4,
    marginRight: 100,
  },
  altButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#C9B5EE',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 8,
    marginTop: 14,
  },
  altButtonTextWrap: { alignItems: 'center' },
  altProcessing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 14,
  },
  altButtonText: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.mainPurple },
  altButtonMeta: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.mainPurple },
});
