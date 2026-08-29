/**
 * ReportDetailScreen
 * Redesigned full session report ("Today's Coaching") — same underlying
 * RecordingAnalysis data as ReportScreen.tsx, restyled to the "Warm
 * Elevation" visual direction (cream page background, shadowed cards,
 * warm terracotta accents) via the shared ReportCard component. Reached
 * from ReportScreen_v2's "Continue to Coaching" button.
 *
 * Every card except the hero and "Unlock My Child's Plan" (both bespoke —
 * neither fits the title/subtitle/content/tip shape) is a <ReportCard>.
 * The hero text, topMomentCelebration, the interaction-style tip banner,
 * and the Crisis Moment card (hidden when no distress moment was detected)
 * all come from pcitAnalysisService's single consolidated
 * "report-highlights" call (generateReportHighlights), which reads the
 * coaching narrative + the already-identified top-moment quote rather than
 * the raw transcript. The hero/celebration/tip fields fall back to generic
 * static copy only for sessions analyzed before this call existed.
 * Everything else — Top Moment + audio, Today's Interaction values,
 * aboutChild + its tags (hidden when absent), and the transcript link — is
 * likewise real.
 *
 * The Tomorrow's Goal card prefers the deterministic level-based goal engine
 * (server/utils/levelGoalEngine.cjs, via tomorrowGoalDirective /
 * pdiTomorrowGoalDirective). For sessions where that structured directive is
 * absent — or where the plain tomorrowGoal/pdiTomorrowGoal string predates
 * the level engine and can't be trusted — deriveGoalFromLevel() below
 * reconstructs an equivalent goal client-side from the parent's current
 * level + this session's raw tag counts, mirroring
 * parentSkillLevelService.cjs's level-up thresholds. Same pattern as
 * ReportScreen_v2.tsx.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { SkillProgressBar } from '../components/SkillProgressBar';
import { ReportCard, REPORT_CARD_COLORS } from '../components/ReportCard';
import { COLORS, FONTS, REPORT_DETAIL_DRAGON } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService, useAuthService, useLessonService } from '../contexts/AppContext';
import { CONTENT_V2_MODULES } from '../constants/contentV2Modules';
import type { RecordingAnalysis, User, DevelopmentalProgress, DomainType, DomainMilestone, DomainProfiling, ParentSkillLevel, DemoVideo } from '@nora/core';
import { MomentPlayer } from '../components/MomentPlayer';
import { RadarChart } from '../components/RadarChart';
import { DomainMilestoneModal } from '../components/DomainMilestoneModal';
import { MarkdownText } from '../utils/MarkdownText';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';
import { deriveGoalFromLevel as deriveGoalNumbersFromLevel } from '../utils/goalFallback';

type ReportDetailRouteProp = RouteProp<RootStackParamList, 'ReportDetail'>;

// Same API-label → i18n-key mapping used by ReportScreen.tsx / ReportScreen_v2.tsx.
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

const SKILL_TAG_MAP: Record<string, string> = {
  'Praise (Labeled)': 'Labeled Praise',
  'Echo': 'Echo',
  'Narrate': 'Narration',
  'Questions': 'Question',
  'Commands': 'Command',
  'Criticism': 'Criticism',
};

// Same shape as ReportScreen.tsx's getUtterancesForSkill — lets tapping a
// PEN skill or an avoid item open SkillUtterances with the matching lines.
const getUtterancesForSkill = (
  transcript: any[] | undefined,
  skillLabel: string,
): Array<{
  preceding?: { role?: string; text: string };
  main: { role?: string; text: string; tag?: string; feedback?: string };
}> => {
  if (!transcript?.length) return [];
  const tag = (SKILL_TAG_MAP[skillLabel] || skillLabel).toLowerCase();
  const results: Array<{
    preceding?: { role?: string; text: string };
    main: { role?: string; text: string; tag?: string; feedback?: string };
  }> = [];
  transcript.forEach((u, index) => {
    if (u.tag && u.tag.toLowerCase() === tag) {
      const prev = index > 0 ? transcript[index - 1] : null;
      results.push({
        preceding: prev && prev.speaker !== '__SILENT__'
          ? { role: prev.role, text: prev.text }
          : undefined,
        main: { role: u.role, text: u.text, tag: u.tag, feedback: u.feedback },
      });
    }
  });
  return results;
};

// Strip trailing PCIT coding tags (e.g. "Great job! LP" -> "Great job!").
const stripPcitTags = (text: string): string => {
  if (!text) return text;
  return text
    .split('\n')
    .map(line => line.replace(/\s+(LP|IC|DC|RF|BD|NT|QU|CM|CR|UP|NE|EC|PR|NA)$/gi, ''))
    .join('\n')
    .trim();
};

// Child's age in whole years — same logic as ProfileReportScreen's
// calculateAge. Used to personalise the first-session "why this matters".
const calculateChildAge = (birthday?: Date | string | null, birthYear?: number | null): number | null => {
  if (birthday) {
    const dob = new Date(birthday);
    if (!Number.isNaN(dob.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const monthDiff = now.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
      return Math.max(age, 0);
    }
  }
  if (birthYear) return Math.max(new Date().getFullYear() - birthYear, 0);
  return null;
};

// Warm-palette equivalents of ReportScreen.tsx's getSkillRating — purple for
// good/excellent, terracotta (instead of a clinical red) for pay-attention.
const getSkillRating = (progress: number, t: Function, maxValue: number = 10): { barColor: string; textColor: string; suffix: string } => {
  if (progress <= maxValue * 0.5) {
    return { barColor: '#C2694B', textColor: '#C2694B', suffix: t('report.skillRating.payAttention') };
  } else if (progress <= maxValue * 0.8) {
    return { barColor: '#8C49D5', textColor: '#8C49D5', suffix: t('report.skillRating.good') };
  } else {
    return { barColor: '#8C49D5', textColor: '#8C49D5', suffix: t('report.skillRating.excellent') };
  }
};

type DerivedGoal = { focusSkill: string; currentNumber: number | null; targetNumber: number | string | null; description: string; skillTag?: string };

// Maps the deterministic goal engine's goalType (server/utils/levelGoalEngine.cjs)
// to one of the plain skill/avoid-item labels already used by
// SKILL_LABEL_I18N_KEY above — shown as a badge next to the Skill Coaching
// card's title. Goal types with no single countable skill
// (CALM_FOLLOWTHROUGH, INTEGRATE_SKILLS, MAINTAIN_SKILLS) are intentionally
// omitted — the badge is simply hidden for those.
const GOAL_TYPE_SKILL_TAG: Record<string, string> = {
  BUILD_PRAISE: 'Praise (Labeled)',
  BUILD_NARRATION: 'Narrate',
  BUILD_ECHO: 'Echo',
  BUILD_COMMANDS: 'Commands',
  AVOID_COMMANDS: 'Commands',
  AVOID_QUESTIONS: 'Questions',
  AVOID_CRITICISM: 'Criticism',
};

// Maps the tomorrow's-goal skill to a static "why this matters" i18n key
// (reportDetail.tomorrowGoal.why.*), shown only on the first-session
// template. `generic` covers goals with no single countable skill.
const GOAL_WHY_I18N_KEY: Record<string, string> = {
  'Praise (Labeled)': 'praise',
  'Narrate': 'narrate',
  'Echo': 'echo',
  'Commands': 'commands',
  'Questions': 'questions',
  'Criticism': 'criticism',
};

// Maps the same skill labels to the `teachesCategories` values lessons are
// tagged with server-side (server/routes/lessons.cjs's by-category lookup),
// used to find a lesson to recommend from the Skill Coaching card's
// "Learn more" button.
const SKILL_TAG_TO_CATEGORY: Record<string, string> = {
  'Praise (Labeled)': 'PRAISE',
  'Narrate': 'NARRATION',
  'Echo': 'ECHO',
  'Commands': 'COMMANDS',
  'Questions': 'QUESTIONS',
  'Criticism': 'CRITICISM',
};

// The general P.E.N. + active-ignoring walkthrough — used as the demo link
// for skills that don't have their own dedicated clip active yet.
const FULL_DEMO_VIDEO_TITLE = 'Full Demo of P.E.N skills and active ignoring';

// Maps the same skill labels to the admin-curated DemoVideo titles (each
// skill/avoid-item has its own short demo clip, matched by name since
// DemoVideo has no formal skill/category field). Commands/Questions/
// Criticism don't have an active dedicated clip, so they point at the full
// demo instead.
const SKILL_TAG_TO_DEMO_VIDEO_TITLE: Record<string, string> = {
  'Praise (Labeled)': 'Labelled Praise',
  'Narrate': 'Narrate',
  'Echo': 'Echo',
  'Commands': FULL_DEMO_VIDEO_TITLE,
  'Questions': FULL_DEMO_VIDEO_TITLE,
  'Criticism': FULL_DEMO_VIDEO_TITLE,
};

// Overrides the demo video's own title on the button for skills where the
// actual DemoVideo title (e.g. the shared full-demo clip's name) doesn't
// describe what this skill's goal is about.
const SKILL_TAG_TO_DEMO_VIDEO_DISPLAY_TITLE: Record<string, string> = {
  'Criticism': 'Replace criticism with active ignoring',
};

// Same client-side fallback as ReportScreen_v2.tsx (deriveGoalFromLevel in
// utils/goalFallback.ts) — reconstructs a same-shape goal from the parent's
// current level and this session's raw tag counts. Needed because
// tomorrowGoalDirective/pdiTomorrowGoalDirective is absent — or, for
// sessions analyzed before the level engine existed, may hold stale
// pre-level-engine copy — so a truthy tomorrowGoal string alone can't be
// trusted; only the structured directive object is. This wrapper just
// adds this screen's own skillTag presentation on top of the shared
// numeric derivation's goalType.
const deriveGoalFromLevel = (
  level: ParentSkillLevel,
  stats: Record<string, any> | undefined,
  mode: 'CDI' | 'PDI',
  t: (key: string) => string
): DerivedGoal => {
  const { focusSkill, currentNumber, targetNumber, description, goalType } = deriveGoalNumbersFromLevel(level, stats, mode, t);
  return { focusSkill, currentNumber, targetNumber, description, skillTag: goalType ? GOAL_TYPE_SKILL_TAG[goalType] : undefined };
};

export const ReportDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<ReportDetailRouteProp>();
  const { t, i18n } = useTranslation();
  const recordingService = useRecordingService();
  const authService = useAuthService();
  const lessonService = useLessonService();
  const { recordingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<RecordingAnalysis | null>(null);
  const [pollingCount, setPollingCount] = useState(0);
  const [childName, setChildName] = useState('Your Child');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [parentLevel, setParentLevel] = useState<ParentSkillLevel>(1);
  const [crisisExpanded, setCrisisExpanded] = useState(true);
  const [skillCoachingExpanded, setSkillCoachingExpanded] = useState(true);
  // null while unknown — the unlock card only renders once we know for sure,
  // so it never flashes on screen for a user who's already completed it.
  const [wacbCompleted, setWacbCompleted] = useState<boolean | null>(null);
  const [developmentalProgress, setDevelopmentalProgress] = useState<DevelopmentalProgress | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainType | null>(null);
  const [domainMilestones, setDomainMilestones] = useState<DomainMilestone[] | null>(null);
  const [domainProfiling, setDomainProfiling] = useState<DomainProfiling | null>(null);
  const [domainChildName, setDomainChildName] = useState<string | null>(null);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [loadingDomainMilestones, setLoadingDomainMilestones] = useState(false);
  const [goalSkillTag, setGoalSkillTag] = useState<string | undefined>(undefined);
  const [learnMoreLesson, setLearnMoreLesson] = useState<{ id: string; module: string; title: string } | null>(null);
  const [learnMoreDemoVideo, setLearnMoreDemoVideo] = useState<DemoVideo | null>(null);
  // null while unknown — true once we've confirmed this is the parent's only
  // completed session, which swaps in the welcome-oriented first-session
  // template (see showFirstSession). The __DEV__ chip at the bottom of the
  // screen forces it on regardless, for preview.
  const [isFirstSession, setIsFirstSession] = useState<boolean | null>(null);
  const [devForceFirstSession, setDevForceFirstSession] = useState(false);

  useEffect(() => {
    amplitudeService.trackScreenView('ReportDetail', { recordingId });
    loadReportData();
    loadChildName();
    loadWacbStatus();
    loadParentSkillLevel();
    loadSessionCount();
  }, [recordingId]);

  // Decides the first-session template: true when this recording is the only
  // COMPLETED session in the parent's history. Fails closed to the standard
  // template.
  const loadSessionCount = async () => {
    try {
      const { recordings } = await recordingService.getRecordings();
      const completedCount = (recordings || []).filter(
        (r: any) => r.analysisStatus === 'COMPLETED'
      ).length;
      setIsFirstSession(completedCount <= 1);
    } catch (err) {
      setIsFirstSession(false);
    }
  };

  const loadParentSkillLevel = async () => {
    try {
      const info = await authService.getParentSkillLevel();
      setParentLevel(info.currentLevel);
    } catch (err) {
      // Keep default level 1 if fetch fails
    }
  };

  // Fetched once reportData is available, same pattern as ReportScreen.tsx.
  useEffect(() => {
    if (!reportData) return;
    recordingService.getDevelopmentalProgress().then(data => {
      if (data) setDevelopmentalProgress(data);
    }).catch(() => {});
  }, [reportData?.createdAt]);

  // Resolves the same skill the tomorrow's-goal engine is targeting
  // (goalDirective when present, else the client-side level fallback) —
  // drives both the lesson and demo-video "learn more" links below.
  useEffect(() => {
    if (!reportData) {
      setGoalSkillTag(undefined);
      return;
    }
    const directive = reportData.mode === 'PDI'
      ? reportData.pdiTomorrowGoalDirective ?? null
      : reportData.tomorrowGoalDirective ?? null;
    const skillTag = directive
      ? (directive.goalType ? GOAL_TYPE_SKILL_TAG[directive.goalType] : undefined)
      : deriveGoalFromLevel(parentLevel, reportData.stats, reportData.mode, t).skillTag;
    setGoalSkillTag(skillTag);
  }, [reportData, parentLevel]);

  // Recommend a lesson for the Skill Coaching card's "Learn more" button.
  useEffect(() => {
    const category = goalSkillTag ? SKILL_TAG_TO_CATEGORY[goalSkillTag] : undefined;
    if (!category) {
      setLearnMoreLesson(null);
      return;
    }
    let cancelled = false;
    lessonService.getLessonsByCategory(category, i18n.language)
      .then(lessons => {
        if (cancelled) return;
        const lesson = lessons?.[0];
        setLearnMoreLesson(lesson ? { id: lesson.id, module: lesson.module, title: lesson.title } : null);
      })
      .catch(() => { if (!cancelled) setLearnMoreLesson(null); });
    return () => { cancelled = true; };
  }, [goalSkillTag]);

  // Demo video for the same skill — admin curates one demo per PEN
  // skill/avoid-item (titled e.g. "Labelled Praise", "Narrate", "Echo"),
  // matched by name rather than a formal relation. Independent of whether a
  // lesson was found above (e.g. Echo currently has a demo but no lesson).
  useEffect(() => {
    const demoTitle = goalSkillTag ? SKILL_TAG_TO_DEMO_VIDEO_TITLE[goalSkillTag] : undefined;
    if (!demoTitle) {
      setLearnMoreDemoVideo(null);
      return;
    }
    let cancelled = false;
    lessonService.getDemoVideos(i18n.language)
      .then(({ demoVideos }) => {
        if (cancelled) return;
        // Match on baseTitle (always English) — demoTitle comes from the
        // English SKILL_TAG_TO_DEMO_VIDEO_TITLE map, while `title` may be localized.
        const match = demoVideos.find(v => v.baseTitle.trim().toLowerCase() === demoTitle.toLowerCase()) || null;
        setLearnMoreDemoVideo(match);
      })
      .catch(() => { if (!cancelled) setLearnMoreDemoVideo(null); });
    return () => { cancelled = true; };
  }, [goalSkillTag, i18n.language]);

  const handleDomainPress = async (domain: DomainType) => {
    setSelectedDomain(domain);
    setShowDomainModal(true);
    setLoadingDomainMilestones(true);
    setDomainMilestones(null);
    setDomainProfiling(null);
    setDomainChildName(null);
    try {
      const response = await recordingService.getDomainMilestones(domain);
      setDomainMilestones(response.milestones);
      setDomainProfiling(response.profiling);
      setDomainChildName(response.childName);
    } catch (error) {
      console.error('Failed to load domain milestones:', error);
    } finally {
      setLoadingDomainMilestones(false);
    }
  };

  const handleCloseDomainModal = () => {
    setShowDomainModal(false);
    setSelectedDomain(null);
    setDomainMilestones(null);
    setDomainProfiling(null);
    setDomainChildName(null);
  };

  const loadChildName = async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      if (user?.childName) setChildName(user.childName);
    } catch (err) {
      // Keep default "Your Child" if fetch fails
    }
  };

  const loadWacbStatus = async () => {
    try {
      setWacbCompleted(await authService.hasCompletedWacbSurvey());
    } catch (err) {
      // Unknown — leave the card hidden rather than risk showing it to
      // someone who's already completed the survey.
      setWacbCompleted(true);
    }
  };

  const handleUnlockPlan = () => {
    amplitudeService.trackEvent('Report Detail Unlock Plan Tapped', { recordingId });
    navigation.navigate('Onboarding', {
      initialStep: 'WacbQuestion1',
      resumeUserData: currentUser ?? undefined,
      wacbReturnRecordingId: recordingId,
    });
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await recordingService.getAnalysis(recordingId);
      setReportData(data);
      setLoading(false);
    } catch (err: any) {
      console.log('Report error:', err.message);
      if (err.message.includes('processing') && pollingCount < 20) {
        setPollingCount(prev => prev + 1);
        setTimeout(() => { loadReportData(); }, 3000);
      } else if (pollingCount >= 20) {
        setError('Analysis is taking longer than expected. Please try again later.');
        setLoading(false);
      } else {
        setError(err.message || t('report.failedToLoad'));
        setLoading(false);
      }
    }
  };

  const handleBack = () => navigation.goBack();

  const handleShare = async () => {
    amplitudeService.trackEvent('Report Detail Share Tapped', { recordingId });
    try {
      const score = reportData?.noraScore ?? 0;
      await Share.share({ message: t('reportV2.shareMessage', { childName, score }) });
    } catch (err) {
      // User cancelled or share failed — nothing to recover from
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={COLORS.mainPurple} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('reportDetail.headerTitle')}</Text>
          <View style={styles.headerButton} />
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
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={COLORS.mainPurple} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('reportDetail.headerTitle')}</Text>
          <View style={styles.headerButton} />
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

  // ── Derived data ──

  const skills = reportData.skills || [];
  const filteredAreas = (reportData.areasToAvoid || []).filter(
    a => !(reportData.mode === 'PDI' && a.label === 'Commands')
  );

  // Same dynamic Echo target as ReportScreen.tsx — sessions with fewer than
  // 10 child utterances scale the goal down instead of judging against 10.
  const childUtteranceCount = (reportData.transcript || []).filter(u => u.role === 'child').length;
  const echoTarget = childUtteranceCount < 10 ? Math.round(childUtteranceCount * 0.75) : 10;

  // Crisis moment is extracted from the coaching narrative — only present
  // (and only rendered) when the session actually had a distress moment.
  const crisisMoment = reportData.crisisMoment?.detected ? reportData.crisisMoment : null;

  // Independent second "top moment" finder (generateCrisis) — a 2-3
  // consecutive-utterance bonding exchange, separate from the
  // combined-feedback topMoment used above. Absent for older sessions.
  const bondingMoment = reportData.bondingMoment || null;

  // Top Moment: reuse the same "preceding utterance + main utterance" shape
  // as ReportScreen.tsx's getUtterancesForSkill so both lines of dialogue
  // show, not just the single tagged line.
  const transcript = reportData.transcript || [];
  const topIdx = reportData.topMomentUtteranceNumber;
  const precedingLine = topIdx != null && topIdx > 0 ? transcript[topIdx - 1] : null;
  const mainLine = topIdx != null ? transcript[topIdx] : null;
  const fallbackQuote = typeof reportData.topMoment === 'string' ? reportData.topMoment : reportData.topMoment?.quote;
  // Prefers the bonding-moment's own context line; falls back to
  // topMomentCelebration, then to a generic line for sessions analyzed
  // before either of those existed.
  const celebration = bondingMoment?.context
    || reportData.topMomentCelebration
    || t('reportDetail.topMoment.afterMoment', { childName });

  // The Top Moment card's quote + audio now prefer the independent bonding
  // exchange (generateCrisis) over the older combined-feedback topMoment —
  // falls back to the old fields for sessions analyzed before bondingMoment
  // existed. Audio start/end are derived from the transcript's own per-
  // utterance timing, spanning every line of the quoted exchange.
  // The LLM writes generic "Child:"/"Parent:" speaker labels — swap in the
  // real child's name and address the parent directly as "You".
  const bondingLines = bondingMoment
    ? bondingMoment.quote.split('\n').filter(Boolean).map(line => line
        .replace(/^Child:/i, `${childName}:`)
        .replace(/^Parent:/i, `${t('reportDetail.topMoment.you')}:`))
    : [];
  const bondingStartUtt = bondingMoment ? transcript[bondingMoment.utteranceNumber] : null;
  const bondingEndUtt = bondingMoment ? transcript[bondingMoment.utteranceNumber + Math.max(bondingLines.length - 1, 0)] : null;
  const momentStartTime = bondingMoment ? (bondingStartUtt?.start ?? null) : (reportData.topMomentStartTime ?? null);
  const momentEndTime = bondingMoment ? (bondingEndUtt?.end ?? null) : (reportData.topMomentEndTime ?? null);

  // Prefers the deterministic, level-gated directive; falls back to a
  // client-derived version keyed off parentLevel + this session's raw counts
  // (same pattern as ReportScreen_v2.tsx) for sessions where that field is
  // absent or stale.
  const goalDirective = reportData.mode === 'PDI'
    ? reportData.pdiTomorrowGoalDirective ?? null
    : reportData.tomorrowGoalDirective ?? null;
  const goal: DerivedGoal = goalDirective
    ? {
        focusSkill: goalDirective.focusSkill,
        currentNumber: goalDirective.currentNumber,
        targetNumber: goalDirective.targetNumber ?? null,
        description: goalDirective.actionPrompt || '',
        skillTag: goalDirective.goalType ? GOAL_TYPE_SKILL_TAG[goalDirective.goalType] : undefined,
      }
    : deriveGoalFromLevel(parentLevel, reportData.stats, reportData.mode, t);

  // Prefers the server-persisted selection (dedup'd + ratio-balanced across
  // sessions — see aboutChildSelectionService.cjs); falls back to the array's
  // first (most-positive-ranked) item for older sessions predating selection.
  const aboutChildItem = reportData.selectedAboutChild || reportData.aboutChild?.[0];
  // Real tags from the about-child extraction — hidden entirely for older
  // sessions analyzed before this field existed, rather than faking chips.
  const childTags = aboutChildItem?.tags || [];
  const childInsightBody = aboutChildItem?.Description || reportData.childReaction || null;

  // Not currently wired to a ReportCard headerRight — share buttons on these
  // two cards are temporarily hidden, kept here (not deleted) to restore later.
  const handleShareChildInsight = async () => {
    amplitudeService.trackEvent('Report Detail Share Tapped', { recordingId, section: 'childInsight' });
    try {
      const insight = [aboutChildItem?.Title, childInsightBody].filter(Boolean).join('\n\n');
      const message = insight
        ? t('reportDetail.childInsight.shareMessage', { childName, insight })
        : t('reportDetail.childInsight.title', { childName });
      await Share.share({ message });
    } catch (err) {
      // User cancelled or share failed — nothing to recover from
    }
  };

  const handleShareDevelopmental = async () => {
    amplitudeService.trackEvent('Report Detail Share Tapped', { recordingId, section: 'developmentalMilestones' });
    try {
      const message = t('reportDetail.developmental.shareMessage', { childName: developmentalProgress?.childName || childName });
      await Share.share({ message });
    } catch (err) {
      // User cancelled or share failed — nothing to recover from
    }
  };

  // ── First-session template ──
  // The parent's very first completed session gets a distinct,
  // welcome-oriented report: hero image + message, then "what we learned",
  // top moment, today's interaction style, tomorrow's goal (+ why it
  // matters) and the personalised-coaching survey. Coach's Corner, the
  // developmental radar and the transcript link are all withheld until
  // session 2. The Crisis Moment card is still kept on top when a distress
  // moment was detected.
  const showFirstSession = devForceFirstSession || isFirstSession === true;

  // "Why this matters" for the first session is deliberately personalised —
  // it's the retention hook. It weaves in the parent's stated concern
  // (currentUser.issue) and the child's age band on top of the skill-specific
  // reason, so the goal feels chosen for this family rather than generic.
  const whyKey = goal.skillTag ? GOAL_WHY_I18N_KEY[goal.skillTag] : undefined;
  const skillReason = t(`reportDetail.tomorrowGoal.why.${whyKey || 'generic'}` as any, { childName });

  const primaryIssue = Array.isArray(currentUser?.issue) ? currentUser?.issue[0] : currentUser?.issue;
  const concernKey = primaryIssue ? `reportDetail.tomorrowGoal.concern.${primaryIssue}` : null;
  const concern = concernKey && i18n.exists(concernKey)
    ? t(concernKey, { childName })
    : t('reportDetail.tomorrowGoal.concern.generic', { childName });

  const childAge = calculateChildAge(currentUser?.childBirthday, currentUser?.childBirthYear);
  const ageBandKey = childAge == null
    ? 'unknownAge'
    : childAge <= 3
      ? 'toddler'
      : childAge <= 5
        ? 'preschool'
        : 'schoolAge';

  const whyThisMatters = t(
    `reportDetail.tomorrowGoal.whyPersonalised.${ageBandKey}` as any,
    { childName, age: childAge ?? undefined, concern, skillReason },
  );

  // ── Shared card bodies (used by both the standard and first-session layouts) ──

  const crisisCardJsx = crisisMoment ? (
    <ReportCard
      eyebrow={
        <View style={styles.crisisBadge}>
          <Text style={styles.crisisBadgeText}>{t('reportDetail.crisis.title')}</Text>
        </View>
      }
      title={crisisMoment.title || t('reportDetail.crisis.title')}
    >
      <MarkdownText style={styles.crisisBody} numberOfLines={crisisExpanded ? undefined : 4}>
        {crisisMoment.coaching || crisisMoment.description || ''}
      </MarkdownText>
      <TouchableOpacity
        style={styles.crisisReadMoreRow}
        activeOpacity={0.7}
        onPress={() => setCrisisExpanded(prev => !prev)}
      >
        <Text style={styles.crisisReadMoreText}>
          {crisisExpanded ? t('reportDetail.crisis.showLess') : t('reportDetail.crisis.readMore')}
        </Text>
        <Ionicons name={crisisExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#C2694B" />
      </TouchableOpacity>
    </ReportCard>
  ) : null;

  const topMomentBody = (
    <>
      {reportData.audioUrl && momentStartTime != null && momentEndTime != null && (
        <MomentPlayer
          audioUrl={reportData.audioUrl}
          startTime={momentStartTime}
          endTime={momentEndTime}
        />
      )}

      {bondingMoment ? (
        <View style={styles.quoteLines}>
          {bondingLines.map((line, i) => (
            <Text key={i} style={styles.quoteLine}>{line}</Text>
          ))}
        </View>
      ) : precedingLine || mainLine ? (
        <View style={styles.quoteLines}>
          {precedingLine && (
            <Text style={styles.quoteLine}>
              <Text style={styles.quoteSpeaker}>{precedingLine.role === 'child' ? childName : t('report.speakerAdult')}: </Text>
              "{stripPcitTags(precedingLine.text)}"
            </Text>
          )}
          {mainLine && (
            <Text style={styles.quoteLine}>
              <Text style={styles.quoteSpeaker}>{mainLine.role === 'child' ? childName : t('report.speakerAdult')}: </Text>
              "{stripPcitTags(mainLine.text)}"
            </Text>
          )}
        </View>
      ) : (
        fallbackQuote && <Text style={styles.quoteLine}>"{stripPcitTags(fallbackQuote)}"</Text>
      )}
    </>
  );

  const childInsightBodyJsx = (
    <>
      {aboutChildItem?.Title && (
        <View style={styles.childInsightTitleBadge}>
          <Text style={styles.childInsightTitleBadgeText}>{aboutChildItem.Title}</Text>
        </View>
      )}
      {childInsightBody && <Text style={styles.childInsightBody}>{childInsightBody}</Text>}
    </>
  );

  const interactionBody = (
    <>
      <Text style={styles.interactionSubheading}>{t('report.section.penSkills')}</Text>
      {skills.map((skill, index) => {
        const maxValue = skill.label === 'Echo' ? echoTarget : 10;
        const rating = getSkillRating(skill.progress, t, maxValue);
        const isDynamicEcho = skill.label === 'Echo' && childUtteranceCount < 10;
        return (
          <SkillProgressBar
            key={index}
            label={getSkillDisplayLabel(skill.label, t)}
            progress={skill.progress}
            maxValue={maxValue}
            color={rating.barColor}
            textColor={rating.textColor}
            suffix={isDynamicEcho ? `${rating.suffix}*` : rating.suffix}
            onPress={() => {
              amplitudeService.trackEvent('Report Skill Tapped', { skillKey: skill.label, progress: skill.progress });
              navigation.navigate('SkillUtterances', { skillKey: skill.label, recordingId, utterances: getUtterancesForSkill(reportData.transcript, skill.label), target: maxValue, childUtteranceCount });
            }}
          />
        );
      })}
      {childUtteranceCount < 10 && skills.some(s => s.label === 'Echo') && (
        <Text style={styles.echoFootnote}>
          {`* ${t('skillInfo.echoGoalDynamic' as any, { count: childUtteranceCount, target: echoTarget })}`}
        </Text>
      )}

      <View style={styles.interactionDivider} />

      <Text style={styles.interactionSubheading}>{t('report.section.areasToAvoid')}</Text>
      <View style={styles.avoidContainer}>
        {filteredAreas.map((area, index) => (
          <TouchableOpacity
            key={index}
            style={styles.avoidItem}
            activeOpacity={0.7}
            onPress={() => {
              amplitudeService.trackEvent('Report Area Avoided Tapped', { skillKey: area.label, count: area.count });
              navigation.navigate('SkillUtterances', { skillKey: area.label, recordingId, utterances: getUtterancesForSkill(reportData.transcript, area.label) });
            }}
          >
            <View style={styles.avoidLabelRow}>
              <Text style={styles.avoidLabel}>{getSkillDisplayLabel(area.label, t)}</Text>
              <Text style={[styles.avoidCount, { color: area.count >= 3 ? '#C2694B' : '#8C49D5' }]}>
                {area.count}{area.count >= 3 ? ` ${t('report.skillRating.payAttention')}` : ''}
              </Text>
            </View>
            <View style={styles.circlesContainer}>
              {Array.from({ length: area.count }).map((_, i) => (
                <View key={i} style={styles.circle} />
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  // Real first-session parents almost never have the WACB survey done yet;
  // the __DEV__ force-toggle also shows it regardless so it can be previewed.
  const surveyCardJsx = (wacbCompleted === false || devForceFirstSession) ? (
    <View style={styles.unlockCard}>
      <View style={styles.unlockIconBadge}>
        <Ionicons name="lock-closed" size={22} color={COLORS.mainPurple} />
      </View>
      <Text style={styles.unlockTitle}>{t('reportDetail.unlock.title')}</Text>
      <Text style={styles.unlockSubtitle}>{t('reportDetail.unlock.subtitle')}</Text>

      <View style={styles.unlockFeatureRow}>
        <View style={styles.unlockFeature}>
          <View style={styles.unlockFeatureBadge}>
            <Ionicons name="trending-up" size={16} color={COLORS.mainPurple} />
          </View>
          <Text style={styles.unlockFeatureText}>{t('reportDetail.unlock.featureGrowthPlan')}</Text>
        </View>
        <View style={styles.unlockFeature}>
          <View style={styles.unlockFeatureBadge}>
            <Ionicons name="person-circle-outline" size={16} color={COLORS.mainPurple} />
          </View>
          <Text style={styles.unlockFeatureText}>{t('reportDetail.unlock.featureSnapshot')}</Text>
        </View>
        <View style={styles.unlockFeature}>
          <View style={styles.unlockFeatureBadge}>
            <Ionicons name="analytics-outline" size={16} color={COLORS.mainPurple} />
          </View>
          <Text style={styles.unlockFeatureText}>{t('reportDetail.unlock.featureTracking')}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.unlockButton} activeOpacity={0.85} onPress={handleUnlockPlan}>
        <Text style={styles.unlockButtonText}>{t('reportDetail.unlock.cta')}</Text>
      </TouchableOpacity>
      <View style={styles.unlockTimeRow}>
        <Ionicons name="time-outline" size={12} color="#9A8672" />
        <Text style={styles.unlockTimeText}>{t('reportDetail.unlock.time')}</Text>
      </View>
    </View>
  ) : null;

  const devPreviewBar = __DEV__ ? (
    <View style={styles.devBar}>
      <Text style={styles.devBarLabel}>PREVIEW (dev only)</Text>
      <TouchableOpacity
        onPress={() => setDevForceFirstSession(v => !v)}
        style={[styles.devChip, devForceFirstSession && styles.devChipActive]}
        activeOpacity={0.7}
      >
        <Text style={[styles.devChipText, devForceFirstSession && styles.devChipTextActive]}>
          {devForceFirstSession ? 'First time template: ON' : 'First time template: OFF'}
        </Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.mainPurple} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('reportDetail.headerTitle')}</Text>
        <TouchableOpacity onPress={handleShare} style={styles.headerButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="share-outline" size={20} color={COLORS.mainPurple} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {showFirstSession ? (
          <>
            {/* Crisis Moment — kept on top for the first-session template */}
            {crisisCardJsx}

            {/* 1. Hero — first-session welcome (image + message) */}
            <View style={styles.fsHeroCard}>
              <Image source={REPORT_DETAIL_DRAGON} style={styles.fsHeroImage} resizeMode="contain" />
              <Text style={styles.fsHeroIntro}>{t('reportDetail.firstSession.heroIntro', { childName })}</Text>
              <Text style={styles.fsHeroMessage}>
                {t('reportDetail.firstSession.heroMessage', { childName })}
              </Text>
            </View>

            {/* 2. What we learned about {childName} */}
            <ReportCard icon="heart" title={t('reportDetail.childInsight.title', { childName })}>
              {childInsightBodyJsx}
            </ReportCard>

            {/* 3. Top Moment */}
            <ReportCard icon="star" title={t('reportDetail.topMoment.title')} tip={celebration || undefined}>
              {topMomentBody}
            </ReportCard>

            {/* 4. Today's Interaction Style */}
            <ReportCard title={t('reportDetail.interactionStyle.title')}>
              {interactionBody}
            </ReportCard>

            {/* 5. Tomorrow's Goal + why this matters */}
            {goal.focusSkill && (
              <ReportCard title={t('reportDetail.tomorrowGoal.title')} tip={goal.description || undefined}>
                <Text style={styles.goalFocusSkill}>{goal.focusSkill}</Text>
                <Text style={styles.fsWhyTitle}>{t('reportDetail.tomorrowGoal.whyTitle')}</Text>
                <Text style={styles.fsWhyBody}>{whyThisMatters}</Text>
              </ReportCard>
            )}

            {/* 6. Survey for personalised coaching */}
            {surveyCardJsx}
          </>
        ) : (
          <>
        {/* Hero — bespoke, doesn't fit the card shape */}
        <View style={styles.heroCard}>
          <Image source={REPORT_DETAIL_DRAGON} style={styles.heroDragon} resizeMode="contain" />
          <View style={styles.heroTextCol}>
            <Text style={styles.heroIntro}>
              {crisisMoment ? t('reportDetail.heroIntro') : t('reportDetail.heroIntroDefault')}
            </Text>
            <Text style={styles.heroBold}>
              {reportData.heroText || t('reportDetail.heroFallback', { childName })}
            </Text>
          </View>
        </View>

        {/* Crisis Moment — only rendered when the session actually had one */}
        {crisisCardJsx}

        {/* Top Moment */}
        <ReportCard icon="star" title={t('reportDetail.topMoment.title')} tip={celebration || undefined}>
          {topMomentBody}
        </ReportCard>

        {/* Skill Coaching — coaching note for tomorrow's goal skill, grounded in this session */}
        {reportData.skillCoaching && (
          <ReportCard
            title={t('reportDetail.skillCoaching.title')}
            headerRight={
              goal.skillTag ? (
                <View style={styles.skillTagBadge}>
                  <Text style={styles.skillTagBadgeText}>{getSkillDisplayLabel(goal.skillTag, t)}</Text>
                </View>
              ) : undefined
            }
          >
            <MarkdownText style={styles.crisisBody} numberOfLines={skillCoachingExpanded ? undefined : 4}>
              {reportData.skillCoaching}
            </MarkdownText>
            {skillCoachingExpanded && (
              <>
                {learnMoreLesson && (
                  <>
                    <Text style={styles.learnMoreTitle}>
                      {t('reportDetail.skillCoaching.learnMoreTitle', { skill: getSkillDisplayLabel(goalSkillTag!, t) })}
                    </Text>
                    <TouchableOpacity
                      style={styles.learnMoreButton}
                      activeOpacity={0.7}
                      onPress={() => {
                        amplitudeService.trackEvent('Report Detail Learn More Tapped', {
                          recordingId,
                          skillTag: goalSkillTag,
                          lessonId: learnMoreLesson.id,
                        });
                        if (CONTENT_V2_MODULES.includes(learnMoreLesson.module)) {
                          navigation.navigate('LessonViewerV2', { lessonId: learnMoreLesson.id, moduleKey: learnMoreLesson.module });
                        } else {
                          navigation.navigate('LessonViewer', { lessonId: learnMoreLesson.id, moduleKey: learnMoreLesson.module });
                        }
                      }}
                    >
                      <View style={styles.lessonBadge}>
                        <Text style={styles.lessonBadgeText}>{t('reportDetail.skillCoaching.lessonBadge')}</Text>
                      </View>
                      <Text style={styles.learnMoreButtonText} numberOfLines={1}>
                        {learnMoreLesson.title}
                      </Text>
                      <Ionicons name="arrow-forward" size={15} color="#8C49D5" />
                    </TouchableOpacity>
                  </>
                )}
                {learnMoreDemoVideo && (
                  <TouchableOpacity
                    style={styles.learnMoreButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      amplitudeService.trackEvent('Report Detail Demo Video Tapped', {
                        recordingId,
                        skillTag: goalSkillTag,
                        demoVideoId: learnMoreDemoVideo.id,
                      });
                      navigation.navigate('DemoVideoDetail', { video: learnMoreDemoVideo });
                    }}
                  >
                    <View style={styles.demoBadge}>
                      <Text style={styles.demoBadgeText}>{t('reportDetail.skillCoaching.demoBadge')}</Text>
                    </View>
                    <Text style={styles.demoButtonText} numberOfLines={1}>
                      {(goalSkillTag && SKILL_TAG_TO_DEMO_VIDEO_DISPLAY_TITLE[goalSkillTag]) || learnMoreDemoVideo.title}
                    </Text>
                    <Ionicons name="arrow-forward" size={15} color="#C2694B" />
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity
              style={styles.crisisReadMoreRow}
              activeOpacity={0.7}
              onPress={() => setSkillCoachingExpanded(prev => !prev)}
            >
              <Text style={styles.crisisReadMoreText}>
                {skillCoachingExpanded ? t('reportDetail.crisis.showLess') : t('reportDetail.crisis.readMore')}
              </Text>
              <Ionicons name={skillCoachingExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#C2694B" />
            </TouchableOpacity>
          </ReportCard>
        )}

        {/* Tomorrow's Goal — temporarily hidden, may use it later
        {goal.focusSkill && (
          <ReportCard title={t('reportDetail.tomorrowGoal.title')} tip={goal.description || undefined}>
            <Text style={styles.goalFocusSkill}>{goal.focusSkill}</Text>
          </ReportCard>
        )}
        */}

        {/* What we learned about {childName} */}
        <ReportCard icon="heart" title={t('reportDetail.childInsight.title', { childName })}>
          {childInsightBodyJsx}
        </ReportCard>

        {/* Developmental Milestones — expandable */}
        <ReportCard
          title={developmentalProgress?.childName
            ? t('report.section.developmentalMilestonesWithName', { childName: developmentalProgress.childName })
            : t('report.section.developmentalMilestones')}
          expandable
        >
          {developmentalProgress && developmentalProgress.completedSessionCount >= 5 ? (
            <RadarChart
              data={developmentalProgress}
              childName={developmentalProgress.childName}
              onDomainPress={handleDomainPress}
              showTitle={false}
            />
          ) : (
            <>
              <View style={styles.milestoneLockedBadge}>
                <Text style={styles.milestoneLockedBadgeText}>
                  {t('report.milestone.lockedBadge', { count: developmentalProgress?.completedSessionCount ?? 0 })}
                </Text>
              </View>
              <Text style={styles.milestoneLockedDesc}>{t('report.milestone.lockedDescription')}</Text>
            </>
          )}
        </ReportCard>

        {/* Today's Interaction — expandable */}
        <ReportCard
          title={t('reportDetail.interactionStyle.title')}
          expandable
        >
          {interactionBody}
        </ReportCard>

        {/* Full Transcript */}
        <ReportCard
          icon="document-text"
          title={t('reportDetail.transcript.title')}
          subtitle={t('reportDetail.transcript.subtitle')}
          onPress={() => { amplitudeService.trackEvent('Report Transcript Tapped', { recordingId }); navigation.navigate('Transcript', { recordingId }); }}
          headerRight={<Ionicons name="chevron-forward" size={17} color={REPORT_CARD_COLORS.iconColor} />}
        />

        {/* Unlock My Child's Plan — bespoke, hidden once the user has completed the WACB survey */}
        {surveyCardJsx}
          </>
        )}

        {devPreviewBar}
      </ScrollView>

      <DomainMilestoneModal
        visible={showDomainModal}
        domain={selectedDomain}
        milestones={domainMilestones}
        profiling={domainProfiling}
        childName={domainChildName}
        loading={loadingDomainMilestones}
        onClose={handleCloseDomainModal}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5EAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    color: REPORT_CARD_COLORS.title,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontFamily: FONTS.regular, fontSize: 18, color: COLORS.textDark, marginTop: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontFamily: FONTS.regular, fontSize: 18, color: '#E74C3C', textAlign: 'center', marginTop: 16, marginBottom: 24 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },

  // ── First-session hero (bespoke) — placeholder styling until the final
  //    hero image + copy from design land. ──
  fsHeroCard: {
    backgroundColor: '#FCEFE0',
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 22,
    marginBottom: 18,
    alignItems: 'center',
    shadowColor: '#8C49D5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 3,
  },
  fsHeroImage: {
    width: 168,
    height: 168,
    marginBottom: 8,
  },
  fsHeroIntro: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    color: COLORS.mainPurple,
    textAlign: 'center',
    marginBottom: 8,
  },
  fsHeroMessage: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#7A4A22',
    textAlign: 'center',
  },

  // ── First-session "why this matters" (inside the Tomorrow's Goal card) ──
  fsWhyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    letterSpacing: 0.4,
    color: '#B08A5A',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  fsWhyBody: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
  },

  // ── Dev preview bar (__DEV__ only) ──
  devBar: {
    marginTop: 8,
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
  devChip: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
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

  // ── Hero (bespoke) ──
  heroCard: {
    position: 'relative',
    backgroundColor: '#FCEFE0',
    borderRadius: 28,
    paddingVertical: 26,
    paddingRight: 18,
    paddingLeft: 168,
    marginTop: 0,
    marginBottom: 18,
    justifyContent: 'center',
    minHeight: 150,
    shadowColor: '#8C49D5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 3,
  },
  heroDragon: {
    position: 'absolute',
    left: -16,
    bottom: -18,
    width: 184,
    height: 184,
    zIndex: 2,
  },
  heroTextCol: {},
  heroIntro: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#7A4A22',
    marginBottom: 6,
  },
  heroBold: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.mainPurple,
    lineHeight: 23,
  },

  // ── Crisis Moment content ──
  crisisBadge: { backgroundColor: '#FBE3CE', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  crisisBadgeText: { fontFamily: FONTS.bold, fontSize: 11, color: '#C2694B'  },
  skillTagBadge: { backgroundColor: '#F5EAFB', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  skillTagBadgeText: { fontFamily: FONTS.bold, fontSize: 11, color: '#8C49D5' },
  learnMoreTitle: { fontFamily: FONTS.semiBold, fontSize: 13, color: '#7A6252', marginTop: 14 },
  learnMoreButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'stretch' },
  learnMoreButtonText: { flexShrink: 1, fontFamily: FONTS.semiBold, fontSize: 14, color: '#8C49D5' },
  demoButtonText: { flexShrink: 1, fontFamily: FONTS.semiBold, fontSize: 14, color: '#C2694B' },
  lessonBadge: { backgroundColor: '#F5EAFB', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  lessonBadgeText: { fontFamily: FONTS.bold, fontSize: 10, color: '#8C49D5' },
  demoBadge: { backgroundColor: '#FBE3CE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  demoBadgeText: { fontFamily: FONTS.bold, fontSize: 10, color: '#C2694B' },
  // Font formatting matches ReportScreen.tsx's coachDescription (Coach's Corner content).
  crisisBody: { fontFamily: FONTS.regular, fontSize: 16, color: '#4B5563', lineHeight: 24, marginBottom: 4, marginTop: 3 },
  crisisReadMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  crisisReadMoreText: { fontFamily: FONTS.semiBold, fontSize: 13, color: '#C2694B' },

  // ── Top Moment content ──
  quoteLines: { marginTop: 4, gap: 6, alignItems: 'center' },
  quoteLine: { fontFamily: FONTS.regular, fontSize: 15, color: REPORT_CARD_COLORS.title, lineHeight: 22, textAlign: 'center' },
  quoteSpeaker: { fontFamily: FONTS.bold, color: REPORT_CARD_COLORS.title },

  // ── Tomorrow's Goal content ──
  goalFocusSkill: { fontFamily: FONTS.bold, fontSize: 16, color: REPORT_CARD_COLORS.title },

  // ── Today's Interaction content ──
  interactionSubheading: { fontFamily: FONTS.bold, fontSize: 14, letterSpacing: 0.4, color: '#B08A5A', textTransform: 'uppercase', marginBottom: 14 },
  interactionDivider: { height: 1, backgroundColor: '#F3E9DD', marginTop: 6, marginBottom: 20 },
  echoFootnote: { fontFamily: FONTS.regular, fontSize: 13, color: '#B08A5A', lineHeight: 16, marginTop: -6, marginBottom: 6 },
  avoidContainer: { gap: 16 },
  avoidItem: { gap: 9 },
  avoidLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avoidLabel: { fontFamily: FONTS.semiBold, fontSize: 15, color: REPORT_CARD_COLORS.title },
  avoidCount: { fontFamily: FONTS.regular, fontSize: 12 },
  circlesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  circle: { width: 18, height: 18, borderRadius: 18, backgroundColor: '#E9A688' },

  // ── What we learned about {childName} content ──
  childInsightTitleBadge: { alignSelf: 'flex-start', backgroundColor: '#FDF2E9', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8 },
  childInsightTitleBadgeText: { fontFamily: FONTS.bold, fontSize: 13, color: '#C2694B' },
  childInsightBody: { fontFamily: FONTS.regular, fontSize: 14, color: REPORT_CARD_COLORS.subtitle, lineHeight: 19, marginBottom: 10 },
  childTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  childTagChip: { backgroundColor: '#FDF2E9', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  childTagText: { fontFamily: FONTS.semiBold, fontSize: 12, color: '#C2694B' },

  // ── Developmental Milestones content ──
  milestoneLockedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDF2E9',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  milestoneLockedBadgeText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#C2694B' },
  milestoneLockedDesc: { fontFamily: FONTS.regular, fontSize: 14, color: REPORT_CARD_COLORS.subtitle, lineHeight: 18 },

  // ── Unlock My Child's Plan (bespoke) ──
  unlockCard: {
    alignItems: 'center',
    backgroundColor: '#FCEFE0',
    borderRadius: 28,
    padding: 26,
    marginBottom: 18,
    shadowColor: '#8C49D5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 3,
  },
  unlockIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  unlockTitle: { fontFamily: FONTS.bold, fontSize: 18, color: REPORT_CARD_COLORS.title, textAlign: 'center', marginBottom: 8 },
  unlockSubtitle: { fontFamily: FONTS.regular, fontSize: 14, color: REPORT_CARD_COLORS.subtitle, textAlign: 'center', marginBottom: 18 },
  unlockFeatureRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 22 },
  unlockFeature: { alignItems: 'center', width: 82 },
  unlockFeatureBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 7,
  },
  unlockFeatureText: { fontFamily: FONTS.semiBold, fontSize: 12, color: REPORT_CARD_COLORS.title, textAlign: 'center', lineHeight: 14 },
  unlockButton: {
    width: '100%',
    backgroundColor: COLORS.mainPurple,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  unlockButtonText: { fontFamily: FONTS.bold, fontSize: 14, color: '#FFFFFF' },
  unlockTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  unlockTimeText: { fontFamily: FONTS.regular, fontSize: 13, color: '#9A8672' },
});
