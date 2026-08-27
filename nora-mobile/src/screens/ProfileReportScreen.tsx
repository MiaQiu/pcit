/**
 * ProfileReportScreen
 * Child hero card, core focus areas, and personalized learning journey,
 * followed by the existing session score/skills/coaching sections.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, TextInput, LayoutAnimation, Platform, UIManager, Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SkillProgressBar } from '../components/SkillProgressBar';
import { Button } from '../components/Button';
import { COLORS, FONTS, DRAGON_PURPLE } from '../constants/assets';
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

type ProfileReportScreenRouteProp = RouteProp<RootStackParamList, 'Report'>;

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

const computeFocusAreas = (survey: WacbSurvey): FocusAreaData[] =>
  FOCUS_AREA_GROUPS.map(group => ({
    key: group.key,
    icon: group.icon,
    iconBg: group.iconBg,
    iconColor: group.iconColor,
    severity: severityForPoints(group.fields.map(field => toPoints(survey[field]))),
  }));

const FOCUS_CARD_WIDTH = 156;
const FOCUS_CARD_GAP = 12;

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
  const { recordingId } = route.params;

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

  // Focus areas carousel pagination
  const [activeFocusIndex, setActiveFocusIndex] = useState(0);
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

  const handleFocusScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / (FOCUS_CARD_WIDTH + FOCUS_CARD_GAP));
    setActiveFocusIndex(Math.max(0, Math.min((focusAreas?.length ?? 1) - 1, idx)));
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
          <Text style={styles.headerTitle}>{t('report.headerTitle')}</Text>
          <View style={{ width: 28 }} />
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
          <Text style={styles.headerTitle}>{t('report.headerTitle')}</Text>
          <View style={{ width: 28 }} />
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

  const focusHeading = isPDI ? t('profileReport.focusHeadingPDI') : t('profileReport.focusHeadingCDI');
  const focusDescription = (isPDI && reportData.pdiEncouragement)
    ? reportData.pdiEncouragement
    : (reportData.feedback || reportData.encouragement || '');

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('report.headerTitle')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — child + primary focus */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroDragonCircle}>
              <Image source={DRAGON_PURPLE} style={styles.heroDragonImage} resizeMode="contain" />
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
        </View>

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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleFocusScrollEnd}
              snapToInterval={FOCUS_CARD_WIDTH + FOCUS_CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={styles.focusAreasScrollContent}
            >
              {focusAreas.map(area => {
                const levelColors = LEVEL_COLORS[area.severity];
                return (
                  <View key={area.key} style={styles.focusAreaCard}>
                    <View style={[styles.focusAreaIconCircle, { backgroundColor: area.iconBg }]}>
                      <Ionicons name={area.icon as any} size={20} color={area.iconColor} />
                    </View>
                    <Text style={styles.focusAreaLabel}>{t(`profileReport.focusAreas.${area.key}.label`)}</Text>
                    <View style={[styles.focusAreaLevelBadge, { backgroundColor: levelColors.bg }]}>
                      <Text style={[styles.focusAreaLevelText, { color: levelColors.text }]}>{t(`profileReport.severity.${area.severity}`)}</Text>
                    </View>
                    <Text style={styles.focusAreaFocusText}>{t(`profileReport.focusAreas.${area.key}.focus`)}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.focusAreasDots}>
              {focusAreas.map((area, i) => (
                <View key={area.key} style={[styles.focusAreaDot, i === activeFocusIndex && styles.focusAreaDotActive]} />
              ))}
            </View>
          </View>
        )}

        {/* Personalized Learning Journey — 9-level parent skill ladder */}
        <View style={styles.journeySection}>
          <Text style={styles.cardTitle}>{t('profileReport.journeyTitle')}</Text>
          <Text style={styles.sectionSubtitle}>{t('profileReport.journeySubtitle')}</Text>
          <View style={styles.journeyCard}>
            {(() => {
              const activeStep = PARENT_SKILL_LEVELS.find(s => s.level === parentSkillLevel) ?? PARENT_SKILL_LEVELS[0];
              return (
                <TouchableOpacity
                  style={styles.journeyActiveCard}
                  activeOpacity={0.85}
                  onPress={() => handleLevelPress(activeStep)}
                >
                  <View style={styles.journeyActiveHeaderRow}>
                    <View style={styles.journeyLevelBadge}>
                      <Text style={styles.journeyLevelBadgeText}>{t('profileReport.journeyLevelBadge', { level: activeStep.level })}</Text>
                    </View>
                    <Ionicons name={activeStep.icon as any} size={20} color={COLORS.mainPurple} />
                  </View>
                  <Text style={styles.journeyActiveTitle}>{t(`profileReport.levels.${activeStep.key}.title`)}</Text>
                  <Text style={styles.journeyActiveSkill}>{t(`profileReport.levels.${activeStep.key}.skill`)}</Text>
                  <Text style={styles.journeyActiveGoal}>
                    <Text style={styles.journeyActiveGoalLabel}>{t('profileReport.journeyGoalLabel')}</Text>
                    {t(`profileReport.levels.${activeStep.key}.goal`)}
                  </Text>
                  <Text style={styles.journeyActiveLearn}>{t(`profileReport.levels.${activeStep.key}.learn`)}</Text>
                </TouchableOpacity>
              );
            })()}

            <View style={styles.journeyRoadmap}>
              {PARENT_SKILL_LEVELS.map((step, index) => {
                const status = step.level < parentSkillLevel ? 'done' : step.level === parentSkillLevel ? 'active' : 'locked';
                return (
                  <View key={step.key} style={styles.journeyRoadmapRow}>
                    <View style={styles.journeyStepIndicatorCol}>
                      <View style={[
                        styles.journeyStepNumberCircle,
                        status === 'done' && styles.journeyStepNumberCircleDone,
                        status === 'locked' && styles.journeyStepNumberCircleLocked,
                      ]}>
                        {status === 'done' ? (
                          <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                        ) : status === 'locked' ? (
                          <Ionicons name="lock-closed" size={11} color="#9CA3AF" />
                        ) : (
                          <Text style={styles.journeyStepNumberText}>{step.level}</Text>
                        )}
                      </View>
                      {index < PARENT_SKILL_LEVELS.length - 1 && <View style={styles.journeyStepLine} />}
                    </View>
                    <View style={styles.journeyRoadmapTextCol}>
                      <Text style={[styles.journeyRoadmapTitle, status === 'locked' && styles.journeyRoadmapTitleLocked]}>
                        {t(`profileReport.levels.${step.key}.title`)}
                      </Text>
                      <Text style={styles.journeyRoadmapSkill}>{t(`profileReport.levels.${step.key}.skill`)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Nora Score */}
        <View style={styles.scoreSection}>
          <Text style={styles.sectionTitle}>{t('report.section.emotionalBankAccount')}</Text>
          <View style={styles.skillsContainer}>
            {(() => {
              const score = reportData.noraScore ?? 0;
              let scoreColor: string;
              let suffix: string;
              if (score < 80) {
                scoreColor = '#852221';
                suffix = t('report.skillRating.payAttention');
              } else if (score < 90) {
                scoreColor = '#6750A4';
                suffix = t('report.skillRating.good');
              } else {
                scoreColor = '#6750A4';
                suffix = t('report.skillRating.excellent');
              }
              return (
                <SkillProgressBar
                  label={t('report.overallLabel')}
                  progress={score}
                  maxValue={100}
                  color={scoreColor}
                  textColor={scoreColor}
                  prefix="+"
                  suffix={suffix}
                  onPress={() => { amplitudeService.trackEvent('Report Overall Score Tapped', { score }); navigation.navigate('SkillExplanation', { skillKey: 'Overall', score, tip: reportData.tip ?? undefined }); }}
                />
              );
            })()}
          </View>
        </View>

        {/* PRN Skills Section */}
        <View style={styles.skillsSection}>
          <Text style={styles.sectionTitle}>{t('report.section.penSkills')}</Text>
          <Text style={styles.sectionSubtitle}>{t('report.section.penSkillsSubtitle')}</Text>
          <View style={styles.skillsContainer}>
            {(() => {
              const childUtteranceCount = reportData.transcript
                ? reportData.transcript.filter(u => u.role === 'child').length
                : 0;
              const echoTarget = childUtteranceCount < 10
                ? Math.round(childUtteranceCount * 0.75)
                : 10;
              return reportData.skills.map((skill, index) => {
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
                    onPress={() => { amplitudeService.trackEvent('Report Skill Tapped', { skillKey: skill.label, progress: skill.progress }); navigation.navigate('SkillUtterances', { skillKey: skill.label, recordingId, utterances: getUtterancesForSkill(reportData.transcript, skill.label), target: maxValue, childUtteranceCount }); }}
                  />
                );
              });
            })()}
          </View>
          {(() => {
            const childUtteranceCount = reportData.transcript
              ? reportData.transcript.filter(u => u.role === 'child').length
              : 0;
            if (childUtteranceCount >= 10) return null;
            const echoSkill = reportData.skills.find(s => s.label === 'Echo');
            if (!echoSkill) return null;
            const echoTarget = Math.round(childUtteranceCount * 0.75);
            return (
              <Text style={styles.echoFootnote}>
                {`* ${t('skillInfo.echoGoalDynamic' as any, { count: childUtteranceCount, target: echoTarget })}`}
              </Text>
            );
          })()}
        </View>

        {/* Areas to Avoid */}
        <View style={styles.avoidSection}>
          {(() => {
            const filteredAreas = reportData.areasToAvoid
              .filter(area => !(reportData.mode === 'PDI' && (typeof area === 'string' ? area : area.label) === 'Commands'));
            const avoidTotal = filteredAreas.reduce((s: number, a: any) => s + (typeof a === 'string' ? 0 : (a.count || 0)), 0);
            let avoidRatingSuffix: string;
            let avoidRatingColor: string;
            if (avoidTotal > 3) {
              avoidRatingSuffix = t('report.skillRating.payAttention');
              avoidRatingColor = '#852221';
            } else if (avoidTotal === 0) {
              avoidRatingSuffix = t('report.skillRating.excellent');
              avoidRatingColor = '#6750A4';
            } else {
              avoidRatingSuffix = t('report.skillRating.good');
              avoidRatingColor = '#6750A4';
            }
            return (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('report.section.areasToAvoid')}</Text>
                  <Text style={[styles.skillRatingBadge, { color: avoidRatingColor }]}>{avoidTotal} {avoidRatingSuffix}</Text>
                </View>
                <Text style={styles.sectionSubtitle}>{t('report.section.areasToAvoidSubtitle')}</Text>
                <View style={styles.avoidContainer}>
                  {filteredAreas.map((area, index) => {
                    const areaData = typeof area === 'string' ? { label: area, count: 0 } : area;
                    const needsAttention = areaData.count > 0;
                    return (
                      <View key={index} style={styles.avoidItem}>
                        <View style={styles.avoidRow}>
                          <Text style={styles.avoidLabel}>{getSkillDisplayLabel(areaData.label, t)}</Text>
                          <TouchableOpacity
                            style={styles.avoidRightContainer}
                            onPress={() => { amplitudeService.trackEvent('Report Area Avoided Tapped', { skillKey: areaData.label, count: areaData.count }); navigation.navigate('SkillUtterances', { skillKey: areaData.label, recordingId, utterances: getUtterancesForSkill(reportData.transcript, areaData.label) }); }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="chevron-forward" size={12} color={needsAttention ? '#852221' : '#6750A4'} />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.circlesContainer}>
                          {Array.from({ length: areaData.count }).map((_, i) => (
                            <View key={i} style={[styles.circle, needsAttention && styles.circleAttention]} />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            );
          })()}
        </View>

        {/* Top Moment */}
        <View>
          <Text style={styles.cardTitle}>{t('report.section.topMoment')}</Text>
          <View style={styles.card}>
            <Text style={styles.quoteText}>
              "{reportData.topMomentUtteranceNumber != null && reportData.transcript?.[reportData.topMomentUtteranceNumber]
                ? stripPcitTags(reportData.transcript[reportData.topMomentUtteranceNumber].text)
                : stripPcitTags(typeof reportData.topMoment === 'string' ? reportData.topMoment : reportData.topMoment.quote)}"
            </Text>
            {reportData.audioUrl && reportData.topMomentStartTime != null && reportData.topMomentEndTime != null && (
              <MomentPlayer
                audioUrl={reportData.audioUrl}
                startTime={reportData.topMomentStartTime}
                endTime={reportData.topMomentEndTime}
              />
            )}
          </View>
        </View>

        {/* Coach's Corner */}
        {reportData.mode === 'PDI' && reportData.pdiSkills && Array.isArray(reportData.pdiSkills) && reportData.pdiSkills.length > 0 ? (
          <PDICoachCorner pdiSkills={reportData.pdiSkills} commandSequences={reportData.pdiCommandSequences} summary={reportData.pdiSummary} recordingId={recordingId} navigation={navigation} tomorrowGoal={reportData.pdiTomorrowGoal} />
        ) : (
          !reportData.coachingCards && reportData.coachingSummary ? (
            <View>
              <Text style={styles.cardTitle}>{t('report.section.coachsCorner')}</Text>
              <View style={styles.coachCard}>
                <Text style={styles.coachDescription}>{reportData.coachingSummary}</Text>
                <TouchableOpacity
                  style={styles.cardLinkButton}
                  onPress={() => { amplitudeService.trackEvent('Report Transcript Tapped', { recordingId }); navigation.navigate('Transcript', { recordingId }); }}
                >
                  <Text style={styles.cardLinkText}>{t('report.coachingCard.readFullTranscript')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : reportData.coachingCards && Array.isArray(reportData.coachingCards) && reportData.coachingCards.length > 0 && (() => {
            const items = reportData.coachingCards;
            const isNewFormat = items.length > 0 && 'content' in items[0];

            if (isNewFormat) {
              const sections = items as CoachingSection[];
              const tomorrowGoalText = reportData.tomorrowGoal;
              return (
                <View>
                  <Text style={styles.cardTitle}>{t('report.section.coachsCorner')}</Text>
                  <View style={styles.coachCard}>
                    {sections.map((section, idx) => (
                      <View key={idx} style={idx > 0 ? { marginTop: 16 } : undefined}>
                        <Text style={styles.coachLabelBold}>{section.title}</Text>
                        <MarkdownText style={styles.coachDescription}>{section.content}</MarkdownText>
                      </View>
                    ))}
                    {tomorrowGoalText && (
                      <Text style={styles.coachDescription}><Text style={styles.coachLabelBold}>{t('report.coachingCard.tomorrowsGoal')}</Text>{tomorrowGoalText}</Text>
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
            }

            // Legacy CoachingCard format
            const cards = (items as CoachingCard[]).slice(0, 1);
            const legacyTomorrowGoal = reportData.tomorrowGoal || (cards[0]?.next_day_goal ?? null);
            return (
              <View>
                <Text style={styles.cardTitle}>{t('report.section.coachsCorner')}</Text>
                {cards.map((card) => (
                    <View key={card.card_id} style={styles.coachCard}>
                      {reportData.coachingSummary ? (
                        <Text style={styles.coachDescription}><Text style={styles.coachLabelBold}>{t('report.coachingCard.summary')}</Text>{reportData.coachingSummary}</Text>
                      ) : null}
                      {card.coaching_tip ? (
                        <Text style={styles.coachDescription}><Text style={styles.coachLabelBold}>{t('report.coachingCard.tipForNextSession')}</Text>{card.coaching_tip}</Text>
                      ) : null}
                      {card.scenario && (
                        <View style={styles.coachExampleContainer}>
                          {card.scenario.instead_of ? (
                            <View style={styles.coachInsteadOfRow}>
                              <Ionicons name="bulb-outline" size={16} color="#6B7280" />
                              <Text style={styles.coachExampleInsteadOf}><Text style={styles.coachExampleInsteadOfLabel}>{t('report.coachingCard.insteadOf')}</Text>{card.scenario.instead_of}</Text>
                            </View>
                          ) : null}
                          {card.scenario.try_this ? (
                            <Text style={styles.coachExampleImproved}><Text style={styles.coachExampleImprovedLabel}>{t('report.coachingCard.try')}</Text>{card.scenario.try_this}</Text>
                          ) : null}
                        </View>
                      )}
                      {card.apply_in_daily_life ? (
                        <Text style={styles.coachDescription}><Text style={styles.coachLabelBold}>{t('report.coachingCard.applyInDailyLife')}</Text>{card.apply_in_daily_life}</Text>
                      ) : null}
                      {legacyTomorrowGoal && (
                        <Text style={styles.coachDescription}><Text style={styles.coachLabelBold}>{t('report.coachingCard.tomorrowsGoal')}</Text>{legacyTomorrowGoal}</Text>
                      )}
                      <TouchableOpacity
                        style={styles.cardLinkButton}
                        onPress={() => { amplitudeService.trackEvent('Report Transcript Tapped', { recordingId }); navigation.navigate('Transcript', { recordingId }); }}
                      >
                        <Text style={styles.cardLinkText}>{t('report.coachingCard.readFullTranscript')}</Text>
                      </TouchableOpacity>
                    </View>
                ))}
              </View>
            );
          })()
        )
        }

        {/* What we learnt about Child */}
        {((reportData.aboutChild && reportData.aboutChild.length > 0) || (reportData.milestoneCelebrations && Array.isArray(reportData.milestoneCelebrations) && reportData.milestoneCelebrations.length > 0)) && (() => {
          // Server-persisted selection (dedup'd + ratio-balanced — see
          // aboutChildSelectionService.cjs); falls back to a random pick only
          // for older sessions predating selection, so the card stays stable
          // across re-renders instead of re-randomizing on every one.
          const item = reportData.selectedAboutChild
            || (reportData.aboutChild && reportData.aboutChild.length > 0 ? reportData.aboutChild![Math.floor(Math.random() * reportData.aboutChild.length)] : null);
          const milestones = reportData.milestoneCelebrations && Array.isArray(reportData.milestoneCelebrations)
            ? (reportData.milestoneCelebrations as MilestoneCelebration[]).slice(0, 1)
            : [];

          return (
            <View>
              <Text style={styles.cardTitle}>{t('report.section.whatWeLearnt', { childName })}</Text>
              <View style={styles.card}>
                {item && (
                  <View>
                    <Text style={styles.learnSubsectionLabel}>{t('report.subsection.observation')}</Text>
                    <View style={styles.aboutChildTitleBadge}>
                      <Ionicons name="sparkles" size={14} color="#7C3AED" />
                      <Text style={styles.aboutChildTitleText}>{item.Title}</Text>
                    </View>
                    <Text style={styles.aboutChildDescription}>{item.Description}</Text>
                    {item.Details ? (
                      <Text style={styles.aboutChildDetails}>{item.Details}</Text>
                    ) : null}
                  </View>
                )}

                {milestones.map((milestone, index) => {
                  const isAchieved = milestone.status === 'ACHIEVED';
                  const personalizedDescription = isAchieved
                    ? t('report.milestone.achieved', { childName, title: milestone.title.toLowerCase() })
                    : t('report.milestone.emerging', { childName, title: milestone.title.toLowerCase() });

                  return (
                    <View key={index}>
                      {item && <View style={styles.aboutChildDivider} />}
                      <Text style={styles.learnSubsectionLabel}>{t('report.subsection.newMilestone', { category: milestone.category })}</Text>
                      <Text style={styles.milestonePersonalizedText}>{personalizedDescription}</Text>
                      {milestone.evidenceSummary && !milestone.evidenceSummary.toLowerCase().startsWith('not observed') && (
                        <Text style={styles.milestoneEvidenceSummary}>"{milestone.evidenceSummary}"</Text>
                      )}
                      {milestone.actionTip && (
                        <View style={styles.milestoneActionTip}>
                          <Ionicons name="bulb-outline" size={16} color="#6B7280" />
                          <Text style={styles.milestoneActionTipText}>{milestone.actionTip}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* Developmental Milestones */}
        {developmentalProgress && developmentalProgress.completedSessionCount >= 5 ? (
          <View>
            <Text style={styles.cardTitle}>{developmentalProgress.childName ? t('report.section.developmentalMilestonesWithName', { childName: developmentalProgress.childName }) : t('report.section.developmentalMilestones')}</Text>
            <RadarChart
              data={developmentalProgress}
              childName={developmentalProgress.childName}
              onDomainPress={handleDomainPress}
              showTitle={false}
            />
          </View>
        ) : (
          <View style={styles.milestoneLockedCard}>
            <Text style={styles.milestoneLockedTitle}>{t('report.section.developmentalMilestones')}</Text>
            <View style={styles.milestoneLockedBadge}>
              <Text style={styles.milestoneLockedBadgeText}>{t('report.milestone.lockedBadge', { count: developmentalProgress?.completedSessionCount ?? 0 })}</Text>
            </View>
            <Text style={styles.milestoneLockedDesc}>
              {t('report.milestone.lockedDescription')}
            </Text>
          </View>
        )}

        {/* Report Feedback */}
        {feedbackSubmitted ? (
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackThankYou}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.feedbackThankYouText}>{t('report.feedback.thankYou')}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>{t('report.feedback.question')}</Text>

            <View style={styles.feedbackSentimentRow}>
              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <TouchableOpacity
                  style={[
                    styles.feedbackPill,
                    styles.feedbackPillNegative,
                    feedbackSentiment === 'positive' && styles.feedbackPillPositiveActive,
                  ]}
                  onPress={() => handleSentimentPress('positive')}
                >
                  <Ionicons
                    name={feedbackSentiment === 'positive' ? 'thumbs-up' : 'thumbs-up-outline'}
                    size={18}
                    color={feedbackSentiment === 'positive' ? '#FFFFFF' : '#9CA3AF'}
                  />
                  <Text style={[
                    styles.feedbackPillText,
                    styles.feedbackPillTextNegative,
                    feedbackSentiment === 'positive' && styles.feedbackPillTextActive,
                  ]}>{t('report.feedbackYes')}</Text>
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                style={[
                  styles.feedbackPill,
                  styles.feedbackPillNegative,
                  feedbackSentiment === 'negative' && styles.feedbackPillNegativeActive,
                ]}
                onPress={() => handleSentimentPress('negative')}
              >
                <Ionicons
                  name={feedbackSentiment === 'negative' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={18}
                  color={feedbackSentiment === 'negative' ? '#FFFFFF' : '#9CA3AF'}
                />
                <Text style={[
                  styles.feedbackPillText,
                  styles.feedbackPillTextNegative,
                  feedbackSentiment === 'negative' && styles.feedbackPillTextActive,
                ]}>{t('report.feedbackNotReally')}</Text>
              </TouchableOpacity>
            </View>

            {feedbackSentiment === 'negative' && (
              <View style={styles.feedbackFollowUp}>
                <Text style={styles.feedbackFollowUpLabel}>{t('report.feedbackWhatBetter')}</Text>

                <View style={styles.feedbackChipsRow}>
                  {NEGATIVE_REASONS.map(reason => {
                    const reasonKeyMap: Record<string, string> = {
                      'Too generic': t('report.negativeReasons.tooGeneric'),
                      'Not accurate': t('report.negativeReasons.notAccurate'),
                      'Hard to understand': t('report.negativeReasons.hardToUnderstand'),
                      'Missing something': t('report.negativeReasons.missingSomething'),
                    };
                    return (
                      <TouchableOpacity
                        key={reason}
                        style={[
                          styles.feedbackChip,
                          feedbackReasons.includes(reason) && styles.feedbackChipActiveNegative,
                        ]}
                        onPress={() => toggleReason(reason)}
                      >
                        <Text style={[
                          styles.feedbackChipText,
                          feedbackReasons.includes(reason) && styles.feedbackChipTextActive,
                        ]}>{reasonKeyMap[reason] || reason}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.feedbackInput}
                  placeholder={t('report.feedbackPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />

                <TouchableOpacity style={styles.feedbackSubmitButton} onPress={handleSubmitFeedback}>
                  <Text style={styles.feedbackSubmitText}>{t('report.feedbackSubmit')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <PhaseCelebrationModal
        visible={showPhaseCelebration}
        onClose={() => setShowPhaseCelebration(false)}
        childName={childName}
      />
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
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
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
    width: 100,
    height: 100,
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
    fontSize: 12,
    color: COLORS.mainPurple,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroFocusHeading: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  heroDescription: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
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
    marginBottom: 12,
  },
  fromIntakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fromIntakeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  focusAreasScrollContent: {
    gap: FOCUS_CARD_GAP,
    paddingRight: 4,
  },
  focusAreaCard: {
    width: FOCUS_CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  focusAreaIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  focusAreaLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 18,
    marginBottom: 10,
    minHeight: 36,
  },
  focusAreaLevelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 10,
  },
  focusAreaLevelText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  focusAreaFocusText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  focusAreasDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  focusAreaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  focusAreaDotActive: {
    backgroundColor: COLORS.mainPurple,
    width: 16,
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
  // Active (current) level hero card
  journeyActiveCard: {
    backgroundColor: '#F5F0FF',
    borderRadius: 20,
    padding: 16,
    margin: 12,
    marginBottom: 8,
  },
  journeyActiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  journeyLevelBadge: {
    backgroundColor: COLORS.mainPurple,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  journeyLevelBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  journeyActiveTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  journeyActiveSkill: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.mainPurple,
    marginBottom: 10,
  },
  journeyActiveGoal: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 18,
    marginBottom: 6,
  },
  journeyActiveGoalLabel: {
    fontFamily: FONTS.bold,
  },
  journeyActiveLearn: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  // Roadmap — compact list of all 7 levels
  journeyRoadmap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  journeyRoadmapRow: {
    flexDirection: 'row',
  },
  journeyStepIndicatorCol: {
    width: 32,
    alignItems: 'center',
  },
  journeyStepNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.mainPurple,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  journeyStepNumberCircleDone: {
    backgroundColor: '#10B981',
  },
  journeyStepNumberCircleLocked: {
    backgroundColor: '#F3F4F6',
  },
  journeyStepNumberText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
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
    paddingLeft: 8,
    paddingBottom: 16,
  },
  journeyRoadmapTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
    marginBottom: 1,
  },
  journeyRoadmapTitleLocked: {
    color: '#9CA3AF',
  },
  journeyRoadmapSkill: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#9CA3AF',
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
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
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
