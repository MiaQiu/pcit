/**
 * ReportScreen v2
 * Compact post-session celebration screen: emotional deposit, today's goal
 * progress, and parenting level — shown before the full Report screen.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { COLORS, FONTS, REPORT_DRAGON_GOOD, REPORT_DRAGON_AMAZING, REPORT_TARGET, REPORT_TARGET_SMALL, REPORT_STAR_SMALL } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService, useAuthService } from '../contexts/AppContext';
import type { RecordingAnalysis, ParentSkillLevel } from '@nora/core';
import * as userStorage from '../lib/userStorage';
import { useTranslation, Trans } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';

type ReportScreenV2RouteProp = RouteProp<RootStackParamList, 'ReportV2'>;

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

// Parenting Level — level number -> i18n key on the shared 7-level ladder
// (same keys/copy as ProfileReportScreen's Personalized Learning Journey).
const PARENT_SKILL_LEVEL_KEYS: Record<ParentSkillLevel, string> = {
  1: 'playBuilder',
  2: 'confidenceBuilder',
  3: 'attentionBuilder',
  4: 'communicationBuilder',
  5: 'cooperationBuilder',
  6: 'boundaryBuilder',
  7: 'confidentParent',
};

export const ReportScreen_v2: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<ReportScreenV2RouteProp>();
  const { t } = useTranslation();
  const recordingService = useRecordingService();
  const authService = useAuthService();
  const { recordingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<RecordingAnalysis | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  const [prevScore, setPrevScore] = useState<number | null>(null);
  const [prevAreaCounts, setPrevAreaCounts] = useState<Record<string, number> | null>(null);

  const [parentLevel, setParentLevel] = useState<ParentSkillLevel>(1);
  const [level5QualifyingCount, setLevel5QualifyingCount] = useState(0);

  useEffect(() => {
    amplitudeService.trackScreenView('Report', { recordingId, version: 'v2' });
    loadReportData();
    loadParentSkillLevel();
  }, [recordingId]);

  const loadParentSkillLevel = async () => {
    try {
      const info = await authService.getParentSkillLevel();
      setParentLevel(info.currentLevel);
      setLevel5QualifyingCount(info.level5QualifyingCount);
    } catch (err) {
      // Keep default level 1 if fetch fails
    }
  };

  // Non-critical: finds the previous completed session to diff score/areas
  // against. Failing silently (no previous session, offline, etc.) just
  // means the delta and today's-goal comparisons fall back gracefully.
  const loadPreviousComparison = async (current: RecordingAnalysis) => {
    try {
      const { recordings } = await recordingService.getRecordings();
      const currentTime = new Date(current.createdAt).getTime();
      const previous = (recordings || [])
        .filter((r: any) => r.analysisStatus === 'COMPLETED' && r.id !== recordingId && new Date(r.createdAt).getTime() < currentTime)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (!previous) return;
      const prevAnalysis = await recordingService.getAnalysis(previous.id);
      setPrevScore(prevAnalysis.noraScore ?? null);
      const counts: Record<string, number> = {};
      (prevAnalysis.areasToAvoid || []).forEach((a: any) => { counts[a.label] = a.count || 0; });
      setPrevAreaCounts(counts);
    } catch (err) {
      // No previous session to compare against — fine, sections adapt.
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

  const handleContinueToCoaching = () => {
    amplitudeService.trackEvent('Report V2 Continue To Coaching Tapped', { recordingId });
    navigation.navigate('ReportDetail', { recordingId });
  };

  const handleLevelCardPress = () => {
    amplitudeService.trackEvent('Report Parenting Level Tapped', { level: parentLevel, recordingId });
    navigation.navigate('ParentLevelDetail', { level: parentLevel });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
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
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
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

  const score = reportData.noraScore ?? 0;
  const isAmazing = score >= 90;
  const scoreDelta = prevScore != null ? score - prevScore : null;

  // Today's Goal — the areasToAvoid entry (excluding PDI Commands) with the
  // highest count this session; skipped when nothing needs reducing.
  const filteredAreas = reportData.areasToAvoid.filter(
    a => !(reportData.mode === 'PDI' && a.label === 'Commands')
  );
  const goalArea = filteredAreas.reduce<{ label: string; count: number } | null>(
    (max, a) => (a.count > (max?.count ?? 0) ? a : max),
    null
  );
  const goalPreviousCount = goalArea && prevAreaCounts ? prevAreaCounts[goalArea.label] ?? null : null;
  const goalAchieved = goalArea
    ? (goalPreviousCount != null ? goalArea.count < goalPreviousCount : goalArea.count === 0)
    : false;
  const goalSkillLabel = goalArea ? getSkillDisplayLabel(goalArea.label, t) : null;
  const goalSkillForCount = (count: number) => {
    const plural = goalSkillLabel?.toLowerCase() ?? '';
    return count === 1 && plural.endsWith('s') ? plural.slice(0, -1) : plural;
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <TouchableOpacity onPress={handleBack} style={styles.heroBackButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <Image source={isAmazing ? REPORT_DRAGON_AMAZING : REPORT_DRAGON_GOOD} style={styles.dragonImage} resizeMode="contain" />
          <View style={styles.heroTextCol}>
            <Text style={styles.headline}>
              {isAmazing ? t('reportV2.headlineAmazing') : t('reportV2.headlineGood')}
            </Text>
            {!isAmazing && (
              <Text style={styles.headlineSubtext}>{t('reportV2.headlineSubtext')}</Text>
            )}
          </View>
        </View>

        {/* Emotional Deposit */}
        <View style={styles.depositCard}>
          <View style={styles.depositIconCircle}>
            <Ionicons name="heart" size={28} color={'#6837EA'} />
          </View>
          <View style={styles.depositScoreCol}>
            <Text style={styles.depositScoreText}>+{score}</Text>
            <Text style={styles.depositLabel}>{t('reportV2.emotionalDeposit')}</Text>
          </View>
          {scoreDelta != null && (
            <View style={styles.depositDeltaGroup}>
              <View style={styles.depositDivider} />
              <View style={styles.depositDeltaCol}>
                <View style={styles.depositDeltaRow}>
                  <Ionicons name={scoreDelta >= 0 ? 'arrow-up' : 'arrow-down'} size={13} color={scoreDelta >= 0 ? '#10B981' : '#DC2626'} />
                  <Text style={[styles.depositDeltaText, { color: scoreDelta >= 0 ? '#10B981' : '#DC2626' }]}>
                    {scoreDelta >= 0 ? '+' : ''}{scoreDelta}
                  </Text>
                  <Text style={styles.depositDeltaFrom}>{t('reportV2.deltaFrom')}</Text>
                </View>
                <Text style={styles.depositDeltaSuffix}>{t('reportV2.deltaLastSession')}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Today's Goal */}
        {goalArea && goalSkillLabel && (
          <View style={styles.goalCard}>
            <View style={styles.goalTopRow}>
              <View style={styles.goalHeaderCol}>
                <View style={styles.goalHeaderRow}>
                  <Image source={REPORT_TARGET_SMALL} style={styles.goalIconImage} resizeMode="contain" />
                  <Text style={styles.goalLabel}>{t('reportV2.todaysGoal')}</Text>
                </View>
                <Text style={styles.goalTitle}>{t('reportV2.reduceSkill', { skill: goalSkillLabel })}</Text>
                <View style={styles.goalTitleDivider} />

                <View style={styles.goalStatusRow}>
                  {goalAchieved ? (
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  ) : (
                    <Image source={REPORT_STAR_SMALL} style={styles.goalStatusImage} resizeMode="contain" />
                  )}
                  <Text style={[styles.goalStatusText, { color: goalAchieved ? '#10B981' : '#D97706' }]}>
                    {goalAchieved ? t('reportV2.youDidIt') : t('reportV2.almostThere')}
                  </Text>
                </View>

                <Text style={styles.goalCountText}>
                  <Trans
                    i18nKey={goalAchieved ? 'reportV2.onlyCountToday' : 'reportV2.countToday'}
                    values={{ count: goalArea.count, skill: goalSkillForCount(goalArea.count) }}
                    components={[<Text style={styles.goalCountBold} />]}
                  />
                </Text>
                {goalPreviousCount != null && (
                  <Text style={styles.goalCountMuted}>
                    {t(goalAchieved ? 'reportV2.lastTime' : 'reportV2.lastSession', { count: goalPreviousCount })}
                  </Text>
                )}

                {!goalAchieved && (
                  <Text style={styles.goalEncouragement}>{t('reportV2.goalEncouragement')}</Text>
                )}
              </View>
              <Image source={REPORT_TARGET} style={styles.goalTargetImage} resizeMode="contain" />
            </View>
          </View>
        )}

        {/* Parenting Level */}
        <TouchableOpacity style={styles.levelCard} activeOpacity={0.85} onPress={handleLevelCardPress}>
          <View style={styles.levelHeaderRow}>
            <View style={styles.levelStarBadge}>
              <Ionicons name="star" size={13} color={COLORS.mainPurple} />
            </View>
            <Text style={styles.levelHeaderLabel}>{t('reportV2.parentingLevel')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={styles.levelHeaderChevron} />
          </View>
          <View style={styles.levelBodyRow}>
            <View style={styles.levelNumberBadge}>
              <Text style={styles.levelNumberText}>{parentLevel}</Text>
            </View>
            <View style={styles.levelProgressCol}>
              <Text style={styles.levelTitle}>{t('reportV2.levelHeading', { level: parentLevel })}</Text>
              <Text style={styles.levelSubtitle}>{t(`profileReport.levels.${PARENT_SKILL_LEVEL_KEYS[parentLevel]}.title`)}</Text>
              {parentLevel === 5 && (
                <View style={styles.levelProgressRow}>
                  <View style={styles.levelProgressTrack}>
                    <View style={[styles.levelProgressFill, { width: `${(level5QualifyingCount / 2) * 100}%` }]} />
                  </View>
                  <Text style={styles.levelPercentText}>{level5QualifyingCount}/2</Text>
                </View>
              )}
            </View>
          </View>
          {parentLevel === 5 && (
            <Text style={styles.levelFooterText}>
              {t('reportV2.levelFooterSessions', { count: level5QualifyingCount, nextLevel: parentLevel + 1 })}
            </Text>
          )}

          <View style={styles.levelClearGoalBox}>
            <View style={styles.levelClearGoalHeaderRow}>
              <Ionicons name="flag" size={14} color="#B45309" />
              <Text style={styles.levelClearGoalLabel}>{t('parentLevelDetail.clearGoalLabel')}</Text>
            </View>
            <Text style={styles.levelClearGoalText}>{t(`profileReport.levels.${PARENT_SKILL_LEVEL_KEYS[parentLevel]}.clearGoal`)}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.continueButton} onPress={handleContinueToCoaching} activeOpacity={0.85}>
          <Text style={styles.continueButtonText}>{t('reportV2.continueToCoaching')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
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
    paddingTop: 24,
    paddingBottom: 40,
  },

  // ── Hero ──
  heroSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroBackButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: 16,
  },
  dragonImage: {
    width: 150,
    height: 150,
  },
  heroTextCol: {
    flex: 1,
    marginLeft: 10,
    marginTop: 16,
  },
  headline: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.mainPurple,
  },
  headlineSubtext: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textDark,
    marginTop: 10,
    lineHeight: 21,
  },

  // ── Emotional Deposit card ──
  depositCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7FE',
    borderRadius: 20,
    padding: 18,
    marginBottom: 10,
    gap: 12,
  },
  depositIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  depositScoreCol: {
    flex: 1,
  },
  depositScoreText: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    color: COLORS.mainPurple,
  },
  depositLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
  },
  depositDeltaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    transform: [{ translateX: -20 }],
  },
  depositDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#E9DFFC',
  },
  depositDeltaCol: {
    alignItems: 'flex-end',
    paddingLeft: 8,
    flexShrink: 0,
  },
  depositDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  depositDeltaText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  depositDeltaFrom: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
    marginLeft: 2,
  },
  depositDeltaSuffix: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  // ── Today's Goal card ──
  goalCard: {
    backgroundColor: '#FAFBF6',
    borderRadius: 20,
    padding: 18,
    marginBottom: 10,
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalHeaderCol: {
    flex: 1,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  goalIconImage: {
    width: 26,
    height: 26,
  },
  goalStatusImage: {
    width: 20,
    height: 20,
  },
  goalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'left',
  },
  goalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textDark,
    marginBottom: 10,
    textAlign: 'left',
    marginLeft:33,
  },
  goalTitleDivider: {
    height: 1,
    backgroundColor: '#DCE7DF',
    marginBottom: 10,
  },
  goalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  goalStatusText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    textAlign: 'left',
    marginLeft:7,
  },
  goalCountText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textDark,
    textAlign: 'left',
    marginLeft:33,
  },
  goalCountBold: {
    fontFamily: FONTS.bold,
    color: '#D97706',
  },
  goalCountMuted: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'left',
    marginLeft: 33,
  },
  goalEncouragement: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textDark,
    marginTop: 6,
    lineHeight: 17,
    textAlign: 'left',
    marginLeft:33,
  },
  goalTargetImage: {
    width: 108,
    height: 108,
    marginLeft: 4,
  },

  // ── Parenting Level card ──
  levelCard: {
    backgroundColor: '#FAF7FE',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
  },
  levelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  levelStarBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelHeaderLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.mainPurple,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelHeaderChevron: {
    marginLeft: 'auto',
  },
  levelBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelNumberBadge: {
    width: 40,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.mainPurple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelNumberText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  levelProgressCol: {
    flex: 1,
  },
  levelTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
  },
  levelSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 8,
  },
  levelProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelProgressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5D9FA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    backgroundColor: COLORS.mainPurple,
    borderRadius: 3,
  },
  levelPercentText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.mainPurple,
  },
  levelFooterText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 12,
  },
  levelClearGoalBox: {
    marginTop: 14,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 12,
  },
  levelClearGoalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  levelClearGoalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  levelClearGoalText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },

  // ── CTA ──
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 28,
    paddingVertical: 16,
  },
  continueButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
