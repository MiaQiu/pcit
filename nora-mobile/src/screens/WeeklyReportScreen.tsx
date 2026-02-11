/**
 * WeeklyReportScreen
 * 7-page weekly recap flow with segmented progress bar.
 * Page 1: Summary headline with dragon illustration.
 * Page 2: Emotional Bank Account Deposits (weekly session summary).
 * Page 3: Skill celebration with scenario cards.
 * Page 4: Weekly moments highlight carousel.
 * Page 5: Child development milestones.
 * Page 6: Next week's focus with expandable explanation.
 * Page 7: Quick check-in (mood + issue ratings).
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from '../components/ProgressBar';
import { MomentPlayer } from '../components/MomentPlayer';
import { COLORS, FONTS, DRAGON_PURPLE } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService, useAuthService } from '../contexts/AppContext';
import { WeeklyReportData } from '@nora/core';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_PAGES = 7;

export const WeeklyReportScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'WeeklyReport'>>();
  const recordingService = useRecordingService();
  const authService = useAuthService();
  const [currentPage, setCurrentPage] = useState(1);
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [childIssues, setChildIssues] = useState<string[]>([]);
  const [childName, setChildName] = useState('Your Child');
  const [loading, setLoading] = useState(true);
  const [moodSelection, setMoodSelection] = useState<string | null>(null);
  const [issueRatings, setIssueRatings] = useState<Record<string, string>>({});
  const [checkinSaved, setCheckinSaved] = useState(false);

  useEffect(() => {
    loadReport();
    loadChildIssues();
    loadChildName();
  }, []);

  const loadChildName = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user.childName) setChildName(user.childName);
    } catch {}
  };

  const loadChildIssues = async () => {
    try {
      const { issues } = await authService.getChildIssues();
      const issueNames = issues.map((i) => {
        if (i.userIssues) {
          try {
            const parsed = JSON.parse(i.userIssues);
            if (Array.isArray(parsed)) return parsed[0];
          } catch {}
        }
        return i.strategy.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase());
      }).filter(Boolean);
      setChildIssues(issueNames);
    } catch (error) {
      console.log('Failed to load child issues:', error);
    }
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      const { reportId } = route.params;

      let reportData: WeeklyReportData | null = null;

      if (reportId === 'latest') {
        const { reports } = await recordingService.getVisibleWeeklyReports();
        if (reports.length > 0) {
          reportData = await recordingService.getWeeklyReport(reports[0].id);
        }
      } else {
        reportData = await recordingService.getWeeklyReport(reportId);
      }

      if (reportData) {
        setReport(reportData);
        if (reportData.moodSelection) setMoodSelection(reportData.moodSelection);
        if (reportData.issueRatings) setIssueRatings(reportData.issueRatings);
      }
    } catch (error) {
      console.log('Failed to load weekly report:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCheckin = async () => {
    if (!report || checkinSaved) return;
    try {
      await recordingService.saveWeeklyCheckin(report.id, {
        moodSelection,
        issueRatings: Object.keys(issueRatings).length > 0 ? issueRatings : null,
      });
      setCheckinSaved(true);
    } catch (error) {
      console.log('Failed to save check-in:', error);
    }
  };

  const handleContinue = async () => {
    if (currentPage < TOTAL_PAGES) {
      setCurrentPage(currentPage + 1);
    } else {
      await saveCheckin();
      navigation.goBack();
    }
  };

  const handleClose = async () => {
    if (currentPage === TOTAL_PAGES && (moodSelection || Object.keys(issueRatings).length > 0)) {
      await saveCheckin();
    }
    navigation.goBack();
  };

  // ─── Page 1: Headline ────────────────────────────────────────────────
  const renderPage1 = () => (
    <View style={styles.page1Content}>
      <View style={styles.page1TextContent}>
        <Text style={styles.page1Subtitle}>Weekly Recap</Text>
        <Text style={styles.page1Title}>
          {report?.headline || `${childName}'s Weekly Recap`}
        </Text>
      </View>

      <View style={styles.page1IllustrationContainer}>
        <View style={styles.page1IllustrationCircle}>
          <Image
            source={DRAGON_PURPLE}
            style={styles.page1IllustrationImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );

  // ─── Page 2: Emotional Bank Account Deposits ─────────────────────────
  const renderPage2 = () => {
    if (!report) return null;

    return (
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Your Weekly Emotional Bank Account Deposits</Text>

        {/* Total Deposits Card */}
        <View style={styles.card}>
          <Text style={styles.totalLabel}>Total deposits</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalNumber}>{report.totalDeposits}</Text>
            <View style={styles.dragonAvatarContainer}>
              <Image
                source={DRAGON_PURPLE}
                style={styles.dragonAvatarImage}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.totalTagline}>Small moments. Big returns.</Text>
        </View>

        {/* Breakdown */}
        <Text style={styles.sectionTitle}>Your deposits breakdown</Text>

        <View style={styles.depositGrid}>
          <View style={styles.depositCard}>
            <View style={styles.depositCardHeader}>
              <View style={[styles.depositIconCircle, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="time-outline" size={20} color="#6366F1" />
              </View>
              <Text style={styles.depositValue}>{report.massageTimeMinutes}m</Text>
            </View>
            <Text style={styles.depositLabel}>Massage time</Text>
            <Text style={styles.depositDesc}>
              Time spent co-regulating with warmth and presence.
            </Text>
          </View>

          <View style={styles.depositCard}>
            <View style={styles.depositCardHeader}>
              <View style={[styles.depositIconCircle, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="ribbon-outline" size={20} color="#EA580C" />
              </View>
              <Text style={styles.depositValue}>{report.praiseCount}</Text>
            </View>
            <Text style={styles.depositLabel}>Confidence Boost</Text>
            <Text style={styles.depositDesc}>
              Praise that helped {childName} feel capable and proud.
            </Text>
          </View>

          <View style={styles.depositCard}>
            <View style={styles.depositCardHeader}>
              <View style={[styles.depositIconCircle, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="chatbox-outline" size={20} color={COLORS.mainPurple} />
              </View>
              <Text style={styles.depositValue}>{report.echoCount}</Text>
            </View>
            <Text style={styles.depositLabel}>Being heard (Echo)</Text>
            <Text style={styles.depositDesc}>
              You reflected feelings so they felt understood.
            </Text>
          </View>

          <View style={styles.depositCard}>
            <View style={styles.depositCardHeader}>
              <View style={[styles.depositIconCircle, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="eye-outline" size={20} color="#DC2626" />
              </View>
              <Text style={styles.depositValue}>{report.narrateCount}</Text>
            </View>
            <Text style={styles.depositLabel}>Being seen (Narrate)</Text>
            <Text style={styles.depositDesc}>
              You described what was happening without judgment.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  // ─── Page 3: Skill Celebration ───────────────────────────────────────
  const renderPage3 = () => {
    const cards = report?.scenarioCards || [];

    return (
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>{report?.skillCelebrationTitle || 'Skill Celebration'}</Text>

        <View style={styles.scenarioContainer}>
          {cards.map((card: any, index: number) => (
            <View key={index} style={styles.scenarioCard}>
              <View style={styles.scenarioCardHeader}>
                <View style={styles.scenarioCardTextContent}>
                  <Text style={styles.scenarioLabel}>{card.label}</Text>
                  <Text style={styles.scenarioBody}>{card.body}</Text>
                </View>
                <View style={styles.scenarioIconCircle}>
                  <Ionicons name="bulb-outline" size={18} color={COLORS.mainPurple} />
                </View>
              </View>
              {card.exampleScript && (
                <View style={styles.scenarioExampleBox}>
                  <Text style={styles.scenarioExampleLabel}>Example script</Text>
                  <Text style={styles.scenarioExampleText}>{card.exampleScript}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  // ─── Page 4: Weekly Moments Highlight ────────────────────────────────
  const renderPage4 = () => {
    const topMoments = report?.topMoments || [];

    if (topMoments.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.pageTitle}>Weekly Moments Highlight</Text>
          <Text style={styles.emptyStateText}>No sessions this week</Text>
        </View>
      );
    }

    const CARD_WIDTH = SCREEN_WIDTH * 0.78;

    return (
      <View style={styles.page4Wrapper}>
        <Text style={styles.pageTitle}>Weekly Moments Highlight</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.momentScrollContent}
          snapToInterval={CARD_WIDTH + 12}
          decelerationRate="fast"
        >
          {topMoments.map((moment, index) => (
            <View key={index} style={[styles.momentCard, { width: CARD_WIDTH }]}>
              {/* Date header */}
              <View style={styles.momentDateRow}>
                <View style={styles.momentDayBadge}>
                  <Text style={styles.momentDayText}>{moment.dayLabel}</Text>
                </View>
                <Text style={styles.momentDateText}>{moment.dateLabel}</Text>
              </View>

              {/* Tag */}
              {moment.tag ? (
                <View style={styles.momentTagRow}>
                  <Ionicons name="trending-up" size={14} color={COLORS.mainPurple} />
                  <Text style={styles.momentTagText}>{moment.tag}</Text>
                </View>
              ) : null}

              {/* Session title */}
              <Text style={styles.momentSessionTitle}>{moment.sessionTitle}</Text>

              {/* Top moment quote */}
              <View style={styles.momentQuoteBox}>
                <Text style={styles.momentQuoteLabel}>Top moment</Text>
                <Text style={styles.momentQuoteText}>"{moment.quote}"</Text>
                {moment.celebration ? (
                  <Text style={styles.momentCelebration}>{moment.celebration}</Text>
                ) : null}

                {moment.audioUrl && moment.startTime != null && moment.endTime != null && (
                  <MomentPlayer
                    audioUrl={moment.audioUrl}
                    startTime={moment.startTime}
                    endTime={moment.endTime}
                  />
                )}
              </View>

              {/* Footer */}
              <View style={styles.momentFooter}>
                <View>
                  <Text style={styles.momentFooterLabel}>Saved</Text>
                  <Text style={styles.momentFooterTitle}>Emotional memory</Text>
                </View>
                <View style={styles.momentCheckRow}>
                  <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                  <Text style={styles.momentCheckText}>Yes</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ─── Page 5: What We Learnt (Milestones) ─────────────────────────────
  const renderPage5 = () => {
    const milestones = report?.milestones || [];

    return (
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>What We Learnt About {childName}</Text>

        <View style={styles.card}>
          <Text style={styles.milestoneSubtext}>
            This is about child growth — not perfection.
          </Text>

          {milestones.length > 0 ? (
            milestones.map((milestone: any, index: number) => (
              <View key={index} style={[styles.milestoneRow, index < milestones.length - 1 && styles.milestoneRowBorder]}>
                <View style={[styles.milestoneIconCircle, milestone.status === 'ACHIEVED' ? styles.milestoneIconAchieved : styles.milestoneIconEmerging]}>
                  <Ionicons
                    name={milestone.status === 'ACHIEVED' ? 'sparkles' : 'trending-up'}
                    size={20}
                    color={milestone.status === 'ACHIEVED' ? '#D97706' : '#7C3AED'}
                  />
                </View>
                <View style={styles.milestoneTextContent}>
                  <View style={styles.milestoneTitleRow}>
                    <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                    <View style={[styles.milestoneBadge, milestone.status === 'ACHIEVED' ? styles.milestoneBadgeAchieved : styles.milestoneBadgeEmerging]}>
                      <Text style={[styles.milestoneBadgeText, milestone.status === 'ACHIEVED' ? styles.milestoneBadgeTextAchieved : styles.milestoneBadgeTextEmerging]}>
                        {milestone.status === 'ACHIEVED' ? 'Achieved' : 'Emerging'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.milestoneActionTip}>
                    {milestone.actionTip || "Keep noticing tiny shifts — they're the building blocks."}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.milestoneRow}>
              <View style={[styles.milestoneIconCircle, styles.milestoneIconEmerging]}>
                <Ionicons name="sparkles" size={20} color="#7C3AED" />
              </View>
              <View style={styles.milestoneTextContent}>
                <Text style={styles.milestoneTitle}>No milestones yet</Text>
                <Text style={styles.milestoneActionTip}>
                  Keep playing together — milestones will appear as we observe more sessions.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // ─── Page 6: Next Week's Focus ───────────────────────────────────────
  const [whyExpanded, setWhyExpanded] = useState(false);

  const renderPage6 = () => (
    <ScrollView
      style={styles.pageScroll}
      contentContainerStyle={styles.pageScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Next Week's Focus</Text>

      <View style={styles.card}>
        {/* Header */}
        <View style={styles.focusHeaderRow}>
          <Text style={styles.focusLabel}>Next week's gentle focus</Text>
          <View style={styles.focusIconCircle}>
            <Ionicons name="sparkles" size={20} color="#EA580C" />
          </View>
        </View>

        {/* Focus description */}
        <Text style={styles.focusHeading}>
          {report?.focusHeading || 'Keep practicing your skills this week.'}
        </Text>
        <Text style={styles.focusSubtext}>
          {report?.focusSubtext || "You don't need to be perfect — just consistent."}
        </Text>

        {/* Why this matters — expandable */}
        <TouchableOpacity
          style={styles.whyToggle}
          onPress={() => setWhyExpanded(!whyExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.whyToggleContent}>
            <Ionicons name="bulb-outline" size={18} color="#6B7280" />
            <View style={{ flex: 1 }}>
              <Text style={styles.whyToggleTitle}>Why this matters</Text>
              <Text style={styles.whyToggleSubtitle}>A quick nervous-system explanation.</Text>
            </View>
            <Ionicons
              name={whyExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#9CA3AF"
            />
          </View>
        </TouchableOpacity>

        {whyExpanded && report?.whyExplanation && (
          <View style={styles.whyBody}>
            <Text style={styles.whyBodyText}>
              {report.whyExplanation}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  // ─── Page 7: Quick Check-in ──────────────────────────────────────────
  const MOODS = [
    { label: 'Grounded', emoji: '🌿' },
    { label: 'Tired', emoji: '🥱' },
    { label: 'Stretched', emoji: '🫠' },
    { label: 'Hopeful', emoji: '✨' },
  ];

  const RATINGS = ['Better', 'Same', 'Worse'];

  const renderPage7 = () => {
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    return (
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Quick Check-in</Text>

        {/* Mood section */}
        <View style={styles.card}>
          <Text style={styles.checkinQuestion}>How are you doing this week?</Text>
          <View style={styles.moodGrid}>
            {MOODS.map((mood) => (
              <TouchableOpacity
                key={mood.label}
                style={[
                  styles.moodChip,
                  moodSelection === mood.label && styles.moodChipSelected,
                ]}
                onPress={() => setMoodSelection(mood.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={[
                  styles.moodLabel,
                  moodSelection === mood.label && styles.moodLabelSelected,
                ]}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.checkinDisclaimer}>
            This isn't graded — it helps your coach tailor the next suggestions.
          </Text>
        </View>

        {/* Issue improvement section */}
        {childIssues.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.checkinQuestion}>
              Have you seen improvement in the areas you're working on?
            </Text>
            {childIssues.map((issue, index) => (
              <View key={issue} style={[styles.issueRow, index < childIssues.length - 1 && styles.issueRowBorder]}>
                <Text style={styles.issueLabel}>{capitalize(issue)}</Text>
                <View style={styles.ratingButtons}>
                  {RATINGS.map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      style={[
                        styles.ratingChip,
                        issueRatings[issue] === rating && styles.ratingChipSelected,
                      ]}
                      onPress={() => setIssueRatings((prev) => ({ ...prev, [issue]: rating }))}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.ratingText,
                        issueRatings[issue] === rating && styles.ratingTextSelected,
                      ]}>{rating}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  // ─── Page Router ─────────────────────────────────────────────────────
  const renderPageContent = () => {
    switch (currentPage) {
      case 1: return renderPage1();
      case 2: return renderPage2();
      case 3: return renderPage3();
      case 4: return renderPage4();
      case 5: return renderPage5();
      case 6: return renderPage6();
      case 7: return renderPage7();
      default: return null;
    }
  };

  // ─── Loading / Empty States ──────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
          <Text style={styles.loadingText}>Loading report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyStateText}>No report available</Text>
          <TouchableOpacity onPress={handleClose} style={styles.goBackButton}>
            <Text style={styles.goBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <View style={styles.progressBarWrapper}>
            <ProgressBar
              totalSegments={TOTAL_PAGES}
              currentSegment={currentPage}
            />
          </View>
        </View>

        {/* Page Content */}
        {renderPageContent()}

        {/* Bottom Button */}
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.bottomButtonText}>
            {currentPage === TOTAL_PAGES ? 'Submit' : 'Continue →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  closeButton: {
    padding: 4,
  },
  progressBarWrapper: {
    flex: 1,
  },

  // Shared page styles
  pageScroll: {
    flex: 1,
    marginTop: 8,
  },
  pageScrollContent: {
    paddingBottom: 24,
  },
  pageTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textDark,
    marginBottom: 20,
    lineHeight: 32,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 12,
  },

  // Card — matches ReportScreen
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 32,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },

  // Loading / Empty
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyStateText: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: '#9CA3AF',
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textDark,
    marginTop: 8,
  },
  goBackButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  goBackText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.mainPurple,
  },

  // ─── Page 1: Headline ──────────────────────────────────────────────
  page1Content: {
    flex: 1,
    justifyContent: 'center',
  },
  page1TextContent: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  page1Subtitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.mainPurple,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  page1Title: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 34,
  },
  page1IllustrationContainer: {
    alignItems: 'center',
  },
  page1IllustrationCircle: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.4,
    borderRadius: (SCREEN_WIDTH * 0.4) / 2,
    backgroundColor: '#A2DFCB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  page1IllustrationImage: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
  },

  // ─── Page 2: Deposits ──────────────────────────────────────────────
  totalLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalNumber: {
    fontFamily: FONTS.bold,
    fontSize: 42,
    color: COLORS.textDark,
  },
  dragonAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
  },
  dragonAvatarImage: {
    width: 100,
    height: 100,
    marginLeft: -6,
    marginTop: -22,
  },
  totalTagline: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  depositGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  depositCard: {
    width: (SCREEN_WIDTH - 40 - 12) / 2,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  depositCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  depositIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositValue: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textDark,
  },
  depositLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  depositDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 17,
  },

  // ─── Page 3: Skill Celebration ─────────────────────────────────────
  scenarioContainer: {
    gap: 12,
  },
  scenarioCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  scenarioCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  scenarioCardTextContent: {
    flex: 1,
    marginRight: 12,
  },
  scenarioLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.mainPurple,
    marginBottom: 6,
  },
  scenarioBody: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  scenarioIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  scenarioExampleBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
  },
  scenarioExampleLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  scenarioExampleText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },

  // ─── Page 4: Moments Highlight ─────────────────────────────────────
  page4Wrapper: {
    flex: 1,
    marginTop: 8,
  },
  momentScrollContent: {
    paddingRight: 20,
    gap: 12,
  },
  momentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: 18,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  momentDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  momentDayBadge: {
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  momentDayText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mainPurple,
  },
  momentDateText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
  },
  momentTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  momentTagText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mainPurple,
  },
  momentSessionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textDark,
    marginBottom: 14,
  },
  momentQuoteBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  momentQuoteLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  momentQuoteText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  momentCelebration: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginBottom: 10,
  },
  momentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  momentFooterLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  momentFooterTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textDark,
  },
  momentCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  momentCheckText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#16A34A',
  },

  // ─── Page 5: Milestones ────────────────────────────────────────────
  milestoneSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
  },
  milestoneRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  milestoneIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneIconAchieved: {
    backgroundColor: '#FEF3C7',
  },
  milestoneIconEmerging: {
    backgroundColor: '#EDE9FE',
  },
  milestoneTextContent: {
    flex: 1,
  },
  milestoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  milestoneTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textDark,
    flex: 1,
  },
  milestoneBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
  },
  milestoneBadgeAchieved: {
    backgroundColor: '#FEF3C7',
  },
  milestoneBadgeEmerging: {
    backgroundColor: '#EDE9FE',
  },
  milestoneBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  milestoneBadgeTextAchieved: {
    color: '#D97706',
  },
  milestoneBadgeTextEmerging: {
    color: '#7C3AED',
  },
  milestoneActionTip: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },

  // ─── Page 6: Focus ─────────────────────────────────────────────────
  focusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  focusLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#9CA3AF',
  },
  focusIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusHeading: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
    lineHeight: 26,
    marginBottom: 8,
  },
  focusSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 21,
  },
  whyToggle: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
  },
  whyToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  whyToggleTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  whyToggleSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  whyBody: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  whyBodyText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },

  // ─── Page 7: Check-in ─────────────────────────────────────────────
  checkinQuestion: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: (SCREEN_WIDTH - 40 - 10) / 2,
  },
  moodChipSelected: {
    borderColor: COLORS.mainPurple,
    backgroundColor: '#F9F5FF',
  },
  moodEmoji: {
    fontSize: 20,
  },
  moodLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#374151',
  },
  moodLabelSelected: {
    color: COLORS.mainPurple,
  },
  checkinDisclaimer: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  issueRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  issueLabel: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textDark,
    flex: 1,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  ratingChip: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ratingChipSelected: {
    borderColor: COLORS.mainPurple,
    backgroundColor: '#F9F5FF',
  },
  ratingText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#374151',
  },
  ratingTextSelected: {
    color: COLORS.mainPurple,
  },

  // ─── Bottom Button ─────────────────────────────────────────────────
  bottomButton: {
    position: 'absolute',
    bottom: 1,
    left: 20,
    right: 20,
    height: 56,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: COLORS.white,
  },
});
