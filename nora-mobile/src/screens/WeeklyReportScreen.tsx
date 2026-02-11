/**
 * WeeklyReportScreen
 * 7-page weekly recap flow with segmented progress bar.
 * Page 1: Summary headline with dragon illustration.
 * Page 2: Emotional Bank Account Deposits (weekly session summary).
 * Pages 3-7: Placeholder content.
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
import { DRAGON_PURPLE } from '../constants/assets';
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
        // Fetch latest visible report
        const { reports } = await recordingService.getVisibleWeeklyReports();
        if (reports.length > 0) {
          reportData = await recordingService.getWeeklyReport(reports[0].id);
        }
      } else {
        reportData = await recordingService.getWeeklyReport(reportId);
      }

      if (reportData) {
        setReport(reportData);
        // Restore previously saved check-in responses
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
      // Save check-in before closing
      await saveCheckin();
      navigation.goBack();
    }
  };

  const handleClose = async () => {
    // Save check-in if user filled anything on the last page
    if (currentPage === TOTAL_PAGES && (moodSelection || Object.keys(issueRatings).length > 0)) {
      await saveCheckin();
    }
    navigation.goBack();
  };

  const renderPage1 = () => (
    <View style={styles.page1Content}>
      <View style={styles.textContent}>
        <Text style={styles.subtitle}>Weekly Recap</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {report?.headline || `${childName}'s Weekly Recap`}
          </Text>
          {/* <Image
            source={DRAGON_PURPLE}
            style={styles.avatarCircle}
            resizeMode="cover"
          /> */}
        </View>
      </View>

      <View style={styles.illustrationContainer}>
        <View style={styles.illustrationCircle}>
          <Image
            source={DRAGON_PURPLE}
            style={styles.illustrationImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );

  const renderPage2 = () => {
    if (!report) return null;

    return (
      <ScrollView
        style={styles.page2Scroll}
        contentContainerStyle={styles.page2ScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.page2Title}>
          Your Weekly Emotional Bank Account Deposits
        </Text>

        {/* Total Deposits Card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total deposits</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalNumber}>{report.totalDeposits}</Text>
            <View style={styles.totalAvatarContainer}>
              <Image
                source={DRAGON_PURPLE}
                style={styles.totalAvatarImage}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.totalTagline}>Small moments. Big returns.</Text>
        </View>

        {/* Breakdown Section */}
        <Text style={styles.breakdownTitle}>Your deposits breakdown</Text>

        <View style={styles.breakdownGrid}>
          {/* Massage Time */}
          <View style={styles.depositCard}>
            <View style={styles.depositCardHeader}>
              <View style={[styles.depositIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="time-outline" size={20} color="#6366F1" />
              </View>
              <Text style={styles.depositValue}>{report.massageTimeMinutes}m</Text>
            </View>
            <Text style={styles.depositLabel}>Massage time</Text>
            <Text style={styles.depositDescription}>
              Time spent co-regulating with warmth and presence.
            </Text>
          </View>

          {/* Confidence Boost (Praise) */}
          <View style={styles.depositCard}>
            <View style={styles.depositCardHeader}>
              <View style={[styles.depositIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="ribbon-outline" size={20} color="#EA580C" />
              </View>
              <Text style={styles.depositValue}>{report.praiseCount}</Text>
            </View>
            <Text style={styles.depositLabel}>Confidence Boost</Text>
            <Text style={styles.depositDescription}>
              Praise that helped Zoey feel capable and proud.
            </Text>
          </View>

          {/* Being Heard (Echo) */}
          <View style={styles.depositCard}>
            <View style={styles.depositCardHeader}>
              <View style={[styles.depositIcon, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="chatbox-outline" size={20} color="#8C49D5" />
              </View>
              <Text style={styles.depositValue}>{report.echoCount}</Text>
            </View>
            <Text style={styles.depositLabel}>Being heard (Echo)</Text>
            <Text style={styles.depositDescription}>
              You reflected feelings so she felt understood.
            </Text>
          </View>

          {/* Being Seen (Narrate) */}
          <View style={styles.depositCard}>
            <View style={styles.depositCardHeader}>
              <View style={[styles.depositIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="eye-outline" size={20} color="#DC2626" />
              </View>
              <Text style={styles.depositValue}>{report.narrateCount}</Text>
            </View>
            <Text style={styles.depositLabel}>Being seen (Narrate)</Text>
            <Text style={styles.depositDescription}>
              You described what was happening without judgment.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderPage3 = () => {
    const cards = report?.scenarioCards || [];

    return (
      <ScrollView
        style={styles.page3Scroll}
        contentContainerStyle={styles.page3ScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.page3Title}>{report?.skillCelebrationTitle || 'Skill Celebration'}</Text>

        {/* Scenario Cards Container */}
        <View style={styles.scenarioContainer}>
          {cards.map((card: any, index: number) => (
            <View key={index} style={styles.scenarioCard}>
              <View style={styles.scenarioCardHeader}>
                <View style={styles.scenarioCardText}>
                  <Text style={styles.scenarioLabel}>{card.label}</Text>
                  <Text style={styles.scenarioBody}>{card.body}</Text>
                </View>
                <View style={styles.audioIcon}>
                  <Ionicons name="bar-chart-outline" size={20} color="#8C49D5" />
                </View>
              </View>
              {card.exampleScript && (
                <View style={styles.exampleScript}>
                  <Text style={styles.exampleScriptLabel}>Example script</Text>
                  <Text style={styles.exampleScriptText}>{card.exampleScript}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderPage4 = () => {
    const topMoments = report?.topMoments || [];

    if (topMoments.length === 0) {
      return (
        <View style={styles.placeholderContent}>
          <Text style={styles.page4Title}>Weekly Moments Highlight</Text>
          <Text style={styles.placeholderText}>No sessions this week</Text>
        </View>
      );
    }

    const CARD_WIDTH = SCREEN_WIDTH * 0.78;

    return (
      <View style={styles.page4Wrapper}>
        <Text style={styles.page4Title}>Weekly Moments Highlight</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.page4ScrollContent}
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
                  <Ionicons name="bar-chart-outline" size={14} color="#8C49D5" />
                  <Text style={styles.momentTagText}>{moment.tag}</Text>
                </View>
              ) : null}

              {/* Session title */}
              <Text style={styles.momentSessionTitle}>{moment.sessionTitle}</Text>

              {/* Top moment quote section */}
              <View style={styles.momentQuoteCard}>
                <Text style={styles.momentQuoteLabel}>Top moment</Text>
                <Text style={styles.momentQuoteText}>"{moment.quote}"</Text>
                {moment.celebration ? (
                  <Text style={styles.momentCelebration}>{moment.celebration}</Text>
                ) : null}

                {/* Audio player */}
                {moment.audioUrl && moment.startTime != null && moment.endTime != null && (
                  <MomentPlayer
                    audioUrl={moment.audioUrl}
                    startTime={moment.startTime}
                    endTime={moment.endTime}
                  />
                )}
              </View>

              {/* Saved / Emotional memory footer */}
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

  const renderPage5 = () => {
    const milestones = report?.milestones || [];

    return (
      <ScrollView
        style={styles.page5Scroll}
        contentContainerStyle={styles.page5ScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.page5Title}>What We learnt about {childName}</Text>

        {/* Milestones container */}
        <View style={styles.milestonesContainer}>
          <Text style={styles.milestonesSubtext}>
            This is about child growth — not perfection.
          </Text>

          {milestones.length > 0 ? (
            milestones.map((milestone: any, index: number) => (
              <View key={index} style={styles.milestoneCard}>
                <View style={styles.milestoneIcon}>
                  <Ionicons
                    name={milestone.status === 'ACHIEVED' ? 'sparkles' : 'trending-up'}
                    size={22}
                    color="#3B82F6"
                  />
                </View>
                <View style={styles.milestoneTextContent}>
                  <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                  <Text style={styles.milestoneActionTip}>
                    {milestone.actionTip || "Keep noticing tiny shifts — they're the building blocks."}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.milestoneCard}>
              <View style={styles.milestoneIcon}>
                <Ionicons name="sparkles" size={22} color="#3B82F6" />
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

  const [whyExpanded, setWhyExpanded] = useState(false);

  const renderPage6 = () => (
    <ScrollView
      style={styles.page6Scroll}
      contentContainerStyle={styles.page6ScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.page6Title}>Next Week's Focus</Text>

      <View style={styles.focusContainer}>
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
          style={styles.whyCard}
          onPress={() => setWhyExpanded(!whyExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.whyHeader}>
            <View>
              <Text style={styles.whyTitle}>Why this matters</Text>
              <Text style={styles.whySubtitle}>A quick nervous-system explanation.</Text>
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
        style={styles.page7Scroll}
        contentContainerStyle={styles.page7ScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.page7Title}>Quick Checkin</Text>

        {/* Mood section */}
        <View style={styles.checkinSection}>
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
          <View style={styles.checkinSection}>
            <Text style={styles.checkinQuestion}>
              Have you seen improvement in the areas you're working on?
            </Text>
            {childIssues.map((issue) => (
              <View key={issue} style={styles.issueRow}>
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

  const renderPageContent = () => {
    switch (currentPage) {
      case 1:
        return renderPage1();
      case 2:
        return renderPage2();
      case 3:
        return renderPage3();
      case 4:
        return renderPage4();
      case 5:
        return renderPage5();
      case 6:
        return renderPage6();
      case 7:
        return renderPage7();
      default:
        return (
          <View style={styles.placeholderContent}>
            <Text style={styles.placeholderText}>Page {currentPage}</Text>
          </View>
        );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.placeholderContent}>
          <ActivityIndicator size="large" color="#8C49D5" />
        </View>
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.placeholderContent}>
          <Text style={styles.placeholderText}>No report available</Text>
          <TouchableOpacity onPress={handleClose} style={{ marginTop: 20 }}>
            <Text style={{ color: '#8C49D5', fontSize: 16 }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header: X button + Progress Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#1F2937" />
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

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Continue →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    padding: 4,
  },
  progressBarWrapper: {
    flex: 1,
  },
  // Page 1
  page1Content: {
    flex: 1,
    justifyContent: 'center',
  },
  textContent: {
    alignItems: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#8C49D5',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  titleRow: {
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  illustrationContainer: {
    alignItems: 'center',
  },
  illustrationCircle: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.45,
    borderRadius: (SCREEN_WIDTH * 0.5) / 2,
    backgroundColor: '#A2DFCB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illustrationImage: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
  },
  // Page 2 — Emotional Bank Account Deposits
  page2Scroll: {
    flex: 1,
    marginTop: 16,
  },
  page2ScrollContent: {
    paddingBottom: 16,
  },
  page2Title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1F2937',
    marginBottom: 24,
  },
  totalCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  totalLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
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
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 40,
    color: '#1F2937',
  },
  totalAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  totalAvatarImage: {
    width: 100,
    height: 100,
    marginLeft: -6,
    marginTop: -22,
  },
  totalTagline: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  breakdownTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 12,
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  depositCard: {
    width: (SCREEN_WIDTH - 64 - 12) / 2,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
  },
  depositCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  depositIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: '#1F2937',
  },
  depositLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  depositDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 17,
  },
  // Page 3 — Narrator praise
  page3Scroll: {
    flex: 1,
    marginTop: 16,
  },
  page3ScrollContent: {
    paddingBottom: 16,
  },
  page3Title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    marginBottom: 20,
  },
  scenarioContainer: {
    backgroundColor: '#EEEDF8',
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  scenarioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  scenarioCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  scenarioCardText: {
    flex: 1,
    marginRight: 12,
  },
  scenarioLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#8C49D5',
    marginBottom: 6,
  },
  scenarioBody: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 22,
  },
  audioIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  exampleScript: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
  },
  exampleScriptLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  exampleScriptText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  // Page 4 — Weekly Moments Highlight
  page4Wrapper: {
    flex: 1,
    marginTop: 16,
  },
  page4Title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    marginBottom: 20,
  },
  page4ScrollContent: {
    paddingRight: 32,
    gap: 12,
  },
  momentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 18,
  },
  momentDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  momentDayBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  momentDayText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#374151',
  },
  momentDateText: {
    fontFamily: 'PlusJakartaSans_400Regular',
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
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#8C49D5',
  },
  momentSessionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#1F2937',
    marginBottom: 12,
  },
  momentQuoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  momentQuoteLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  momentQuoteText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
    marginBottom: 8,
  },
  momentCelebration: {
    fontFamily: 'PlusJakartaSans_400Regular',
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
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#9CA3AF',
  },
  momentFooterTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#1F2937',
  },
  momentCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  momentCheckText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#16A34A',
  },
  // Page 5 — What We learnt about Zoey
  page5Scroll: {
    flex: 1,
    marginTop: 16,
  },
  page5ScrollContent: {
    paddingBottom: 16,
  },
  page5Title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    marginBottom: 20,
  },
  milestonesContainer: {
    backgroundColor: '#EEEDF8',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  milestonesSubtext: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  milestoneCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  milestoneIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneTextContent: {
    flex: 1,
  },
  milestoneTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 4,
  },
  milestoneActionTip: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
  // Page 6 — Next Week's Focus
  page6Scroll: {
    flex: 1,
    marginTop: 16,
  },
  page6ScrollContent: {
    paddingBottom: 16,
  },
  page6Title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    marginBottom: 20,
  },
  focusContainer: {
    backgroundColor: '#EEEDF8',
    borderRadius: 20,
    padding: 18,
  },
  focusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  focusLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#6B7280',
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
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1F2937',
    lineHeight: 25,
    marginBottom: 8,
  },
  focusSubtext: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  whyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
  },
  whyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  whyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 2,
  },
  whySubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#9CA3AF',
  },
  whyBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  whyBodyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },
  // Page 7 — Quick Checkin
  page7Scroll: {
    flex: 1,
    marginTop: 16,
  },
  page7ScrollContent: {
    paddingBottom: 16,
  },
  page7Title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    marginBottom: 20,
  },
  checkinSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  checkinQuestion: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 14,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: (SCREEN_WIDTH - 64 - 36 - 10) / 2,
  },
  moodChipSelected: {
    borderColor: '#8C49D5',
    backgroundColor: '#F9F5FF',
  },
  moodEmoji: {
    fontSize: 18,
  },
  moodLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#374151',
  },
  moodLabelSelected: {
    color: '#8C49D5',
  },
  checkinDisclaimer: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  issueLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  ratingChip: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ratingChipSelected: {
    borderColor: '#8C49D5',
    backgroundColor: '#F9F5FF',
  },
  ratingText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#374151',
  },
  ratingTextSelected: {
    color: '#8C49D5',
  },
  // Placeholder pages
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 20,
    color: '#9CA3AF',
  },
  // Continue button
  button: {
    position: 'absolute',
    bottom: 1,
    left: 32,
    right: 32,
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});
