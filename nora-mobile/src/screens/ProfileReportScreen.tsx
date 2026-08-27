/**
 * ProfileReportScreen
 * Child hero card, core focus areas, and personalized learning journey,
 * followed by the existing session score/skills/coaching sections.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, TextInput, LayoutAnimation, Platform, UIManager, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SkillProgressBar } from '../components/SkillProgressBar';
import { Button } from '../components/Button';
import { COLORS, FONTS, PROFILE_REPORT_CHILD, PROFILE_REPORT_THANKS_DRAGON, REPORT_DETAIL_DRAGON } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService, useAuthService } from '../contexts/AppContext';
import type { RecordingAnalysis, CoachingCard, CoachingSection, MilestoneCelebration, DevelopmentalProgress, DomainType, DomainMilestone, DomainProfiling, WacbSurvey, ParentSkillLevel } from '@nora/core';
import { RadarChart } from '../components/RadarChart';
import { DomainMilestoneModal } from '../components/DomainMilestoneModal';
import { MarkdownText } from '../utils/MarkdownText';
import { MomentPlayer } from '../components/MomentPlayer';
import { PhaseCelebrationModal } from '../components/PhaseCelebrationModal';
import * as userStorage from '../lib/userStorage';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';
import {
  PARENT_SKILL_LEVEL_ORDER,
  PARENT_SKILL_LEVEL_KEYS,
  PARENT_SKILL_LEVEL_ICONS,
  PARENT_SKILL_LEVEL_SKILL_LABEL,
} from '../constants/parentSkillLevels';

type ProfileReportScreenRouteProp = RouteProp<RootStackParamList, 'ProfileReport'>;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Helper to strip PCIT tags (e.g., LP, IC, DC, RF, BD) from quote text
const stripPcitTags = (text: string): string => {
  if (!text) return text;
  return text
    .split('\n')
    .map(line => line.replace(/\s+(LP|IC|DC|RF|BD|NT|QU|CM|CR|UP|NE|EC|PR|NA)$/gi, ''))
    .join('\n')
    .trim();
};

const SKILL_TAG_MAP: Record<string, string> = {
  'Praise (Labeled)': 'Labeled Praise',
  'Echo': 'Echo',
  'Narrate': 'Narration',
  'Questions': 'Question',
  'Commands': 'Command',
  'Criticism': 'Criticism',
};

// Maps API label → i18n key suffix (under report.skillLabel.*)
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

// Helper to get skill rating info based on progress value
const getSkillRating = (progress: number, t: Function, maxValue: number = 10): { barColor?: string; textColor?: string; suffix?: string } => {
  if (progress <= maxValue * 0.5) {
    return { barColor: '#852221', textColor: '#852221', suffix: t('report.skillRating.payAttention') };
  } else if (progress <= maxValue * 0.8) {
    return { barColor: '#6750A4', textColor: '#6750A4', suffix: t('report.skillRating.good') };
  } else {
    return { barColor: '#6750A4', textColor: '#6750A4', suffix: t('report.skillRating.excellent') };
  }
};

/** Label color mapping for command sequences */
const LABEL_COLORS: { [key: string]: { bg: string; text: string } } = {
  'Great!': { bg: '#DCFCE7', text: '#15803D' },
  'Needs Work': { bg: '#FEF3C7', text: '#B45309' },
};

const getLabelColors = (label: string) => {
  return LABEL_COLORS[label] || LABEL_COLORS['Needs Work'];
};

const NEGATIVE_REASONS = ['Too generic', 'Not accurate', 'Hard to understand', 'Missing something'];

const calculateAge = (birthday?: Date | string | null): number | null => {
  if (!birthday) return null;
  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return Math.max(age, 0);
};

// ─── Core Focus Areas — derived from the WACB-N questionnaire ────────────────
// The 9 WACB items group into 4 clinical domains; each domain's severity is
// computed from its items' answers rather than hardcoded per domain.

type FocusSeverity = 'high' | 'moderate' | 'mild';

const LEVEL_COLORS: Record<FocusSeverity, { bg: string; text: string }> = {
  moderate: { bg: '#FDECC8', text: '#B45309' },
  high: { bg: '#FCE0E0', text: '#DC2626' },
  mild: { bg: '#D8F3E9', text: '#0F9D6C' },
};

// Raw 1-5 Likert (Never..Very Often) → clinical point weight, same mapping
// the server uses to score submissions (see server/routes/wacb-survey.cjs).
const VALUE_TO_POINTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 7 };
const toPoints = (raw: number | null | undefined): number | null =>
  raw != null ? (VALUE_TO_POINTS[raw] ?? raw) : null;

// A domain is "high" if any item scored 6-7 pts (raw Often/Very Often),
// "moderate" if any item scored 3-5 pts (raw Sometimes), else "mild".
const severityForPoints = (points: Array<number | null>): FocusSeverity => {
  const values = points.filter((p): p is number => p != null);
  if (values.some(p => p >= 6)) return 'high';
  if (values.some(p => p >= 3)) return 'moderate';
  return 'mild';
};

const FOCUS_AREA_GROUPS = [
  { key: 'routines', icon: 'time-outline', iconBg: '#FDECC8', iconColor: '#C2790C', fields: ['q1Dawdle', 'q2MealBehavior'] as const },
  { key: 'emotional', icon: 'flash', iconBg: '#FCE0E0', iconColor: '#DC2626', fields: ['q4Angry', 'q5Scream', 'q6Destroy'] as const },
  { key: 'attention', icon: 'locate-outline', iconBg: '#DBEAFE', iconColor: '#2563EB', fields: ['q3Disobey', 'q8Interrupt', 'q9Attention'] as const },
  { key: 'social', icon: 'people-outline', iconBg: '#D8F3E9', iconColor: '#0F9D6C', fields: ['q7ProvokeFights'] as const },
] as const;

interface FocusAreaData {
  key: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  severity: FocusSeverity;
}

// Carousel order: most severe first (high → moderate → mild). Ties keep the
// clinical group order defined in FOCUS_AREA_GROUPS.
const SEVERITY_RANK: Record<FocusSeverity, number> = { high: 0, moderate: 1, mild: 2 };

const computeFocusAreas = (survey: WacbSurvey): FocusAreaData[] =>
  FOCUS_AREA_GROUPS.map(group => ({
    key: group.key,
    icon: group.icon,
    iconBg: group.iconBg,
    iconColor: group.iconColor,
    severity: severityForPoints(group.fields.map(field => toPoints(survey[field]))),
  })).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

// ─── Personalized Learning Journey — the 9-level parent-skill ladder ──────────
// currentLevel comes from the server (authService.getParentSkillLevel(),
// gated by real session counts — see parentSkillLevelService.cjs). Level
// ordering/keys/icons/skill-tap-through are the shared single source of
// truth in constants/parentSkillLevels.ts (also used by ParentLevelDetailScreen
// and LevelUpModal), rather than a duplicated array local to this screen.
const PARENT_SKILL_LEVELS = PARENT_SKILL_LEVEL_ORDER.map(level => ({
  level,
  key: PARENT_SKILL_LEVEL_KEYS[level],
  icon: PARENT_SKILL_LEVEL_ICONS[level],
  skillKey: PARENT_SKILL_LEVEL_SKILL_LABEL[level],
}));

// The journey is a fixed 4-step arc: always start by filling the emotional
// bank account and always end with calm discipline. The middle two steps are
// picked from the parent's top-2 WACB focus areas (already severity-sorted),
// so the plan reads as built around this child's specific priorities.
const FOCUS_AREA_JOURNEY_STEP: Record<string, string> = {
  emotional: 'coachFeelings',
  attention: 'buildFocus',
  routines: 'smoothTransitions',
  social: 'practiceSharing',
};

/** PDI Coach's Corner — Two Choices Flow skills */
const PDICoachCorner: React.FC<{
  pdiSkills: Array<{ skill: string; performance: string; feedback: string }>;
  commandSequences?: Array<{ title: string; label: string; whatHappened?: string; command: string; waitTime: string; followThrough: string; coachTip?: string }> | null;
  summary?: string | null;
  recordingId: string;
  navigation: any;
  tomorrowGoal?: string | null;
}> = ({ commandSequences, summary, recordingId, navigation, tomorrowGoal }) => {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={styles.cardTitle}>{t('report.section.coachsCorner')}</Text>
      <View style={styles.coachCard}>
        {summary && (
          <Text style={styles.pdiSummaryText}>{summary}</Text>
        )}

        {commandSequences && commandSequences.length > 0 && (
          <>
            <Text style={[styles.pdiSectionSubtitle, { marginTop: 20 }]}>{t('report.pdi.commandSequencesSubtitle')}</Text>
            {commandSequences.map((seq, index) => {
              const labelColors = getLabelColors(seq.label);
              return (
                <View
                  key={index}
                  style={[
                    styles.pdiSeqBlock,
                    index < commandSequences.length - 1 && styles.pdiSkillItemBorder,
                  ]}
                >
                  <View style={styles.pdiSeqHeaderRow}>
                    <Text style={styles.pdiSeqTitle}>{t('report.pdi.sequenceTitle', { index: index + 1, title: seq.title })}</Text>
                    <View style={[styles.pdiSeqLabelBadge, { backgroundColor: labelColors.bg }]}>
                      <Text style={[styles.pdiSeqLabelText, { color: labelColors.text }]}>{seq.label}</Text>
                    </View>
                  </View>
                  {seq.whatHappened && (
                    <Text style={styles.pdiSeqWhatHappened}>{seq.whatHappened}</Text>
                  )}
                  <View style={styles.pdiSeqBullet}>
                    <Text style={styles.pdiSeqBulletText}><Text style={styles.pdiSeqBold}>{t('report.pdi.command')}</Text>{seq.command}</Text>
                  </View>
                  <View style={styles.pdiSeqBullet}>
                    <Text style={styles.pdiSeqBulletText}><Text style={styles.pdiSeqBold}>{t('report.pdi.waitTime')}</Text>{seq.waitTime}</Text>
                  </View>
                  <View style={styles.pdiSeqBullet}>
                    <Text style={styles.pdiSeqBulletText}><Text style={styles.pdiSeqBold}>{t('report.pdi.followThrough')}</Text>{seq.followThrough}</Text>
                  </View>
                  {seq.coachTip && (
                    <View style={styles.pdiSeqBullet}>
                      <Text style={styles.pdiSeqBulletText}><Text style={styles.pdiSeqBold}>{t('report.pdi.coachsTip')}</Text>{seq.coachTip}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {tomorrowGoal && (
          <Text style={styles.coachDescription}><Text style={styles.coachLabelBold}>{t('report.coachingCard.tomorrowsGoal')}</Text>{tomorrowGoal}</Text>
        )}
        <TouchableOpacity
          style={styles.cardLinkButton}
          onPress={() => { amplitudeService.trackEvent('Report Transcript Tapped', { recordingId }); navigation.navigate('Transcript', { recordingId }); }}
        >
          <Text style={styles.cardLinkText}>{t('report.coachingCard.readFullTranscript')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const ProfileReportScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<ProfileReportScreenRouteProp>();
  const { t } = useTranslation();
  const recordingService = useRecordingService();
  const authService = useAuthService();
  const { recordingId, justCompletedWacb } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<RecordingAnalysis | null>(null);
  const [pollingCount, setPollingCount] = useState(0);
  const [childName, setChildName] = useState<string>('Your Child');
  const [childAge, setChildAge] = useState<number | null>(null);
  const [parentSkillLevel, setParentSkillLevel] = useState<ParentSkillLevel>(1);
  const [developmentalVisible, setDevelopmentalVisible] = useState(false);
  const [developmentalProgress, setDevelopmentalProgress] = useState<DevelopmentalProgress | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainType | null>(null);
  const [domainMilestones, setDomainMilestones] = useState<DomainMilestone[] | null>(null);
  const [domainProfiling, setDomainProfiling] = useState<DomainProfiling | null>(null);
  const [domainChildName, setDomainChildName] = useState<string | null>(null);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [loadingDomainMilestones, setLoadingDomainMilestones] = useState(false);

  // null until the WACB survey fetch resolves — an empty array (not null)
  // means "checked, no survey yet", so the section renders as hidden.
  const [focusAreas, setFocusAreas] = useState<FocusAreaData[] | null>(null);

  // Feedback state
  const [feedbackSentiment, setFeedbackSentiment] = useState<'positive' | 'negative' | null>(null);
  const [feedbackReasons, setFeedbackReasons] = useState<string[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showPhaseCelebration, setShowPhaseCelebration] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleSentimentPress = useCallback((sentiment: 'positive' | 'negative') => {
    amplitudeService.trackEvent('Report Feedback Sentiment Selected', { sentiment, recordingId });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFeedbackSentiment(sentiment);

    if (sentiment === 'positive') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();

      recordingService.submitReportFeedback(recordingId, {
        sentiment: 'positive',
        reasons: [],
      }).catch(err => console.log('Feedback submit error:', err));
    }
  }, [shakeAnim, recordingId, recordingService]);

  const toggleReason = useCallback((reason: string) => {
    setFeedbackReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
  }, []);

  const handleSubmitFeedback = useCallback(async () => {
    if (!feedbackSentiment) return;
    amplitudeService.trackEvent('Report Feedback Submitted', { sentiment: feedbackSentiment, reasons: feedbackReasons, recordingId });
    try {
      await recordingService.submitReportFeedback(recordingId, {
        sentiment: feedbackSentiment,
        reasons: feedbackReasons,
        freeText: feedbackText || undefined,
      });
    } catch (err) {
      console.log('Feedback submit error:', err);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFeedbackSubmitted(true);
  }, [feedbackSentiment, feedbackReasons, feedbackText, recordingId, recordingService]);

  useEffect(() => {
    amplitudeService.trackScreenView('Report', { recordingId, version: 'v2' });
    loadReportData();
    loadChildProfile();
    loadDevelopmentalVisibility();
    loadFocusAreas();
    loadParentSkillLevel();
  }, [recordingId]);

  useEffect(() => {
    if (!reportData) return;
    recordingService.getDevelopmentalProgress().then(data => {
      if (data) setDevelopmentalProgress(data);
    }).catch(() => {});
  }, [reportData?.createdAt]);

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

  const loadDevelopmentalVisibility = async () => {
    try {
      const result = await recordingService.getDevelopmentalVisibility();
      setDevelopmentalVisible(result.visible);
    } catch (err) {
      // Keep default false
    }
  };

  const loadFocusAreas = async () => {
    try {
      const survey: WacbSurvey | null = await authService.getLatestWacbSurvey();
      setFocusAreas(survey ? computeFocusAreas(survey) : []);
    } catch (err) {
      setFocusAreas([]);
    }
  };

  const loadParentSkillLevel = async () => {
    try {
      const info = await authService.getParentSkillLevel();
      setParentSkillLevel(info.currentLevel);
    } catch (err) {
      // Keep default level 1 if fetch fails
    }
  };

  const loadChildProfile = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user?.childName) setChildName(user.childName);
      setChildAge(calculateAge(user?.childBirthday));
    } catch (err) {
      // Keep defaults if fetch fails
    }
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await recordingService.getAnalysis(recordingId);
      setReportData(data);
      setLoading(false);

      if ((data.noraScore ?? 0) >= 80) {
        const celebrated = await userStorage.getItem('@discipline_phase_celebrated');
        if (!celebrated) {
          await userStorage.setItem('@discipline_phase_celebrated', 'true');
          setShowPhaseCelebration(true);
        }
      }
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

  const isPDI = reportData?.mode === 'PDI';

  const handleLevelPress = (step: { level: number; key: string; skillKey?: string }) => {
    amplitudeService.trackEvent('Report Journey Level Tapped', { level: step.level, recordingId });
    if (step.skillKey && reportData) {
      const skill = reportData.skills.find(s => s.label === step.skillKey);
      if (skill) {
        navigation.navigate('SkillUtterances', {
          skillKey: step.skillKey,
          recordingId,
          utterances: getUtterancesForSkill(reportData.transcript, step.skillKey),
          target: 10,
        });
        return;
      }
    }
    navigation.navigate('Transcript', { recordingId });
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('profileReport.headerTitle', { childName })}</Text>
            <Text style={styles.headerSubtitle}>{t('profileReport.headerSubtitle')}</Text>
          </View>
          <View style={{ width: 40 }} />
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

  // Error state
  if (error || !reportData) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('profileReport.headerTitle', { childName })}</Text>
            <Text style={styles.headerSubtitle}>{t('profileReport.headerSubtitle')}</Text>
          </View>
          <View style={{ width: 40 }} />
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

  // Mirror the Core Focus Areas carousel: the hero heading is the first card's
  // title (highest-severity, since computeFocusAreas sorts high→moderate→mild).
  // Falls back to the mode-based static heading when the WACB survey isn't done.
  const focusHeading = focusAreas && focusAreas.length > 0
    ? t(`profileReport.focusAreas.${focusAreas[0].key}.label`)
    : (isPDI ? t('profileReport.focusHeadingPDI') : t('profileReport.focusHeadingCDI'));
  // Describe the picked focus area (same first card the heading mirrors); fall
  // back to the session's own feedback/encouragement copy when there's no WACB.
  const focusDescription = focusAreas && focusAreas.length > 0
    ? t(`profileReport.focusAreas.${focusAreas[0].key}.heroDescription`, { childName })
    : (isPDI && reportData.pdiEncouragement)
      ? reportData.pdiEncouragement
      : (reportData.feedback || reportData.encouragement || '');

  // 4-step journey: Fill the Emotional Bank Account → top-2 focus-area steps → Calm Discipline.
  const journeyMiddleStepKeys = (focusAreas ?? [])
    .map(a => FOCUS_AREA_JOURNEY_STEP[a.key])
    .filter((k, i, arr): k is string => !!k && arr.indexOf(k) === i)
    .slice(0, 2);
  const journeyStepKeys = ['fillBank', ...journeyMiddleStepKeys, 'calmDiscipline'];
  const journeyDisciplineWhyKey = focusAreas && focusAreas.length > 0 ? focusAreas[0].key : null;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('profileReport.headerTitle', { childName })}</Text>
          <Text style={styles.headerSubtitle}>{t('profileReport.headerSubtitle')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Thanks-for-answering banner — only right after finishing the WACB survey */}
        {justCompletedWacb && (
          <View style={styles.thanksBanner}>
            <Image source={PROFILE_REPORT_THANKS_DRAGON} style={styles.thanksBannerDragon} resizeMode="contain" />
            <View style={styles.thanksBannerText}>
              <Text style={styles.thanksBannerTitle}>{t('profileReport.thanksBannerTitle')}</Text>
              <Text style={styles.thanksBannerBody}>{t('profileReport.thanksBannerBody', { childName })}</Text>
              <View style={styles.thanksBannerBadge}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.mainPurple} />
                <Text style={styles.thanksBannerBadgeText}>{t('profileReport.thanksBannerBadge')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Hero — child + primary focus */}
        {/* <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroDragonCircle}>
              <Image source={PROFILE_REPORT_CHILD} style={styles.heroDragonImage} resizeMode="cover" />
            </View>
            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName}>{childName}</Text>
                {childAge != null && <Text style={styles.heroAge}>{t('profileReport.ageLabel', { age: childAge })}</Text>}
              </View>
              <View style={styles.heroPrimaryFocusRow}>
                <Ionicons name="heart" size={13} color={COLORS.mainPurple} />
                <Text style={styles.heroPrimaryFocusLabel}>{t('profileReport.primaryFocusLabel')}</Text>
              </View>
              <Text style={styles.heroFocusHeading}>{focusHeading}</Text>
            </View>
          </View>
          {!!focusDescription && (
            <Text style={styles.heroDescription}>{focusDescription}</Text>
          )}
        </View> */}

        {/* Core Focus Areas — derived from the WACB questionnaire; hidden until completed */}
        {!!focusAreas?.length && (
          <View style={styles.focusAreasSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('profileReport.coreFocusAreasTitle', { childName })}</Text>
              <View style={styles.fromIntakeRow}>
                <Text style={styles.fromIntakeText}>{t('profileReport.fromYourIntake')}</Text>
                <Ionicons name="information-circle-outline" size={15} color="#9CA3AF" />
              </View>
            </View>
            <Text style={styles.sectionSubtitleTight}>{t('profileReport.coreFocusAreasSubtitle', { childName })}</Text>
            <View style={styles.focusAreaList}>
              {focusAreas.map(area => {
                const levelColors = LEVEL_COLORS[area.severity];
                return (
                  <View key={area.key} style={styles.focusAreaRow}>
                    <View style={[styles.focusAreaIconCircle, { backgroundColor: area.iconBg }]}>
                      <Ionicons name={area.icon as any} size={20} color={area.iconColor} />
                    </View>
                    <View style={styles.focusAreaRowText}>
                      <View style={styles.focusAreaRowTitleLine}>
                        <Text style={styles.focusAreaLabel}>{t(`profileReport.focusAreas.${area.key}.label`)}</Text>
                        <View style={[styles.focusAreaLevelBadge, { backgroundColor: levelColors.bg }]}>
                          <Text style={[styles.focusAreaLevelText, { color: levelColors.text }]}>{t(`profileReport.severity.${area.severity}`)}</Text>
                        </View>
                      </View>
                      <Text style={styles.focusAreaFocusText}>{t(`profileReport.focusAreas.${area.key}.focus`)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Why we're starting here — explains why the roadmap targets this focus area */}
        {/* {focusAreas && focusAreas.length > 0 && (
          <View style={styles.whyHereCard}>
            <View style={styles.whyHereHeaderRow}>
              <View style={styles.whyHereIconCircle}>
                <Ionicons name="bulb" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.whyHereTitle}>{t('profileReport.whyHereTitle')}</Text>
              <Image source={REPORT_DETAIL_DRAGON} style={styles.whyHereDragon} resizeMode="contain" />
            </View>
            <Text style={styles.whyHereBody}>
              {t('profileReport.whyHereBody1Prefix')}
              <Text style={styles.whyHereBodyBold}>{focusHeading}</Text>
              {t('profileReport.whyHereBody1Suffix')}
            </Text>
            <Text style={[styles.whyHereBody, styles.whyHereBodyLast]}>{t('profileReport.whyHereBody2')}</Text>
          </View>
        )} */}

        {/* Personalized Learning Journey — fixed 4-step arc, middle steps driven by focus-area priority */}
        {focusAreas && focusAreas.length > 0 && (
          <View style={styles.journeySection}>
            <Text style={styles.cardTitle}>{t('profileReport.journeyTitle')}</Text>
            <Text style={styles.sectionSubtitle}>
              {t('profileReport.whyHereBody1Prefix')}
              <Text style={styles.sectionSubtitleBold}>{focusHeading}</Text>
              {t('profileReport.whyHereBody1Suffix')}{' '}
              {t('profileReport.journeySubtitle', { childName })}
            </Text>
            <View style={styles.journeyCard}>
              <View style={styles.journeyRoadmap}>
                {journeyStepKeys.map((stepKey, index) => {
                  const isFirst = index === 0;
                  const isLast = index === journeyStepKeys.length - 1;
                  return (
                    <View key={stepKey} style={styles.journeyRoadmapRow}>
                      <View style={styles.journeyStepIndicatorCol}>
                        <View style={styles.journeyStepNumberCircle}>
                          <Text style={styles.journeyStepNumberText}>{index + 1}</Text>
                        </View>
                        {!isLast && <View style={styles.journeyStepLine} />}
                      </View>
                      <View style={styles.journeyRoadmapTextCol}>
                        <View style={styles.journeyStepTitleRow}>
                          <Text style={styles.journeyStepTitle}>{t(`profileReport.journeySteps.${stepKey}.title`)}</Text>
                          {isFirst && (
                            <View style={styles.journeyStartBadge}>
                              <Text style={styles.journeyStartBadgeText}>{t('profileReport.journeyStartBadge')}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.journeyStepBody}>{t(`profileReport.journeySteps.${stepKey}.body`, { childName })}</Text>
                        {isLast && journeyDisciplineWhyKey && (
                          <View style={styles.journeyWhyBox}>
                            <Ionicons name="sparkles" size={13} color={COLORS.mainPurple} />
                            <Text style={styles.journeyWhyText}>{t(`profileReport.journeyDisciplineWhy.${journeyDisciplineWhyKey}`, { childName })}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
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
    paddingTop: 20,
    paddingBottom: 100,
  },

  // ── Thanks-for-answering banner ──
  thanksBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  thanksBannerDragon: {
    width: 124,
    height: 124,
    flexShrink: 0,
    marginLeft: -8,
  },
  thanksBannerText: {
    flex: 1,
  },
  thanksBannerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.mainPurple,
    marginBottom: 6,
  },
  thanksBannerBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  thanksBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#EDE7F6',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  thanksBannerBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.mainPurple,
  },

  // ── Hero card ──
  heroCard: {
    backgroundColor: '#F5F0FF',
    borderRadius: 28,
    padding: 20,
    marginBottom: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  heroDragonCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDragonImage: {
    width: '100%',
    height: '100%',
  },
  heroInfo: {
    flex: 1,
    paddingTop: 2,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6,
  },
  heroName: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textDark,
  },
  heroAge: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
  },
  heroPrimaryFocusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  heroPrimaryFocusLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.mainPurple,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroFocusHeading: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textDark,
    lineHeight: 23,
  },
  heroDescription: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    marginTop: 14,
  },

  // ── Core Focus Areas ──
  focusAreasSection: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionSubtitleTight: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 19,
    color: '#6B7280',
    marginBottom: 14,
  },
  fromIntakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fromIntakeText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#9CA3AF',
  },
  focusAreaList: {
    gap: 10,
  },
  focusAreaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  focusAreaRowText: {
    flex: 1,
  },
  focusAreaRowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  focusAreaIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusAreaLabel: {
    flexShrink: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 20,
  },
  focusAreaLevelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  focusAreaLevelText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  focusAreaFocusText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 19,
    color: '#9CA3AF',
  },

  // ── Why we're starting here ──
  whyHereCard: {
    backgroundColor: '#F5F0FF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 24,
  },
  whyHereHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  whyHereIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.mainPurple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whyHereTitle: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.mainPurple,
  },
  whyHereDragon: {
    width: 64,
    height: 64,
  },
  whyHereBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textDark,
    marginBottom: 10,
  },
  whyHereBodyLast: {
    marginBottom: 0,
  },
  whyHereBodyBold: {
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
  },

  // ── Personalized Learning Journey ──
  journeySection: {
    marginBottom: 24,
  },
  journeyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  journeyRoadmap: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 4,
  },
  journeyRoadmapRow: {
    flexDirection: 'row',
  },
  journeyStepIndicatorCol: {
    width: 32,
    alignItems: 'center',
  },
  journeyStepNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.mainPurple,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  journeyStepNumberText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  journeyStepLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
    minHeight: 16,
  },
  journeyRoadmapTextCol: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 20,
  },
  journeyStepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 3,
  },
  journeyStepTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textDark,
  },
  journeyStartBadge: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  journeyStartBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  journeyStepBody: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },
  journeyWhyBox: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#F5F0FF',
    borderRadius: 12,
    padding: 10,
  },
  journeyWhyText: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textDark,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textDark,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  scoreSection: {
    marginBottom: 24,
  },
  skillsSection: {
    marginBottom: 24,
  },
  avoidSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  skillRatingBadge: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 19,
    color: '#6B7280',
    marginBottom: 16,
  },
  sectionSubtitleBold: {
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
  },
  skillsContainer: {
    gap: 4,
  },
  echoFootnote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    marginTop: 8,
  },
  avoidContainer: {
    gap: 16,
  },
  avoidItem: {
    gap: 8,
  },
  avoidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avoidLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
  },
  avoidRightContainer: {
    alignItems: 'flex-start',
    gap: 4,
  },
  circlesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: 180,
    alignSelf: 'flex-start',
  },
  circle: {
    width: 18,
    height: 18,
    borderRadius: 18,
    backgroundColor: '#852221',
  },
  circleAttention: {
    backgroundColor: '#852221',
  },
  quoteText: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textDark,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Coach's Corner styles
  coachCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  coachDescription: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 4,
    marginTop: 12,
  },
  coachLabelBold: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#4B5563',
  },
  coachExampleContainer: {
    marginTop: 12,
    borderRadius: 12,
    padding: 0,
  },
  coachInsteadOfRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  coachExampleInsteadOf: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
    lineHeight: 20,
    marginBottom: 6,
  },
  coachExampleInsteadOfLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#4B5563',
  },
  coachExampleImproved: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#16A34A',
    lineHeight: 20,
    marginLeft: 24,
  },
  coachExampleImprovedLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#16A34A',
  },
  cardLinkButton: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 16,
    marginHorizontal: -20,
    paddingTop: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  cardLinkText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#0059DB',
  },
  // About Child section styles
  learnSubsectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  aboutChildTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
  },
  aboutChildTitleText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#7C3AED',
  },
  aboutChildDescription: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 24,
    marginBottom: 4,
  },
  aboutChildDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 14,
  },
  aboutChildDetails: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  // Milestone Celebration styles
  milestonePersonalizedText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 24,
    flex: 1,
  },
  milestoneEvidenceSummary: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 20,
  },
  milestoneActionTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 8,
    paddingTop: 12,
    borderTopColor: '#E5E7EB',
  },
  milestoneActionTipText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
    lineHeight: 20,
  },
  milestoneLockedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  milestoneLockedTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#1E2939',
    marginBottom: 8,
  },
  milestoneLockedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F0FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  milestoneLockedBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#8C49D5',
  },
  milestoneLockedDesc: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
  },
  // Feedback widget styles
  feedbackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 20,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  feedbackTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  feedbackSentimentRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  feedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
  },
  feedbackPillPositiveActive: {
    backgroundColor: '#6750A4',
    borderColor: '#6750A4',
  },
  feedbackPillNegative: {
    borderColor: '#9CA3AF',
  },
  feedbackPillNegativeActive: {
    backgroundColor: '#852221',
    borderColor: '#852221',
  },
  feedbackPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },
  feedbackPillTextNegative: {
    color: '#9CA3AF',
  },
  feedbackPillTextActive: {
    color: '#FFFFFF',
  },
  feedbackFollowUp: {
    marginTop: 20,
  },
  feedbackFollowUpLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  feedbackChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  feedbackChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  feedbackChipActiveNegative: {
    borderColor: '#852221',
    backgroundColor: '#FEF2F2',
  },
  feedbackChipText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
  },
  feedbackChipTextActive: {
    color: COLORS.textDark,
    fontFamily: FONTS.semiBold,
  },
  feedbackInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
    minHeight: 60,
    marginBottom: 16,
  },
  feedbackSubmitButton: {
    backgroundColor: '#6750A4',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  feedbackSubmitText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  feedbackThankYou: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  feedbackThankYouText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#10B981',
  },
  // PDI Two Choices Flow styles
  pdiSummaryText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 16,
  },
  pdiSectionSubtitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 12,
  },
  pdiSkillItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pdiSeqBlock: {
    paddingVertical: 14,
  },
  pdiSeqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pdiSeqTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textDark,
    flex: 1,
  },
  pdiSeqLabelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pdiSeqLabelText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  pdiSeqBullet: {
    flexDirection: 'row',
    paddingLeft: 4,
    marginBottom: 6,
  },
  pdiSeqBulletText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
    flex: 1,
  },
  pdiSeqBold: {
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
  },
  pdiSeqWhatHappened: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginBottom: 10,
    fontStyle: 'italic',
  },
});
