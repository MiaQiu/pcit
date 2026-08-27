/**
 * ReportScreen v2
 * Compact post-session celebration screen: emotional deposit, today's goal
 * progress, and parenting level — shown before the full Report screen.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { COLORS, FONTS, REPORT_DRAGON_GOOD, REPORT_DRAGON_AMAZING } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService, useAuthService } from '../contexts/AppContext';
import type { RecordingAnalysis, ParentSkillLevel } from '@nora/core';
import { useTranslation, Trans } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';
import * as userStorage from '../lib/userStorage';
import { LevelUpModal } from '../components/LevelUpModal';
import { PARENT_SKILL_LEVEL_KEYS, PARENT_SKILL_LEVEL_ORDER } from '../constants/parentSkillLevels';
import { deriveGoalFromLevel, DerivedGoal } from '../utils/goalFallback';

type ReportScreenV2RouteProp = RouteProp<RootStackParamList, 'ReportV2'>;

// goalType values from server/utils/levelGoalEngine.cjs whose baseline/target
// are a REDUCTION (get under the target), not a build-up (climb to it).
const REDUCE_GOAL_TYPES = new Set(['AVOID_CRITICISM', 'AVOID_COMMANDS', 'AVOID_QUESTIONS']);

// goalType -> report.skillLabel.* key, for goalTypes that track exactly one
// PCIT skill/avoid item. Used instead of the server's flavor title (e.g.
// "The Calm Acceptance") so the card names the actual thing to work on.
// goalTypes with no single backing item (CALM_FOLLOWTHROUGH,
// INTEGRATE_SKILLS, MAINTAIN_SKILLS) fall back to the level's own skill name.
const GOAL_TYPE_SKILL_LABEL_KEY: Record<string, string> = {
  AVOID_CRITICISM: 'criticism',
  AVOID_COMMANDS: 'commands',
  AVOID_QUESTIONS: 'questions',
  BUILD_PRAISE: 'praiseLabeleld',
  BUILD_NARRATION: 'narrate',
  BUILD_ECHO: 'echo',
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

  const [parentLevel, setParentLevel] = useState<ParentSkillLevel>(1);
  // API field is named level5QualifyingCount for legacy reasons (see
  // ParentSkillLevelInfo) but now tracks new level 7's qualifying count.
  const [qualifyingCount, setQualifyingCount] = useState(0);
  const [levelUpInfo, setLevelUpInfo] = useState<{ from: ParentSkillLevel; to: ParentSkillLevel } | null>(null);

  useEffect(() => {
    amplitudeService.trackScreenView('Report', { recordingId, version: 'v2' });
    loadReportData();
    loadParentSkillLevel();
  }, [recordingId]);

  // No server signal exists for "did this session level you up" (the level
  // update runs fire-and-forget, decoupled from this analysis fetch) — so we
  // detect it by diffing against the last level we saw this user at,
  // cached locally. Same one-time-celebration shape as
  // ReportScreen's `@discipline_phase_celebrated`, but a number so it works
  // across every level transition, not just once.
  const loadParentSkillLevel = async () => {
    try {
      const info = await authService.getParentSkillLevel();
      setParentLevel(info.currentLevel);
      setQualifyingCount(info.level5QualifyingCount);

      const seenRaw = await userStorage.getItem('@parent_skill_level_seen');
      const seenLevel = seenRaw ? parseInt(seenRaw, 10) : null;
      if (seenLevel != null && info.currentLevel > seenLevel) {
        setLevelUpInfo({ from: seenLevel as ParentSkillLevel, to: info.currentLevel });
      }
      if (seenLevel == null || info.currentLevel > seenLevel) {
        await userStorage.setItem('@parent_skill_level_seen', String(info.currentLevel));
      }
    } catch (err) {
      // Keep default level 1 if fetch fails
    }
  };

  // Non-critical: finds the previous completed session to diff the score
  // against. Failing silently (no previous session, offline, etc.) just
  // means the delta falls back gracefully.
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

  // Today's Goal — prefers the same deterministic, level-gated goal shown
  // on ReportDetailScreen's "Tomorrow's Goal" card (see levelGoalEngine.cjs).
  // Falls back to a client-derived version, keyed off parentLevel + this
  // session's raw counts, for sessions analyzed before that field existed.
  const goalDirective = reportData.mode === 'PDI'
    ? reportData.pdiTomorrowGoalDirective ?? null
    : reportData.tomorrowGoalDirective ?? null;
  const skillLabelKey = goalDirective ? GOAL_TYPE_SKILL_LABEL_KEY[goalDirective.goalType || ''] : undefined;
  const goal: DerivedGoal = goalDirective
    ? {
        focusSkill: skillLabelKey
          ? t(`report.skillLabel.${skillLabelKey}`)
          : t(`profileReport.levels.${PARENT_SKILL_LEVEL_KEYS[parentLevel]}.skill`),
        currentNumber: goalDirective.currentNumber,
        targetNumber: goalDirective.targetNumber ?? null,
        description: goalDirective.actionPrompt || '',
        direction: REDUCE_GOAL_TYPES.has(goalDirective.goalType || '') ? 'reduce' : 'build',
        goalType: goalDirective.goalType || null,
      }
    : deriveGoalFromLevel(parentLevel, reportData.stats, reportData.mode, t);

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

        {/* Glance strip: Emotional Deposit + Parenting Level */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.depositCard]}>
            <View style={styles.depositBars} pointerEvents="none">
              <View style={[styles.depositBar, { height: 14 }]} />
              <View style={[styles.depositBar, { height: 22 }]} />
              <View style={[styles.depositBar, { height: 32 }]} />
            </View>
            <View style={styles.statHeaderRow}>
              <View style={styles.statIconCircle}>
                <MaterialCommunityIcons name="currency-usd" size={16} color={COLORS.mainPurple} />
              </View>
              <Text style={styles.statLabel}>{t('reportV2.depositLabel')}</Text>
            </View>
            <Text style={styles.depositValue}>+{score}</Text>
            {scoreDelta != null && (
              <View style={styles.statDeltaRow}>
                <Ionicons name={scoreDelta >= 0 ? 'arrow-up' : 'arrow-down'} size={14} color={scoreDelta >= 0 ? '#10B981' : '#DC2626'} />
                <Text style={[styles.statDeltaText, { color: scoreDelta >= 0 ? '#10B981' : '#DC2626' }]}>
                  {t('reportV2.deltaToday', { count: Math.abs(scoreDelta) })}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={[styles.statCard, styles.levelChip]} activeOpacity={0.85} onPress={handleLevelCardPress}>
            <MaterialCommunityIcons name="medal-outline" size={40} color="#CBA76A" style={styles.levelChipMedal} />
            <View style={styles.statHeaderRow}>
              <View style={styles.statIconCircle}>
                <Ionicons name="star-outline" size={15} color="#9A805D" />
              </View>
              <Text style={[styles.statLabel, styles.levelChipLabel]}>{t('reportV2.levelLabel')}</Text>
            </View>
            <Text style={styles.levelChipValue}>{parentLevel}</Text>
            <Text style={styles.levelChipName}>{t(`profileReport.levels.${PARENT_SKILL_LEVEL_KEYS[parentLevel]}.title`)}</Text>
            {parentLevel === 7 && (
              <View style={styles.levelChipProgressRow}>
                <View style={styles.levelChipProgressTrack}>
                  <View style={[styles.levelChipProgressFill, { width: `${(qualifyingCount / 2) * 100}%` }]} />
                </View>
                <Text style={styles.levelChipProgressText}>{qualifyingCount}/2</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Today's Goal — spotlight card */}
        {goal.focusSkill && (
          <View style={styles.goalCard}>
            <View style={styles.goalRings} pointerEvents="none">
              <View style={styles.goalRingOuter}>
                <View style={styles.goalRingMiddle}>
                  <View style={styles.goalRingInner} />
                </View>
              </View>
            </View>

            <View style={styles.goalHeaderRow}>
              <View style={styles.goalIconCircle}>
                <MaterialCommunityIcons name="bullseye-arrow" size={16} color={COLORS.tealAccent} />
              </View>
              <Text style={styles.goalLabel}>{t('reportV2.todaysGoal')}</Text>
            </View>

            <Text style={styles.goalTitle}>{goal.focusSkill}</Text>
            {goal.description && <Text style={styles.goalDescription}>{goal.description}</Text>}

            {goal.currentNumber != null && (
              <>
                <View style={styles.goalNumbersRow}>
                  <View style={styles.goalNumberBox}>
                    <Text style={styles.goalNumberValue}>{goal.currentNumber}</Text>
                    <Text style={styles.goalNumberLabel}>{t('reportDetail.tomorrowGoal.todayLabel')}</Text>
                  </View>
                  {goal.targetNumber != null && (
                    <>
                      <Ionicons name="arrow-forward" size={20} color={COLORS.tealAccent} style={styles.goalArrow} />
                      <View style={[styles.goalNumberBox, styles.goalTargetBox]}>
                        <Text style={[styles.goalNumberValue, styles.goalTargetValue]}>{goal.targetNumber}</Text>
                        <Text style={[styles.goalNumberLabel, styles.goalTargetLabel]}>{t('reportV2.aimForLabel')}</Text>
                      </View>
                    </>
                  )}
                </View>

                {typeof goal.targetNumber === 'number' && (() => {
                  const achieved = goal.direction === 'build'
                    ? goal.currentNumber >= goal.targetNumber
                    : goal.currentNumber <= goal.targetNumber;
                  const remaining = Math.abs(goal.targetNumber - goal.currentNumber);
                  return (
                    <View style={styles.goalStatusRow}>
                      <View style={styles.goalCheckCircle}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                      <Text style={styles.goalStatusText}>
                        {achieved ? (
                          t('reportV2.goalAchievedShort')
                        ) : (
                          <Trans
                            i18nKey="reportV2.goalRemaining"
                            values={{ count: remaining }}
                            components={[<Text style={styles.goalStatusBold} />]}
                          />
                        )}
                      </Text>
                    </View>
                  );
                })()}
              </>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.continueButton} onPress={handleContinueToCoaching} activeOpacity={0.85}>
          <MaterialCommunityIcons name="trophy-outline" size={20} color="#FFFFFF" />
          <Text style={styles.continueButtonText}>{t('reportV2.continueToCoaching')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* TEMP DEBUG — preview the level-up animation on demand. Remove before merging. */}
        <TouchableOpacity
          style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#333', alignItems: 'center' }}
          onPress={() => {
            const maxLevel = PARENT_SKILL_LEVEL_ORDER[PARENT_SKILL_LEVEL_ORDER.length - 1];
            const to = Math.min(parentLevel + 1, maxLevel) as ParentSkillLevel;
            setLevelUpInfo({ from: parentLevel, to });
          }}
        >
          <Text style={{ color: '#FFFFFF', fontFamily: FONTS.bold }}>Preview Level Up</Text>
        </TouchableOpacity>
      </ScrollView>

      {levelUpInfo && (
        <LevelUpModal
          visible
          fromLevel={levelUpInfo.from}
          toLevel={levelUpInfo.to}
          onDismiss={() => setLevelUpInfo(null)}
        />
      )}
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

  // ── Glance strip: Deposit + Level ──
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    minHeight: 150,
    borderRadius: 22,
    padding: 16,
    overflow: 'hidden',
  },
  depositCard: {
    backgroundColor: COLORS.cardPurple,
  },
  depositBars: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    opacity: 0.5,
  },
  depositBar: {
    width: 9,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    backgroundColor: '#C7C4F9',
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.mainPurple,
  },
  depositValue: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.mainPurple,
    marginTop: 10,
  },
  statDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  statDeltaText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  levelChip: {
    backgroundColor: COLORS.neutralTint,
  },
  levelChipMedal: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    opacity: 0.6,
  },
  levelChipLabel: {
    color: '#8A7F6E',
  },
  levelChipValue: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.textDark,
    marginTop: 10,
  },
  levelChipName: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  levelChipProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  levelChipProgressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#E5D9FA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelChipProgressFill: {
    height: '100%',
    backgroundColor: COLORS.mainPurple,
    borderRadius: 3,
  },
  levelChipProgressText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.mainPurple,
  },

  // ── Today's Goal — spotlight card ──
  goalCard: {
    backgroundColor: COLORS.tealTint,
    borderRadius: 28,
    padding: 22,
    marginBottom: 24,
    overflow: 'hidden',
  },
  goalRings: {
    position: 'absolute',
    right: -40,
    top: -40,
  },
  goalRingOuter: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 14,
    borderColor: '#C7EBE6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalRingMiddle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 14,
    borderColor: '#C7EBE6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalRingInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D9F2EE',
  },
  goalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.tealAccent,
  },
  goalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textDark,
    marginTop: 12,
  },
  goalDescription: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 21,
  },
  goalNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  goalNumberBox: {
    minWidth: 64,
  },
  goalNumberValue: {
    fontFamily: FONTS.bold,
    fontSize: 34,
    color: COLORS.textDark,
    lineHeight: 38,
  },
  goalNumberLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  goalArrow: {
    marginHorizontal: 14,
  },
  goalTargetBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  goalTargetValue: {
    color: COLORS.tealAccent,
  },
  goalTargetLabel: {
    color: COLORS.tealAccent,
    textAlign: 'center',
  },
  goalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  goalCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.tealAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalStatusText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
  },
  goalStatusBold: {
    fontFamily: FONTS.bold,
    color: COLORS.tealAccent,
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
