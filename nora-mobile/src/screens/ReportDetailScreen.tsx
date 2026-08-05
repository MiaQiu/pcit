/**
 * ReportDetailScreen
 * Redesigned full session report ("Today's Coaching") — same underlying
 * RecordingAnalysis data as ReportScreen.tsx, restyled to match
 * ReportScreen_v2.tsx's pastel-card visual language. Reached from
 * ReportScreen_v2's "Continue to Coaching" button (not yet rewired here —
 * this file only adds the new screen + route).
 *
 * A few sections in the target design have no backing API field yet
 * (flagged individually below with MOCK comments): the Crisis Moment
 * narrative, the Tomorrow's Goal today/tomorrow count bar, the fallback
 * 3-step calm-down tip, and the child-insight tag chips. Everything else
 * (Top Moment + audio, Today's Interaction Style values, tomorrowGoal text,
 * tip, aboutChild, transcript link) is real data from RecordingAnalysis.
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
import type { RecordingAnalysis } from '@nora/core';
import { MomentPlayer } from '../components/MomentPlayer';
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
  value: number; // 0-10 for the bar
  prev?: number;
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

  useEffect(() => {
    amplitudeService.trackScreenView('ReportDetail', { recordingId });
    loadReportData();
    loadChildName();
  }, [recordingId]);

  const loadChildName = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user?.childName) setChildName(user.childName);
    } catch (err) {
      // Keep default "Your Child" if fetch fails
    }
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
    ...skills.map(s => ({ label: s.label, value: Math.min(s.progress, 10), prev: prevSkills?.[s.label] })),
    ...filteredAreas.map(a => ({ label: a.label, value: Math.min(a.count, 10), prev: prevAreas?.[a.label] != null ? Math.min(prevAreas![a.label], 10) : undefined })),
  ];

  // MOCK fallback: "what helped" is derived from the real skills used this
  // session (progress > 0) rather than a real crisis-response log, since no
  // such field exists yet.
  const positiveSkills = skills.filter(s => s.progress > 0);
  const helpedItems = (positiveSkills.length > 0 ? positiveSkills.map(s => s.label) : ['fallback']).map(label =>
    t(`reportDetail.crisis.helped.${label}`, { childName, defaultValue: t('reportDetail.crisis.helped.fallback', { childName }) })
  );

  // Top Moment: reuse the same "preceding utterance + main utterance" shape
  // as ReportScreen.tsx's getUtterancesForSkill so both lines of dialogue
  // show, not just the single tagged line.
  const transcript = reportData.transcript || [];
  const topIdx = reportData.topMomentUtteranceNumber;
  const precedingLine = topIdx != null && topIdx > 0 ? transcript[topIdx - 1] : null;
  const mainLine = topIdx != null ? transcript[topIdx] : null;
  const fallbackQuote = typeof reportData.topMoment === 'string' ? reportData.topMoment : reportData.topMoment?.quote;
  // MOCK fallback: no real celebration field on this recording — falls back
  // to a generic re-engagement summary line so the banner always shows.
  const celebration = (typeof reportData.topMoment === 'object' ? reportData.topMoment?.celebration : null)
    || t('reportDetail.topMoment.afterMoment', { childName });

  const tomorrowGoalText = (reportData.mode === 'PDI' ? reportData.pdiTomorrowGoal : reportData.tomorrowGoal) || null;

  const aboutChildItem = reportData.aboutChild?.[0];
  // MOCK: tag chips are a lightweight heuristic split of the real aboutChild
  // title (no structured tag field exists) — falls back to a generic example
  // set when aboutChild hasn't been generated for this recording.
  const childTags = aboutChildItem
    ? aboutChildItem.Title.split(/\s*&\s*|\s+and\s+/i).map(s => s.trim()).filter(Boolean)
    : ['Sensitive', 'Needs Support', 'Recovers Well'];
  const childInsightBody = aboutChildItem?.Description || reportData.childReaction || null;

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
            <Text style={styles.heroIntro}>Big feelings are hard</Text>
            <Text style={styles.heroBold}>
              You stayed calm and helped {childName} start to recover.<Text style={styles.heroRegular}> That's progress</Text>
            </Text>
          </View>
        </View>

        {/* Crisis Moment Detected — MOCK narrative, see file header comment */}
        <View style={styles.crisisCard}>
          <View style={styles.crisisCol}>
            <View style={styles.crisisTitleRow}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.crisisTitle}>{t('reportDetail.crisis.title')}</Text>
            </View>
            <Text style={styles.crisisBody}>{t('reportDetail.crisis.fallbackDescription', { childName })}</Text>
          </View>
          <View style={styles.crisisDivider} />
          <View style={styles.crisisCol}>
            <Text style={styles.crisisHelpedTitle}>{t('reportDetail.crisis.whatHelpedTitle')}</Text>
            {helpedItems.map((item, i) => (
              <View key={i} style={styles.crisisHelpedRow}>
                <Ionicons name="checkmark-circle" size={15} color="#DC2626" />
                <Text style={styles.crisisHelpedText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

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
            const delta = row.prev != null ? row.value - row.prev : null;
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
                  <Text style={styles.interactionValue}>{row.value}/10</Text>
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
            <Text style={styles.tipBannerText}>{t('reportDetail.interactionStyle.tip', { childName })}</Text>
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

              {/* MOCK: no structured before/after count exists yet — this is
                  a generic today→tomorrow visual, not a real measured value. */}
              <View style={styles.goalTodayTomorrowRow}>
                <View style={styles.goalTodayCol}>
                  <Text style={styles.goalMutedLabel}>{t('reportDetail.tomorrowGoal.todayLabel')}</Text>
                  <View style={styles.goalTodayPill} />
                </View>
                <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                <View style={styles.goalTomorrowCol}>
                  <Text style={styles.goalMutedLabel}>{t('reportDetail.tomorrowGoal.tomorrowLabel')}</Text>
                  <View style={styles.goalTomorrowPill}>
                    <Text style={styles.goalTomorrowPillText}>{t('reportDetail.tomorrowGoal.aimFor', { count: 1 })}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.goalDivider} />

            <View style={styles.goalTipCol}>
              <View style={styles.goalTipTitleRow}>
                <Text style={styles.goalTipTitle}>{t('reportDetail.tomorrowGoal.tipTitle')}</Text>
              </View>
              {reportData.tip ? (
                <Text style={styles.goalTipStepText}>{reportData.tip}</Text>
              ) : (
                // MOCK fallback: generic evergreen calm-down steps, used
                // only when the session has no real `tip` field.
                [1, 2, 3].map(n => (
                  <View key={n} style={styles.goalTipStepRow}>
                    <View style={styles.goalTipStepBadge}>
                      <Text style={styles.goalTipStepBadgeText}>{n}</Text>
                    </View>
                    <Text style={styles.goalTipStepText}>{t(`reportDetail.tomorrowGoal.step${n}`)}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* What we learned about {childName} */}
        <TouchableOpacity style={styles.card} activeOpacity={aboutChildItem ? 0.7 : 1}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="heart" size={16} color={COLORS.mainPurple} />
            <Text style={styles.cardTitle}>{t('reportDetail.childInsight.title', { childName })}</Text>
          </View>
          <View style={styles.childInsightRow}>
            <Image source={REPORT_DRAGON_GOOD} style={styles.childInsightImage} resizeMode="contain" />
            <View style={styles.childInsightTextCol}>
              {aboutChildItem?.Title && <Text style={styles.childInsightHeading}>{aboutChildItem.Title}</Text>}
              {childInsightBody && <Text style={styles.childInsightBody}>{childInsightBody}</Text>}
              <View style={styles.childTagsRow}>
                {childTags.map((tag, i) => (
                  <View key={i} style={styles.childTagChip}>
                    <Text style={styles.childTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C4B5FD" />
          </View>
        </TouchableOpacity>

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

        <View style={styles.footerBanner}>
          <Ionicons name="heart" size={13} color={COLORS.mainPurple} />
          <Text style={styles.footerBannerText}>{t('reportDetail.footer')}</Text>
        </View>
      </ScrollView>
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
  heroRegular: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
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
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBFB',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  goalLeftCol: { flex: 1.3 },
  goalDivider: { width: 1, backgroundColor: '#F0EBFB', marginHorizontal: 14, transform: [{ translateX: -20 }] },
  goalTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  goalLabel: { fontFamily: FONTS.bold, fontSize: 13, color: '#16A34A' },
  goalTitle: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.textDark, marginBottom: 10 },
  goalTodayTomorrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalTodayCol: { alignItems: 'center', flexShrink: 1 },
  goalTomorrowCol: { alignItems: 'center', flexShrink: 1 },
  goalMutedLabel: { fontFamily: FONTS.regular, fontSize: 11, color: '#9CA3AF', marginBottom: 6 },
  goalTodayPill: { width: 44, height: 20, borderRadius: 999, backgroundColor: '#FDE7D2' },
  goalTomorrowPill: { width: 70, borderRadius: 12, backgroundColor: '#BBF7D0', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3 },
  goalTomorrowPillText: { fontFamily: FONTS.semiBold, fontSize: 9, color: '#16A34A', textAlign: 'center', lineHeight: 11 },
  goalTipCol: { flex: 1, transform: [{ translateX: -10 }] },
  goalTipTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8 },
  goalTipTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 12, color: COLORS.textDark, lineHeight: 16 },
  goalTipStepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  goalTipStepBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center' },
  goalTipStepBadgeText: { fontFamily: FONTS.bold, fontSize: 9, color: '#FFFFFF' },
  goalTipStepText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDark, lineHeight: 16 },

  // ── What we learned about {childName} ──
  childInsightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  childInsightImage: { width: 56, height: 56 },
  childInsightTextCol: { flex: 1 },
  childInsightHeading: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.textDark, marginBottom: 4 },
  childInsightBody: { fontFamily: FONTS.regular, fontSize: 12, color: '#6B7280', lineHeight: 17, marginBottom: 8 },
  childTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  childTagChip: { backgroundColor: '#F3E8FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  childTagText: { fontFamily: FONTS.semiBold, fontSize: 10, color: COLORS.mainPurple },

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
