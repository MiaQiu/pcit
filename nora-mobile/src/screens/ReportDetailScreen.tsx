/**
 * ReportDetailScreen
 * Redesigned full session report ("Today's Coaching") — same underlying
 * RecordingAnalysis data as ReportScreen.tsx, restyled to match
 * ReportScreen_v2.tsx's pastel-card visual language. Reached from
 * ReportScreen_v2's "Continue to Coaching" button (not yet rewired here —
 * this file only adds the new screen + route).
 *
 * Every section now maps to real data from RecordingAnalysis. The hero text,
 * topMomentCelebration, the interaction-style tip banner, and the Crisis
 * Moment card (hidden when no distress moment was detected) all come from
 * pcitAnalysisService's single consolidated "report-highlights" call
 * (generateReportHighlights), which reads the coaching narrative + the
 * already-identified top-moment quote rather than the raw transcript. The
 * hero/celebration/tip fields fall back to generic static copy only for
 * sessions analyzed before this call existed. Everything else — Top Moment
 * + audio, Today's Interaction Style values, tomorrowGoal text, the
 * today→target goal counts, aboutChild + its tags (hidden when absent), and
 * the transcript link — is likewise real. The Tomorrow's Goal card's tip
 * line is backed by goalDirective.coachingTip from the deterministic
 * level-based goal engine (server/utils/levelGoalEngine.cjs), populated for
 * both CDI and PDI sessions.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { COLORS, FONTS, REPORT_DRAGON_GOOD, REPORT_DETAIL_DRAGON } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService, useAuthService } from '../contexts/AppContext';
import type { RecordingAnalysis, User, DevelopmentalProgress, DomainType, DomainMilestone, DomainProfiling } from '@nora/core';
import { MomentPlayer } from '../components/MomentPlayer';
import { RadarChart } from '../components/RadarChart';
import { DomainMilestoneModal } from '../components/DomainMilestoneModal';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';

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

// Strip trailing PCIT coding tags (e.g. "Great job! LP" -> "Great job!").
const stripPcitTags = (text: string): string => {
  if (!text) return text;
  return text
    .split('\n')
    .map(line => line.replace(/\s+(LP|IC|DC|RF|BD|NT|QU|CM|CR|UP|NE|EC|PR|NA)$/gi, ''))
    .join('\n')
    .trim();
};

// Icon + color per "Today's Interaction Style" row — skills (praise/echo/
// narrate) read as purple "the more the better"; avoid-areas (questions/
// commands/criticism) read as orange/red "the fewer the better".
const INTERACTION_ROW_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; badgeColor: string; iconColor: string; barColor: string; goodDirection: 'up' | 'down' }> = {
  'Praise (Labeled)': { icon: 'star', badgeColor: '#FEE2E2', iconColor: '#DC2626', barColor: COLORS.mainPurple, goodDirection: 'up' },
  'Echo': { icon: 'chatbubble-ellipses', badgeColor: '#EDE9FE', iconColor: COLORS.mainPurple, barColor: COLORS.mainPurple, goodDirection: 'up' },
  'Narrate': { icon: 'book', badgeColor: '#DBEAFE', iconColor: '#2563EB', barColor: COLORS.mainPurple, goodDirection: 'up' },
  'Questions': { icon: 'help-circle', badgeColor: '#FFEDD5', iconColor: '#EA580C', barColor: '#F97316', goodDirection: 'down' },
  'Commands': { icon: 'hand-left', badgeColor: '#FEF3C7', iconColor: '#D97706', barColor: '#F97316', goodDirection: 'down' },
  'Criticism': { icon: 'close-circle', badgeColor: '#FEE2E2', iconColor: '#DC2626', barColor: '#DC2626', goodDirection: 'down' },
};
const DEFAULT_ROW_META = { icon: 'ellipse' as keyof typeof Ionicons.glyphMap, badgeColor: '#F3F4F6', iconColor: '#6B7280', barColor: '#9CA3AF', goodDirection: 'up' as const };

interface InteractionRow {
  label: string;
  value: number; // capped 0-10, for the bar fill width only
  rawValue: number; // true count, shown in the numeric label
  prev?: number; // true previous count, for the delta
}

export const ReportDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<ReportDetailRouteProp>();
  const { t } = useTranslation();
  const recordingService = useRecordingService();
  const authService = useAuthService();
  const { recordingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<RecordingAnalysis | null>(null);
  const [pollingCount, setPollingCount] = useState(0);
  const [childName, setChildName] = useState('Your Child');
  const [prevSkills, setPrevSkills] = useState<Record<string, number> | null>(null);
  const [prevAreas, setPrevAreas] = useState<Record<string, number> | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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

  useEffect(() => {
    amplitudeService.trackScreenView('ReportDetail', { recordingId });
    loadReportData();
    loadChildName();
    loadWacbStatus();
  }, [recordingId]);

  // Fetched once reportData is available, same pattern as ReportScreen.tsx.
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
    });
  };

  // Non-critical: same pattern as ReportScreen_v2's loadPreviousComparison,
  // extended to capture every skill/area value (not just the score and one
  // goal area) so each "Today's Interaction Style" row can show a real delta.
  const loadPreviousComparison = async (current: RecordingAnalysis) => {
    try {
      const { recordings } = await recordingService.getRecordings();
      const currentTime = new Date(current.createdAt).getTime();
      const previous = (recordings || [])
        .filter((r: any) => r.analysisStatus === 'COMPLETED' && r.id !== recordingId && new Date(r.createdAt).getTime() < currentTime)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (!previous) return;
      const prevAnalysis = await recordingService.getAnalysis(previous.id);
      const skillMap: Record<string, number> = {};
      (prevAnalysis.skills || []).forEach(s => { skillMap[s.label] = s.progress; });
      setPrevSkills(skillMap);
      const areaMap: Record<string, number> = {};
      (prevAnalysis.areasToAvoid || []).forEach(a => { areaMap[a.label] = a.count; });
      setPrevAreas(areaMap);
    } catch (err) {
      // No previous session to compare against — rows just skip the delta.
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

  const interactionRows: InteractionRow[] = [
    ...skills.map(s => ({ label: s.label, value: Math.min(s.progress, 10), rawValue: s.progress, prev: prevSkills?.[s.label] })),
    ...filteredAreas.map(a => ({ label: a.label, value: Math.min(a.count, 10), rawValue: a.count, prev: prevAreas?.[a.label] })),
  ];

  // Crisis moment is extracted from the coaching narrative — only present
  // (and only rendered) when the session actually had a distress moment.
  const crisisMoment = reportData.crisisMoment?.detected ? reportData.crisisMoment : null;

  // Top Moment: reuse the same "preceding utterance + main utterance" shape
  // as ReportScreen.tsx's getUtterancesForSkill so both lines of dialogue
  // show, not just the single tagged line.
  const transcript = reportData.transcript || [];
  const topIdx = reportData.topMomentUtteranceNumber;
  const precedingLine = topIdx != null && topIdx > 0 ? transcript[topIdx - 1] : null;
  const mainLine = topIdx != null ? transcript[topIdx] : null;
  const fallbackQuote = typeof reportData.topMoment === 'string' ? reportData.topMoment : reportData.topMoment?.quote;
  // Falls back to a generic line for sessions analyzed before topMomentCelebration existed.
  const celebration = reportData.topMomentCelebration
    || t('reportDetail.topMoment.afterMoment', { childName });

  const tomorrowGoalText = (reportData.mode === 'PDI' ? reportData.pdiTomorrowGoal : reportData.tomorrowGoal) || null;
  // Deterministic today→target counts for the focus skill — populated for both CDI and PDI.
  const goalDirective = reportData.mode === 'PDI'
    ? (reportData.pdiTomorrowGoalDirective || null)
    : (reportData.tomorrowGoalDirective || null);

  const aboutChildItem = reportData.aboutChild?.[0];
  // Real tags from the about-child extraction — hidden entirely for older
  // sessions analyzed before this field existed, rather than faking chips.
  const childTags = aboutChildItem?.tags || [];
  const childInsightBody = aboutChildItem?.Description || reportData.childReaction || null;

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
        {/* Hero */}
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

        {/* Crisis Moment Detected — only rendered when the session actually had one */}
        {crisisMoment && (
          <View style={styles.crisisCard}>
            <View style={styles.crisisCol}>
              <View style={styles.crisisTitleRow}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.crisisTitle}>{t('reportDetail.crisis.title')}</Text>
              </View>
              <Text style={styles.crisisBody}>{crisisMoment.description}</Text>
            </View>
            <View style={styles.crisisDivider} />
            <View style={styles.crisisCol}>
              <Text style={styles.crisisHelpedTitle}>{t('reportDetail.crisis.whatHelpedTitle')}</Text>
              {crisisMoment.whatHelped.map((item, i) => (
                <View key={i} style={styles.crisisHelpedRow}>
                  <Ionicons name="checkmark-circle" size={15} color="#DC2626" />
                  <Text style={styles.crisisHelpedText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Moment */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="star" size={16} color={COLORS.mainPurple} />
            <Text style={styles.cardTitle}>{t('reportDetail.topMoment.title')}</Text>
          </View>

          {reportData.audioUrl && reportData.topMomentStartTime != null && reportData.topMomentEndTime != null && (
            <MomentPlayer
              audioUrl={reportData.audioUrl}
              startTime={reportData.topMomentStartTime}
              endTime={reportData.topMomentEndTime}
            />
          )}

          {precedingLine || mainLine ? (
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

          {celebration && (
            <View style={styles.momentCelebration}>
              <Ionicons name="heart" size={14} color={COLORS.mainPurple} />
              <Text style={styles.momentCelebrationText}>{celebration}</Text>
            </View>
          )}
        </View>

        {/* Today's Interaction Style */}
        <View style={styles.card}>
          <View style={styles.interactionHeaderRow}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{t('reportDetail.interactionStyle.title')}</Text>
              <Ionicons name="information-circle-outline" size={15} color="#9CA3AF" style={{ marginLeft: 4 }} />
            </View>
          </View>

          {interactionRows.map((row, i) => {
            const meta = INTERACTION_ROW_META[row.label] || DEFAULT_ROW_META;
            const delta = row.prev != null ? row.rawValue - row.prev : null;
            const improved = delta == null ? null : (meta.goodDirection === 'up' ? delta > 0 : delta < 0);
            const deltaColor = delta == null || delta === 0 ? '#9CA3AF' : (improved ? '#10B981' : '#DC2626');
            const arrowName = delta == null || delta === 0 ? 'remove' : (delta > 0 ? 'arrow-up' : 'arrow-down');
            return (
              <React.Fragment key={i}>
                {i === skills.length && <View style={styles.interactionDivider} />}
                <View style={styles.interactionRow}>
                  <View style={[styles.interactionBadge, { backgroundColor: meta.badgeColor }]}>
                    <Ionicons name={meta.icon} size={13} color={meta.iconColor} />
                  </View>
                  <View style={styles.interactionBarTrack}>
                    <View style={[styles.interactionBarFill, { width: `${(row.value / 10) * 100}%`, backgroundColor: meta.barColor }]} />
                  </View>
                  <Text style={styles.interactionValue}>{row.rawValue}/10</Text>
                  <View style={styles.interactionDeltaCol}>
                    <Ionicons name={arrowName as any} size={12} color={deltaColor} />
                    <Text style={[styles.interactionDeltaText, { color: deltaColor }]}>
                      {delta == null || delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}

          <View style={styles.tipBanner}>
            <Ionicons name="bulb" size={14} color={COLORS.mainPurple} />
            <Text style={styles.tipBannerText}>{reportData.interactionTip || t('reportDetail.interactionStyle.tip', { childName })}</Text>
          </View>
        </View>

        {/* Tomorrow's Goal */}
        {tomorrowGoalText && (
          <View style={styles.goalCard}>
            <View style={styles.goalLeftCol}>
              <View style={styles.goalTopRow}>
                <Text style={styles.goalLabel}>{t('reportDetail.tomorrowGoal.title')}</Text>
              </View>
              <Text style={styles.goalTitle}>{tomorrowGoalText}</Text>

              <View style={styles.goalTodayTomorrowRow}>
                <View style={styles.goalTodayCol}>
                  <Text style={styles.goalMutedLabel}>{t('reportDetail.tomorrowGoal.todayLabel')}</Text>
                  <View style={styles.goalTodayPill}>
                    {goalDirective?.currentNumber != null && (
                      <Text style={styles.goalTodayPillText}>{goalDirective.currentNumber}</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                <View style={styles.goalTomorrowCol}>
                  <Text style={styles.goalMutedLabel}>{t('reportDetail.tomorrowGoal.tomorrowLabel')}</Text>
                  <View style={styles.goalTomorrowPill}>
                    <Text style={styles.goalTomorrowPillText}>
                      {typeof goalDirective?.targetNumber === 'number'
                        ? t('reportDetail.tomorrowGoal.aimFor', { count: goalDirective.targetNumber })
                        : (goalDirective?.targetNumber || t('reportDetail.tomorrowGoal.aimFor', { count: 1 }))}
                    </Text>
                  </View>
                </View>
              </View>

              {goalDirective?.coachingTip && (
                <View style={styles.goalTipBanner}>
                  <Ionicons name="bulb" size={14} color={COLORS.mainPurple} />
                  <Text style={styles.goalTipBannerText}>{goalDirective.coachingTip}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* What we learned about {childName} */}
        <TouchableOpacity style={styles.card} activeOpacity={aboutChildItem ? 0.7 : 1}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleRowFlush}>
              <Ionicons name="heart" size={16} color={COLORS.mainPurple} />
              <Text style={styles.cardTitle}>{t('reportDetail.childInsight.title', { childName })}</Text>
            </View>
            <TouchableOpacity onPress={handleShareChildInsight} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Share">
              <Ionicons name="share-outline" size={18} color={COLORS.mainPurple} />
            </TouchableOpacity>
          </View>
          <View style={styles.childInsightRow}>
            <Image source={REPORT_DRAGON_GOOD} style={styles.childInsightImage} resizeMode="contain" />
            <View style={styles.childInsightTextCol}>
              {aboutChildItem?.Title && <Text style={styles.childInsightHeading}>{aboutChildItem.Title}</Text>}
              {childInsightBody && <Text style={styles.childInsightBody}>{childInsightBody}</Text>}
              {childTags.length > 0 && (
                <View style={styles.childTagsRow}>
                  {childTags.map((tag, i) => (
                    <View key={i} style={styles.childTagChip}>
                      <Text style={styles.childTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C4B5FD" />
          </View>
        </TouchableOpacity>

        {/* Developmental Milestones */}
        <View style={styles.developmentalSection}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleRowFlush}>
              <Ionicons name="analytics" size={16} color={COLORS.mainPurple} />
              <Text style={styles.cardTitle}>
                {developmentalProgress?.childName
                  ? t('report.section.developmentalMilestonesWithName', { childName: developmentalProgress.childName })
                  : t('report.section.developmentalMilestones')}
              </Text>
            </View>
            <TouchableOpacity onPress={handleShareDevelopmental} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Share">
              <Ionicons name="share-outline" size={18} color={COLORS.mainPurple} />
            </TouchableOpacity>
          </View>
          {developmentalProgress && developmentalProgress.completedSessionCount >= 5 ? (
            <RadarChart
              data={developmentalProgress}
              childName={developmentalProgress.childName}
              onDomainPress={handleDomainPress}
              showTitle={false}
            />
          ) : (
            <View style={styles.milestoneLockedCard}>
              <View style={styles.milestoneLockedBadge}>
                <Text style={styles.milestoneLockedBadgeText}>
                  {t('report.milestone.lockedBadge', { count: developmentalProgress?.completedSessionCount ?? 0 })}
                </Text>
              </View>
              <Text style={styles.milestoneLockedDesc}>{t('report.milestone.lockedDescription')}</Text>
            </View>
          )}
        </View>

        {/* Full Transcript */}
        <TouchableOpacity
          style={styles.transcriptCard}
          activeOpacity={0.7}
          onPress={() => { amplitudeService.trackEvent('Report Transcript Tapped', { recordingId }); navigation.navigate('Transcript', { recordingId }); }}
        >
          <View style={styles.transcriptIconCircle}>
            <Ionicons name="document-text" size={18} color={COLORS.mainPurple} />
          </View>
          <View style={styles.transcriptTextCol}>
            <Text style={styles.transcriptTitle}>{t('reportDetail.transcript.title')}</Text>
            <Text style={styles.transcriptSubtitle}>{t('reportDetail.transcript.subtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.mainPurple} />
        </TouchableOpacity>

        {/* Unlock My Child's Plan — hidden once the user has completed the WACB survey */}
        {wacbCompleted === false && (
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
              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
              <Text style={styles.unlockTimeText}>{t('reportDetail.unlock.time')}</Text>
            </View>
          </View>
        )}

        <View style={styles.footerBanner}>
          <Ionicons name="heart" size={13} color={COLORS.mainPurple} />
          <Text style={styles.footerBannerText}>{t('reportDetail.footer')}</Text>
        </View>
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
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
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
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textDark,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textDark, marginTop: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontFamily: FONTS.regular, fontSize: 16, color: '#E74C3C', textAlign: 'center', marginTop: 16, marginBottom: 24 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  // ── Hero ──
  heroCard: {
    position: 'relative',
    backgroundColor: '#FAF7FE',
    borderRadius: 20,
    paddingVertical: 20,
    paddingRight: 16,
    paddingLeft: 150,
    marginTop: 0,
    marginBottom: 14,
    justifyContent: 'center',
    minHeight: 120,
  },
  heroDragon: {
    position: 'absolute',
    left: -10,
    bottom: -25,
    width: 160,
    height: 160,
    zIndex: 2,
  },
  heroTextCol: {},
  heroIntro: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  heroBold: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mainPurple,
    lineHeight: 18,
  },

  // ── Crisis Moment card ──
  crisisCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF7F8',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  crisisCol: { flex: 1 },
  crisisDivider: { width: 1, backgroundColor: '#FCD3D3', marginHorizontal: 2 },
  crisisTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  crisisTitle: { fontFamily: FONTS.bold, fontSize: 13, color: '#DC2626' },
  crisisBody: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDark, lineHeight: 18 },
  crisisHelpedTitle: { fontFamily: FONTS.bold, fontSize: 13, color: '#DC2626', marginBottom: 8 },
  crisisHelpedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  crisisHelpedText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDark, lineHeight: 17 },

  // ── Generic card ──
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBFB',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitleRowFlush: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  cardTitle: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.textDark },

  // ── Top Moment ──
  quoteLines: { marginTop: 10, gap: 6 },
  quoteLine: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDark, lineHeight: 19 },
  quoteSpeaker: { fontFamily: FONTS.bold, color: COLORS.textDark },
  momentCelebration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF6FE',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  momentCelebrationText: { flex: 1, fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.mainPurple, lineHeight: 17 },

  // ── Today's Interaction Style ──
  interactionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  interactionDivider: { height: 1, backgroundColor: '#F0F0F3', marginBottom: 12 },
  interactionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  interactionBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  interactionBarTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: '#F0F0F3', overflow: 'hidden' },
  interactionBarFill: { height: '100%', borderRadius: 4 },
  interactionValue: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.textDark, width: 34, textAlign: 'right' },
  interactionDeltaCol: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 34, justifyContent: 'flex-end' },
  interactionDeltaText: { fontFamily: FONTS.semiBold, fontSize: 11 },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FAF6FE',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  tipBannerText: { flex: 1, fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.mainPurple, lineHeight: 17 },

  // ── Tomorrow's Goal ──
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBFB',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  goalLeftCol: {},
  goalTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  goalLabel: { fontFamily: FONTS.bold, fontSize: 13, color: '#16A34A' },
  goalTitle: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.textDark, marginBottom: 10 },
  goalTodayTomorrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalTodayCol: { alignItems: 'center', flexShrink: 1 },
  goalTomorrowCol: { alignItems: 'center', flexShrink: 1 },
  goalMutedLabel: { fontFamily: FONTS.regular, fontSize: 11, color: '#9CA3AF', marginBottom: 6 },
  goalTodayPill: { width: 44, height: 20, borderRadius: 999, backgroundColor: '#FDE7D2', justifyContent: 'center', alignItems: 'center' },
  goalTodayPillText: { fontFamily: FONTS.semiBold, fontSize: 9, color: '#D97706' },
  goalTomorrowPill: { width: 70, borderRadius: 12, backgroundColor: '#BBF7D0', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3 },
  goalTomorrowPillText: { fontFamily: FONTS.semiBold, fontSize: 9, color: '#16A34A', textAlign: 'center', lineHeight: 11 },
  goalTipBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0EEFB' },
  goalTipBannerText: { flex: 1, fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.mainPurple, lineHeight: 16 },

  // ── What we learned about {childName} ──
  childInsightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  childInsightImage: { width: 56, height: 56 },
  childInsightTextCol: { flex: 1 },
  childInsightHeading: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.textDark, marginBottom: 4 },
  childInsightBody: { fontFamily: FONTS.regular, fontSize: 12, color: '#6B7280', lineHeight: 17, marginBottom: 8 },
  childTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  childTagChip: { backgroundColor: '#F3E8FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  childTagText: { fontFamily: FONTS.semiBold, fontSize: 10, color: COLORS.mainPurple },

  // ── Developmental Milestones ──
  developmentalSection: { marginBottom: 14 },
  milestoneLockedCard: {
    backgroundColor: '#FAF7FE',
    borderWidth: 1,
    borderColor: '#F0EBFB',
    borderRadius: 20,
    padding: 16,
  },
  milestoneLockedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3E8FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  milestoneLockedBadgeText: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.mainPurple },
  milestoneLockedDesc: { fontFamily: FONTS.regular, fontSize: 12, color: '#6B7280', lineHeight: 18 },

  // ── Full Transcript ──
  transcriptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBFB',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  transcriptIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3E8FF', justifyContent: 'center', alignItems: 'center' },
  transcriptTextCol: { flex: 1 },
  transcriptTitle: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.mainPurple, marginBottom: 2 },
  transcriptSubtitle: { fontFamily: FONTS.regular, fontSize: 11, color: '#9CA3AF' },

  // ── Unlock My Child's Plan ──
  unlockCard: {
    alignItems: 'center',
    backgroundColor: '#FAF7FE',
    borderWidth: 1,
    borderColor: '#F0EBFB',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
  },
  unlockIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  unlockTitle: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.textDark, textAlign: 'center', marginBottom: 6 },
  unlockSubtitle: { fontFamily: FONTS.regular, fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  unlockFeatureRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 20 },
  unlockFeature: { alignItems: 'center', width: 78 },
  unlockFeatureBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  unlockFeatureText: { fontFamily: FONTS.semiBold, fontSize: 10, color: COLORS.textDark, textAlign: 'center', lineHeight: 13 },
  unlockButton: {
    width: '100%',
    backgroundColor: COLORS.mainPurple,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  unlockButtonText: { fontFamily: FONTS.bold, fontSize: 14, color: '#FFFFFF' },
  unlockTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  unlockTimeText: { fontFamily: FONTS.regular, fontSize: 11, color: '#9CA3AF' },

  // ── Footer ──
  footerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    backgroundColor: '#FAF7FE',
    borderRadius: 16,
    padding: 14,
  },
  footerBannerText: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.mainPurple, textAlign: 'center' },
});
