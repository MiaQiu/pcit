/**
 * LearnModuleScreen
 * Template screen for one day of a Learn module (e.g. Screen Time
 * Management), reached from LearnScreen_v2's Modules section. Layout is
 * shared across modules; images, icons, actions and day count come from
 * LEARN_MODULES and copy from i18n `learnV2.modules.<moduleKey>.days.<day>`.
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
import amplitudeService from '../services/amplitudeService';
import { LearnModulePlanView, ProtocolSteps, buildPlanDisplay, useModulePlan } from './LearnModulePlanView';
import type { ModuleDay } from '../constants/learnModules';
import { LEARN_MODULES, LEARN_MODULE_TABS, LearnModuleAction, LearnModuleConfig, LearnModuleTabKey } from '../constants/learnModules';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
// Testers can step past today into future days (to run the next day's flow
// without waiting) — in development and in any build pointed at the dev
// backend (deploy_dev.sh), never against prod (matches the dev host rather
// than "not prod"). Parents can only browse back to earlier days.
const ALLOW_FUTURE_DAYS = __DEV__ || API_URL.includes('p2tgddmyxt.us-east-1.awsapprunner.com');
// How often to re-check while a module recording is being analyzed.
const PROCESSING_POLL_MS = 15_000;

const H_PAD = 20;
const BG = '#F7F5FC';
const PURPLE_TINT = '#F1EBFB';
const MUTED = '#6B7280';

// ─── Day progress ────────────────────────────────────────────────────────────

const DayProgress: React.FC<{ totalDays: number; currentDay: number }> = ({ totalDays, currentDay }) => (
  <View style={styles.progressRow}>
    {Array.from({ length: totalDays }, (_, i) => {
      const day = i + 1;
      const done = day <= currentDay;
      return (
        <React.Fragment key={day}>
          {i > 0 && <View style={[styles.progressLine, done && styles.progressLineDone]} />}
          <View style={[styles.progressHalo, day === currentDay && styles.progressHaloCurrent]}>
            <View style={[styles.progressDot, done && styles.progressDotDone]}>
              {done && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
          </View>
        </React.Fragment>
      );
    })}
  </View>
);

// ─── Bottom tab bar ──────────────────────────────────────────────────────────

const ModuleTabBar: React.FC<{
  activeTab: LearnModuleTabKey;
  onTabPress: (tab: LearnModuleTabKey) => void;
}> = ({ activeTab, onTabPress }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.tabBar}>
        {LEARN_MODULE_TABS.map(tab => {
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

export const LearnModuleScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'LearnModule'>>();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { moduleKey, day: dayParam, initialTab = 'today' } = route.params;
  const module: LearnModuleConfig = LEARN_MODULES[moduleKey];
  // Day 1 has its own practice card + copy; Day 2+ shows the parent's
  // current protocol. The "Not ready to record?" card uses Day 1's copy on
  // every day.
  const config = module.days[1];
  const base = `learnV2.modules.${moduleKey}.days.1`;
  const [activeTab, setActiveTab] = useState<LearnModuleTabKey>(initialTab);
  // navigate() to an already-open LearnModule (e.g. "See my plan" from the
  // module report) updates params instead of remounting.
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Latest recording in this module (server-side, so it survives app
  // restarts): 'processing' swaps the record button for an analyzing notice,
  // 'ready' for "Read report". null = nothing in flight / no report.
  const authService = useAuthService();
  const uploadProcessing = useUploadProcessing();
  const [childName, setChildName] = useState('');
  const [latestSession, setLatestSession] = useState<{ id: string; createdAt: string; status: 'processing' | 'ready'; fromSurvey?: boolean } | null>(null);
  // Next day to complete (analyzed reports + 1), from the server.
  const [serverDay, setServerDay] = useState(1);
  // Analyzed reports in day order (report N = day N) with the plan each produced.
  const [days, setDays] = useState<ModuleDay[]>([]);
  // Day picked with the header arrows; null = today.
  const [viewDayChoice, setViewDayChoice] = useState<number | null>(dayParam ?? null);

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
  const { generatedPlan, childName: planChildName } = useModulePlan(moduleKey, serverDay);
  const planDisplay = generatedPlan === undefined ? undefined : buildPlanDisplay(t, moduleKey, generatedPlan, planChildName);
  // Day N practices the plan from day N-1's report; days without one yet
  // (today before any newer report, future days) use the latest plan.
  const dayPlan = days[currentDay - 2]?.plan ?? null;
  const dayStrategy = dayPlan?.activeStrategy ?? planDisplay?.strategy;
  const daySteps = dayPlan?.protocolSteps ?? planDisplay?.steps;
  const dayStrategyId = dayPlan ? dayPlan.activeStrategyId : generatedPlan?.activeStrategyId;

  const loadLatestSession = useCallback(() => {
    authService.authenticatedRequest(`${API_URL}/api/learn-modules/${moduleKey}/latest-session`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return;
        setLatestSession(data.session);
        setServerDay(data.dayNumber ?? 1);
      })
      .catch(err => console.error('Failed to load latest module session:', err));
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
  useEffect(() => {
    if (latestSession?.status !== 'processing') return;
    const timer = setInterval(loadLatestSession, PROCESSING_POLL_MS);
    return () => clearInterval(timer);
  }, [latestSession?.status, loadLatestSession]);
  useEffect(() => {
    authService.getCurrentUser()
      .then(user => setChildName(user?.childName ?? ''))
      .catch(() => {});
  }, [authService]);
  // A recording's status shows on the practice card; a survey-based report's
  // (parent tapped "Tell Nora" instead of recording) on the alternative card.
  const recordingSession = latestSession && !latestSession.fromSurvey ? latestSession : null;
  const surveySession = latestSession?.fromSurvey ? latestSession : null;

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
      <Text style={styles.recordingHint}>{t('learnV2.moduleRecorder.hint')}</Text>
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
        navigation.push('ModuleGuide', { moduleKey, guide: 'howToRecord' });
        return;
      case 'whatToRecord':
        navigation.push('ModuleGuide', { moduleKey, guide: 'whyRecord' });
        return;
      case 'tellNora':
        navigation.push('LearnModuleSurvey', isFollowupDay && dayStrategy
          ? { moduleKey, variant: 'followup', strategy: dayStrategy, strategyId: dayStrategyId ?? undefined }
          : { moduleKey });
        return;
      default:
        showToast(t('learnV2.moduleScreen.comingSoon'), 'info');
    }
  };

  const handleTabPress = (tab: LearnModuleTabKey) => {
    if (tab === activeTab) return;
    amplitudeService.trackEvent('Learn Module Tab Tapped', { moduleKey, tab });
    if (tab === 'today' || (tab === 'plan' && module.plan)) setActiveTab(tab);
    else showToast(t('learnV2.moduleScreen.comingSoon'), 'info');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.navRow}>
        <TrackedTouchable analyticsId="Back"
          onPress={() => navigation.goBack()}
          style={styles.backCircle}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
        </TrackedTouchable>
        {activeTab === 'today' && (
          <View style={styles.dayNav}>
            <TrackedTouchable analyticsId="Learn Module: previous day"
              onPress={() => setViewDayChoice(Math.max(1, currentDay - 1))}
              disabled={currentDay <= 1}
              style={[styles.dayArrow, currentDay <= 1 && styles.dayArrowDisabled]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('learnV2.moduleScreen.previousDay')}
            >
              <Ionicons name="chevron-back" size={18} color={MUTED} />
            </TrackedTouchable>
            <Text style={styles.dayLabel}>{t('learnV2.moduleScreen.dayLabel', { day: currentDay })}</Text>
            <TrackedTouchable analyticsId="Learn Module: next day"
              onPress={() => setViewDayChoice(currentDay + 1)}
              disabled={!ALLOW_FUTURE_DAYS && currentDay >= realDay}
              style={[styles.dayArrow, !ALLOW_FUTURE_DAYS && currentDay >= realDay && styles.dayArrowDisabled]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('learnV2.moduleScreen.nextDay')}
            >
              <Ionicons name="chevron-forward" size={18} color={MUTED} />
            </TrackedTouchable>
          </View>
        )}
        <View style={styles.navSpacer} />
      </View>

      {activeTab === 'plan' ? (
        <LearnModulePlanView moduleKey={moduleKey} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {dayMode !== 'today' && (
            <TrackedTouchable analyticsId="Learn Module: back to today"
              style={styles.backToToday}
              onPress={() => setViewDayChoice(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.backToTodayText}>{t('learnV2.moduleScreen.backToToday', { day: realDay })}</Text>
            </TrackedTouchable>
          )}
          {isFollowupDay ? (
            <>
              {/* Day 2+ intro: the strategy being practiced */}
              <Text style={styles.title}>{dayStrategy ?? t('learnV2.moduleScreen.followup.title')}</Text>
              <Text style={styles.subtitle}>{t('learnV2.moduleScreen.followup.subtitle')}</Text>
              <DayProgress totalDays={module.totalDays} currentDay={currentDay} />

              {/* Today's Protocol (from "My plan") + Record */}
              <View style={styles.card}>
                <Text style={styles.eyebrow}>{t('learnV2.moduleScreen.plan.todaysProtocol')}</Text>
                {daySteps === undefined ? (
                  <ActivityIndicator style={styles.protocolLoading} color={COLORS.mainPurple} />
                ) : (
                  <View style={styles.protocolWrap}>
                    <ProtocolSteps moduleKey={moduleKey} steps={daySteps} />
                  </View>
                )}

                {recorder.isRecording ? recordingPanel : canAct && recordingSession?.status === 'processing' ? (
                  <View style={styles.processingBox}>
                    <ActivityIndicator color={COLORS.mainPurple} />
                    <Text style={styles.processingText}>
                      {t('learnV2.moduleScreen.processingStart')}
                      <Text style={styles.processingChildName}>{childName || t('learnV2.moduleScreen.yourChild')}</Text>
                      {t('learnV2.moduleScreen.processingEnd')}
                    </Text>
                  </View>
                ) : dayMode === 'today' && todayReport?.fromSurvey ? (
                  <Text style={styles.doneForToday}>{t('learnV2.moduleScreen.doneForToday')}</Text>
                ) : !canAct && dayReport && !dayReport.fromSurvey ? (
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
                    <Text style={styles.primaryButtonText}>{t('learnV2.moduleScreen.followup.record')}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </TrackedTouchable>
                )}
              </View>
            </>
          ) : (
            <>
            {/* Day intro */}
            <Text style={styles.title}>{t(`${base}.title`)}</Text>
            <Text style={styles.subtitle}>{t(`${base}.subtitle`)}</Text>
            <DayProgress totalDays={module.totalDays} currentDay={currentDay} />

            {/* Today's practice */}
            <View style={styles.card}>
              <View style={styles.practiceHeader}>
                <View style={styles.flex}>
                  <Text style={styles.eyebrow}>{t('learnV2.moduleScreen.todaysPractice')}</Text>
                  <Text style={styles.practiceTitle}>{t(`${base}.practiceTitle`)}</Text>
                </View>
                <View style={styles.practiceIconCircle}>
                  <Ionicons name={config.practiceIcon} size={24} color={COLORS.mainPurple} />
                </View>
              </View>

              <View style={styles.tagRow}>
                {config.tags.map(tag => (
                  <View key={tag.key} style={styles.tag}>
                    <Ionicons name={tag.icon} size={15} color={COLORS.textDark} />
                    <Text style={styles.tagText}>{t(`${base}.tags.${tag.key}`)}</Text>
                  </View>
                ))}
              </View>

              {/* Sized by the wrapper: a static Image's style defaults to the
                  asset's pixel dimensions, which would override aspectRatio. */}
              <View style={[styles.heroWrap, { aspectRatio: config.heroAspectRatio }]}>
                <Image source={config.heroImage} style={styles.hero} resizeMode="cover" />
              </View>

              {recorder.isRecording ? recordingPanel : canAct && recordingSession?.status === 'processing' ? (
                <View style={styles.processingBox}>
                  <ActivityIndicator color={COLORS.mainPurple} />
                  <Text style={styles.processingText}>
                    {t('learnV2.moduleScreen.processingStart')}
                    <Text style={styles.processingChildName}>{childName || t('learnV2.moduleScreen.yourChild')}</Text>
                    {t('learnV2.moduleScreen.processingEnd')}
                  </Text>
                </View>
              ) : dayMode === 'today' && todayReport?.fromSurvey ? (
                <Text style={styles.doneForToday}>{t('learnV2.moduleScreen.doneForToday')}</Text>
              ) : !canAct && dayReport && !dayReport.fromSurvey ? (
                <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: readReport`}
                  style={styles.primaryButton}
                  onPress={() => openReport(dayReport.id, dayReport.fromSurvey ? 'survey' : 'recording')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>{t('learnV2.moduleScreen.readReport')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TrackedTouchable>
              ) : !canAct ? null : (
                <>
                  <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: ${config.primaryAction.action}`}
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
            </View>
            </>
          )}

          {/* Alternative path */}
          {/* Always shown, so a done day reads as "recorded" vs "answered the
              survey": a survey report's Read report lives here; after a
              recording the card stays, dimmed and without an action. */}
          {config.alternative && (
            <View style={[styles.altCard, !canAct && !dayReport?.fromSurvey && styles.altCardInactive]}>
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
              ) : !canAct ? null : (
                <>
                  <Text style={styles.altBody}>
                    {isFollowupDay && dayStrategy
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
  navSpacer: { width: 36 },
  dayLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    letterSpacing: 1.5,
    color: MUTED,
  },

  // ── Intro ──
  title: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 38,
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
    paddingHorizontal: 12,
  },

  // ── Progress ──
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  progressHalo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressHaloCurrent: { backgroundColor: PURPLE_TINT },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#DDD3F3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: { backgroundColor: COLORS.mainPurple, borderColor: COLORS.mainPurple },
  progressLine: { width: 32, height: 2, backgroundColor: '#E5DDF6' },
  progressLineDone: { backgroundColor: COLORS.mainPurple },

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
  practiceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: MUTED,
    textTransform: 'uppercase',
  },
  practiceTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: COLORS.textDark,
    marginTop: 6,
  },
  practiceIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PURPLE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6F4FA',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.textDark },
  heroWrap: { width: '100%', borderRadius: 18, overflow: 'hidden', marginTop: 12 },
  hero: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
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
  protocolWrap: { marginTop: 14, marginBottom: 12 },
  protocolLoading: { marginVertical: 32 },
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayArrow: { padding: 2 },
  dayArrowDisabled: { opacity: 0.3 },
  backToToday: { alignSelf: 'center', paddingVertical: 4, marginBottom: 4 },
  backToTodayText: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.mainPurple },
  doneForToday: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    marginTop: 14,
  },
  primaryNote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    marginTop: 10,
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
  altCardInactive: { opacity: 0.55 },
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
