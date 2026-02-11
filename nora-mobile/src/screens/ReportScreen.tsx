/**
 * ReportScreen
 * Displays daily performance report with skills, tips, and goals
 * Based on Figma design
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, TextInput, LayoutAnimation, Platform, UIManager, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SkillProgressBar } from '../components/SkillProgressBar';
import { Button } from '../components/Button';
import { COLORS, FONTS, DRAGON_PURPLE } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService, useAuthService } from '../contexts/AppContext';
import type { RecordingAnalysis, CoachingCard, MilestoneCelebration } from '@nora/core';
import { LinearGradient } from 'expo-linear-gradient';
import { MarkdownText } from '../utils/MarkdownText';
import { DragonCard } from '../components/DragonCard';
import { MomentPlayer } from '../components/MomentPlayer';

type ReportScreenRouteProp = RouteProp<RootStackParamList, 'Report'>;

// PCIT tag color mapping
const TAG_COLORS: { [key: string]: string } = {
  // CDI - DO tags (green/blue/purple)
  'Praise': '#10B981',
  'Echo': '#3B82F6',
  'Narration': '#8B5CF6',
  'Labeled Praise': '#10B981',

  // CDI - DON'T tags (red/orange)
  'Question': '#EF4444',
  'Command': '#EF4444',
  'Criticism': '#DC2626',
  'Negative Talk': '#DC2626',
  'Direct Command': '#EF4444',
  'Indirect Command': '#F97316',

  // Neutral (gray)
  'NEUTRAL': '#6B7280',
  'Neutral': '#6B7280',
};

const getTagColor = (tag?: string): string => {
  if (!tag) return '#6B7280';
  return TAG_COLORS[tag] || '#6B7280';
};

const getSkillType = (tag?: string): 'desirable' | 'undesirable' | 'neutral' => {
  if (!tag) return 'neutral';

  // Desirable skills
  if (tag === 'Echo' || tag === 'Labeled Praise' || tag === 'Narration' || tag === 'Praise') {
    return 'desirable';
  }

  // Neutral skills
  if (tag === 'NEUTRAL' || tag === 'Neutral') {
    return 'neutral';
  }

  // Everything else is undesirable
  return 'undesirable';
};

// Helper to get skill rating info based on progress value
const getSkillRating = (progress: number): { barColor?: string; textColor?: string; suffix?: string } => {
  if (progress <= 5) {
    return { barColor: '#852221', textColor: '#852221', suffix: '(Pay attention)' };
  } else if (progress <= 8) {
    return { barColor: '#6750A4', textColor: '#6750A4', suffix: '(Good)' };
  } else {
    return { barColor: '#6750A4', textColor: '#6750A4', suffix: '(Excellent)' };
  }
};

// Light background colors for different speakers
const SPEAKER_COLORS = [
  '#E3F2FD', // Light blue
  '#FFF3E0', // Light orange
  '#F3E5F5', // Light purple
  '#E8F5E9', // Light green
];

const getSpeakerMappings = (transcript: any[]) => {
  const labelMapping: { [key: string]: string } = {};
  const colorMapping: { [key: string]: string } = {};
  const seenSpeakers = new Set<string>();
  const adultSpeakers: string[] = [];
  const childSpeakers: string[] = [];
  let colorIndex = 0;

  // Group speakers by role (only add each speaker once)
  transcript.forEach(segment => {
    const role = segment.role;
    if (!seenSpeakers.has(segment.speaker)) {
      seenSpeakers.add(segment.speaker);
      if (role === 'adult') {
        adultSpeakers.push(segment.speaker);
      } else if (role === 'child') {
        childSpeakers.push(segment.speaker);
      }
    }
  });

  // Sort to ensure consistent ordering
  adultSpeakers.sort();
  childSpeakers.sort();

  // Assign labels and colors
  adultSpeakers.forEach((speaker, index) => {
    labelMapping[speaker] = adultSpeakers.length > 1 ? `Adult ${index + 1}` : 'Adult';
    colorMapping[speaker] = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
    colorIndex++;
  });
  childSpeakers.forEach((speaker, index) => {
    labelMapping[speaker] = childSpeakers.length > 1 ? `Child ${index + 1}` : 'Child';
    colorMapping[speaker] = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
    colorIndex++;
  });

  return { labelMapping, colorMapping };
};

// Helper to add empty lines between sentences
const formatWithLineBreaks = (text: string): string => {
  if (!text) return text;
  // Replace sentence endings (. ! ?) followed by a space and capital letter with double newlines
  return text.replace(/([.!?])\s+(?=[A-Z])/g, '$1\n\n');
};

// Helper to add new lines when seeing '***'
const formatWithStarBreaks = (text: string): string => {
  if (!text) return text;
  return text.replace(/\*\*\*/g, '\n\n');
};

// Helper to strip PCIT tags (e.g., LP, IC, DC, RF, BD) from quote text
const stripPcitTags = (text: string): string => {
  if (!text) return text;
  // Remove tags at the end of lines (e.g., "Great job! LP" -> "Great job!")
  return text
    .split('\n')
    .map(line => line.replace(/\s+(LP|IC|DC|RF|BD|NT|QU|CM|CR|UP|NE|EC|PR|NA)$/gi, ''))
    .join('\n')
    .trim();
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NEGATIVE_REASONS = ['Too generic', 'Not accurate', 'Hard to understand', 'Missing something'];

const getExampleUtterances = (exampleIndex: number, transcript: any[]) => {
  const result: { utterance: any; originalIndex: number }[] = [];
  if (exampleIndex > 0 && transcript[exampleIndex - 1]) {
    result.push({ utterance: transcript[exampleIndex - 1], originalIndex: exampleIndex - 1 });
  }
  if (transcript[exampleIndex]) {
    result.push({ utterance: transcript[exampleIndex], originalIndex: exampleIndex });
  }
  if (exampleIndex < transcript.length - 1 && transcript[exampleIndex + 1]) {
    result.push({ utterance: transcript[exampleIndex + 1], originalIndex: exampleIndex + 1 });
  }
  return result;
};

// Performance badge color mapping
const PERFORMANCE_COLORS: { [key: string]: { bg: string; text: string } } = {
  'Excellent': { bg: '#DCFCE7', text: '#15803D' },
  'Good': { bg: '#EDE9FE', text: '#6D28D9' },
  'Fair': { bg: '#FEF3C7', text: '#B45309' },
  'Needs Practice': { bg: '#FEE2E2', text: '#B91C1C' },
  'Not Observed': { bg: '#F3F4F6', text: '#6B7280' },
};

const getPerformanceColors = (performance: string) => {
  // Handle composite like "Fair/Good"
  const key = Object.keys(PERFORMANCE_COLORS).find(k =>
    performance.toLowerCase().includes(k.toLowerCase())
  );
  return PERFORMANCE_COLORS[key || 'Not Observed'];
};

/** PDI Coach's Corner — Two Choices Flow skills */
const PDICoachCorner: React.FC<{
  pdiSkills: Array<{ skill: string; performance: string; feedback: string; details: string }>;
  summary?: string | null;
  recordingId: string;
  navigation: any;
}> = ({ pdiSkills, summary, recordingId, navigation }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(prev => prev === index ? null : index);
  };

  return (
    <View>
      <Text style={styles.cardTitle}>Coach's Corner</Text>
      <View style={styles.coachCard}>
        {summary && (
          <Text style={styles.pdiSummaryText}>{summary}</Text>
        )}
        <Text style={styles.pdiSectionSubtitle}>The Two Choices Flow</Text>
        {pdiSkills.map((item, index) => {
          const colors = getPerformanceColors(item.performance);
          const isExpanded = expandedIndex === index;

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              onPress={() => toggleExpand(index)}
              style={[
                styles.pdiSkillItem,
                index < pdiSkills.length - 1 && styles.pdiSkillItemBorder,
              ]}
            >
              <View style={styles.pdiSkillHeader}>
                <View style={styles.pdiSkillTitleRow}>
                  <Text style={styles.pdiSkillName}>{item.skill}</Text>
                  <View style={[styles.pdiPerformanceBadge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.pdiPerformanceText, { color: colors.text }]}>{item.performance}</Text>
                  </View>
                </View>
                <View style={styles.pdiSkillFeedbackRow}>
                  <Text style={styles.pdiSkillFeedback}>{item.feedback}</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#9CA3AF"
                    style={styles.pdiChevron}
                  />
                </View>
              </View>
              {isExpanded && item.details && (
                <View style={styles.pdiDetailsContainer}>
                  <Text style={styles.pdiDetailsText}>{item.details}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.cardLinkButton}
          onPress={() => navigation.navigate('Transcript', { recordingId })}
        >
          <Text style={styles.cardLinkText}>Read Full Transcript with Tips</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const ReportScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<ReportScreenRouteProp>();
  const recordingService = useRecordingService();
  const authService = useAuthService();
  const { recordingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<RecordingAnalysis | null>(null);
  const [pollingCount, setPollingCount] = useState(0);
  const [childName, setChildName] = useState<string>('Your Child');
  const [developmentalVisible, setDevelopmentalVisible] = useState(false);

  // Feedback state
  const [feedbackSentiment, setFeedbackSentiment] = useState<'positive' | 'negative' | null>(null);
  const [feedbackReasons, setFeedbackReasons] = useState<string[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleSentimentPress = useCallback((sentiment: 'positive' | 'negative') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFeedbackSentiment(sentiment);

    if (sentiment === 'positive') {
      // Shake animation to acknowledge
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();

      // Auto-submit positive feedback (fire and forget)
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
    try {
      await recordingService.submitReportFeedback(recordingId, {
        sentiment: feedbackSentiment,
        reasons: feedbackReasons,
        freeText: feedbackText || undefined,
      });
    } catch (err) {
      // Silently fail — feedback is non-critical
      console.log('Feedback submit error:', err);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFeedbackSubmitted(true);
  }, [feedbackSentiment, feedbackReasons, feedbackText, recordingId, recordingService]);

  useEffect(() => {
    loadReportData();
    loadChildName();
    loadDevelopmentalVisibility();
  }, [recordingId]);

  const loadDevelopmentalVisibility = async () => {
    try {
      const result = await recordingService.getDevelopmentalVisibility();
      setDevelopmentalVisible(result.visible);
    } catch (err) {
      // Keep default false
    }
  };

  const loadChildName = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user?.childName) {
        setChildName(user.childName);
      }
    } catch (err) {
      // Keep default "Your Child" if fetch fails
    }
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

      // If still processing, poll again after 3 seconds
      if (err.message.includes('processing') && pollingCount < 20) {
        setPollingCount(prev => prev + 1);
        setTimeout(() => {
          loadReportData();
        }, 3000);
      } else if (pollingCount >= 20) {
        setError('Analysis is taking longer than expected. Please try again later.');
        setLoading(false);
      } else {
        setError(err.message || 'Failed to load report');
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleBackToHome = () => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Today’s Emotional Massage Recap</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
          <Text style={styles.loadingText}>
            {pollingCount > 0 ? 'Analyzing your session...' : 'Loading report...'}
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
          <Text style={styles.headerTitle}>Today’s Emotional Massage Recap</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#E74C3C" />
          <Text style={styles.errorText}>{error || 'Failed to load report'}</Text>
          <Button onPress={loadReportData} variant="primary">
            Try Again
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Today’s Emotional Massage Recap</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Dragon Icon and Encouragement Message */}
        <View style={styles.headerSection}>
          <View style={styles.dragonIconContainer}>
            <Image
              source={DRAGON_PURPLE}
              style={styles.dragonIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerTextBox}>
            <Text style={styles.headerText}>
              {(reportData.mode === 'PDI' && reportData.pdiEncouragement)
                ? reportData.pdiEncouragement
                : (reportData.feedback || reportData.encouragement)}
            </Text>
          </View>
        </View>

        {/* Nora Score */}
        <View style={styles.scoreSection}>
          <Text style={styles.sectionTitle}>Emotional Bank Account</Text>
          <View style={styles.skillsContainer}>
            {(() => {
              const score = reportData.noraScore ?? 0;
              let scoreColor: string;
              let suffix: string;
              if (score < 80) {
                scoreColor = '#852221';
                suffix = '(Pay attention)';
              } else if (score < 90) {
                scoreColor = '#6750A4';
                suffix = '(Good)';
              } else {
                scoreColor = '#6750A4';
                suffix = '(Excellent)';
              }
              return (
                <SkillProgressBar
                  label="Overall"
                  progress={score}
                  maxValue={100}
                  color={scoreColor}
                  textColor={scoreColor}
                  prefix="+"
                  suffix={suffix}
                  onPress={() => navigation.navigate('SkillExplanation', { skillKey: 'Overall', score, tip: reportData.tip ?? undefined })}
                />
              );
            })()}
          </View>
        </View>

        {/* PRN Skills Section */}
        <View style={styles.skillsSection}>
          <Text style={styles.sectionTitle}>Your PEN Skills</Text>
          <View style={styles.skillsContainer}>
            {reportData.skills.map((skill, index) => {
              const rating = getSkillRating(skill.progress);
              return (
                <SkillProgressBar
                  key={index}
                  label={skill.label}
                  progress={skill.progress}
                  maxValue={10}
                  color={rating.barColor}
                  textColor={rating.textColor}
                  suffix={rating.suffix}
                  onPress={() => navigation.navigate('SkillExplanation', { skillKey: skill.label })}
                />
              );
            })}
          </View>
        </View>

        {/* Areas to Avoid */}
        <View style={styles.avoidSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Areas to Avoid</Text>
            {/* <Text style={styles.totalText}>Total &lt; 3</Text> */}
          </View>
          <View style={styles.avoidContainer}>
            {reportData.areasToAvoid
              .filter(area => !(reportData.mode === 'PDI' && (typeof area === 'string' ? area : area.label) === 'Commands'))
              .map((area, index) => {
              const areaData = typeof area === 'string' ? { label: area, count: 0 } : area;
              const needsAttention = areaData.count > 0;
              return (
                <View key={index} style={styles.avoidItem}>
                  <View style={styles.avoidRow}>
                    <Text style={styles.avoidLabel}>{areaData.label}</Text>
                    <TouchableOpacity
                      style={styles.avoidRightContainer}
                      onPress={() => navigation.navigate('SkillExplanation', { skillKey: areaData.label })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.countText, styles.countTextClickable, needsAttention ? styles.countTextAttention : styles.countTextExcellent]}>
                        {areaData.count}{needsAttention ? ' (Pay attention)' : ' (Excellent)'}
                        <Ionicons name="chevron-forward" size={12} color={needsAttention ? '#852221' : '#6750A4'} />
                      </Text>
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
        </View>

        {/* Top Moment */}
        <View>
          <Text style={styles.cardTitle}>Top Moment</Text>
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
          <PDICoachCorner pdiSkills={reportData.pdiSkills} summary={reportData.pdiSummary} recordingId={recordingId} navigation={navigation} />
        ) : (
          reportData.coachingCards && Array.isArray(reportData.coachingCards) && reportData.coachingCards.length > 0 && (() => {
            const cards = (reportData.coachingCards as CoachingCard[]).slice(0, 1);

            return (
              <View>
                <Text style={styles.cardTitle}>Coach's Corner</Text>
                {cards.map((card) => (
                    <View key={card.card_id} style={styles.coachCard}>
                      {/* Summary */}
                      {reportData.coachingSummary ? (
                        <Text style={styles.coachDescription}><Text style={styles.coachLabelBold}>Summary: </Text>{reportData.coachingSummary}</Text>
                      ) : null}

                      {/* Description */}
                      {card.coaching_tip ? (
                        <Text style={styles.coachDescription}><Text style={styles.coachLabelBold}>Tip for Next Session: </Text>{card.coaching_tip}</Text>
                      ) : null}

                      {/* Scenario */}
                      {card.scenario && (
                        <View style={styles.coachExampleContainer}>
                          {card.scenario.instead_of ? (
                            <View style={styles.coachInsteadOfRow}>
                              <Ionicons name="bulb-outline" size={16} color="#6B7280" />
                              <Text style={styles.coachExampleInsteadOf}><Text style={styles.coachExampleInsteadOfLabel}>Instead of: </Text>{card.scenario.instead_of}</Text>
                            </View>
                          ) : null}
                          {card.scenario.try_this ? (
                            <Text style={styles.coachExampleImproved}><Text style={styles.coachExampleImprovedLabel}>Try: </Text>{card.scenario.try_this}</Text>
                          ) : null}
                        </View>
                      )}

                      {/* Apply in Daily Life */}
                      {card.apply_in_daily_life ? (
                        <Text style={styles.coachDescription}><Text style={styles.coachLabelBold}>Apply in Daily Life: </Text>{card.apply_in_daily_life}</Text>
                      ) : null}

                      <TouchableOpacity
                        style={styles.cardLinkButton}
                        onPress={() => navigation.navigate('Transcript', { recordingId })}
                      >
                        <Text style={styles.cardLinkText}>Read Full Transcript with Tips</Text>
                      </TouchableOpacity>
                    </View>
                ))}
              </View>
            );
          })()
        )}

        {/* Tomorrow's Goal */}
        {reportData.mode === 'PDI' && reportData.pdiTomorrowGoal ? (
          <View style={styles.nextDayGoalSection}>
            <DragonCard
              label="Tomorrow's Goal"
              text={reportData.pdiTomorrowGoal}
            />
          </View>
        ) : (
          reportData.coachingCards && Array.isArray(reportData.coachingCards) && reportData.coachingCards.length > 0 && (reportData.coachingCards as CoachingCard[])[0]?.next_day_goal && (
            <View style={styles.nextDayGoalSection}>
              <DragonCard
                label="Tomorrow's Goal"
                text={(reportData.coachingCards as CoachingCard[])[0].next_day_goal ?? ''}
              />
            </View>
          )
        )}

        {/* Milestone Celebrations */}
        {developmentalVisible && reportData.milestoneCelebrations && Array.isArray(reportData.milestoneCelebrations) && reportData.milestoneCelebrations.length > 0 && (
          <View style={styles.milestoneCelebrationSection}>
            <Text style={styles.cardTitle}>New Milestone</Text>
            {(reportData.milestoneCelebrations as MilestoneCelebration[]).slice(0, 1).map((milestone, index) => {
              const isAchieved = milestone.status === 'ACHIEVED';
              const personalizedDescription = isAchieved
                ? `${childName} has mastered ${milestone.title.toLowerCase()}!`
                : `${childName} is starting to ${milestone.title.toLowerCase()}!`;

              return (
                <View key={index} style={styles.milestoneCard}>
                  <View style={styles.milestoneHeader}>
                    <View style={styles.milestoneContent}>
                      <View style={styles.milestoneTitleRow}>
                        <Text style={styles.milestonePersonalizedText}>{personalizedDescription}</Text>
                        {/* <View style={[styles.milestoneBadge, isAchieved ? styles.milestoneBadgeAchieved : styles.milestoneBadgeEmerging]}>
                          <Text style={[styles.milestoneBadgeText, isAchieved ? styles.milestoneBadgeTextAchieved : styles.milestoneBadgeTextEmerging]}>
                            {isAchieved ? 'Achieved' : 'Emerging'}
                          </Text>
                        </View> */}
                      </View>
                      <Text style={styles.milestoneCategory}>{milestone.category}</Text>
                    </View>
                  </View>
                  {milestone.actionTip && (
                    <View style={styles.milestoneActionTip}>
                      <Ionicons name="bulb-outline" size={16} color="#6B7280" />
                      <Text style={styles.milestoneActionTipText}>{milestone.actionTip}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.cardLinkButton}
                    onPress={() => navigation.navigate('MainTabs', { screen: 'Progress', params: { scrollToDevelopmental: true } })}
                  >
                    <Text style={styles.cardLinkText}>View All Milestones</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Tips for Next Time - TEMPORARILY HIDDEN */}
        {/* <View>
          <Text style={styles.cardTitle}>Session Overview</Text>
          {(reportData.feedback || (reportData.exampleIndex != null && reportData.transcript && reportData.transcript.length > 0) || (!reportData.tip && reportData.tips && typeof reportData.tips === 'object')) && (
          <View style={styles.card}>
            {reportData.feedback && (
              <Text style={styles.transitionText}>{formatWithStarBreaks(reportData.feedback)}</Text>
            )}

            {reportData.exampleIndex != null && reportData.transcript && reportData.transcript.length > 0 && (() => {
              const speakerMappings = getSpeakerMappings(reportData.transcript);
              const exampleUtterances = getExampleUtterances(reportData.exampleIndex, reportData.transcript);
              const middleIndex = exampleUtterances.length === 3 ? 1 : (exampleUtterances.length === 2 && reportData.exampleIndex === 0 ? 0 : 1);

              return (
                <View style={styles.exampleUtterancesContainer}>
                  <Text style={styles.exampleLabel}>Example from the session:</Text>
                  {exampleUtterances.map((item, idx) => {
                    const { utterance, originalIndex } = item;
                    const isMiddle = originalIndex === reportData.exampleIndex;

                    if (utterance.speaker === '__SILENT__') {
                      const duration = (utterance.end || 0) - (utterance.start || 0);
                      const durationText = duration >= 60
                        ? `${Math.floor(duration / 60)}m ${Math.round(duration % 60)}s`
                        : `${duration.toFixed(1)}s`;

                      return (
                        <View key={idx} style={[styles.silentSlotContainer, isMiddle && styles.utteranceHighlighted]}>
                          <View style={styles.silentSlotHeader}>
                            <View style={styles.silentSlotBadge}>
                              <Text style={styles.silentSlotBadgeText}>Silent Moment</Text>
                            </View>
                          </View>
                          {isMiddle && utterance.feedback && (
                            <View style={styles.silentSlotFeedback}>
                              <Text style={styles.silentSlotFeedbackText}>
                                💡 {utterance.feedback}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    }

                    const speakerLabel = speakerMappings.labelMapping[utterance.speaker] || 'Unknown';
                    const speakerColor = speakerMappings.colorMapping[utterance.speaker] || '#E3F2FD';
                    const isAdult = speakerLabel.includes('Adult');
                    const pcitTag = utterance.tag;
                    const skillType = getSkillType(pcitTag);
                    const shouldShowFeedback = isMiddle && isAdult && utterance.feedback && skillType !== 'neutral';

                    return (
                      <View key={idx} style={[styles.utteranceContainer, isMiddle && styles.utteranceHighlighted]}>
                        <View style={styles.utteranceHeader}>
                          <View style={[styles.speakerBadge, { backgroundColor: speakerColor }]}>
                            <Text style={styles.speakerBadgeText}>{speakerLabel}</Text>
                          </View>
                          {isMiddle && isAdult && pcitTag && (
                            <View style={[styles.tag, { backgroundColor: getTagColor(pcitTag) }]}>
                              <Text style={styles.tagText}>{pcitTag}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.utteranceText}>{utterance.text}</Text>
                        {shouldShowFeedback && (
                          <View style={[
                            styles.feedbackContainer,
                            skillType === 'desirable' ? styles.feedbackDesirable : styles.feedbackUndesirable
                          ]}>
                            <Text style={[
                              styles.feedbackText,
                              skillType === 'desirable' ? styles.feedbackTextDesirable : styles.feedbackTextUndesirable
                            ]}>
                              {skillType === 'desirable' ? '✓ Great!\n' : '💡 '}
                              {utterance.feedback}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {!reportData.tip && reportData.tips && typeof reportData.tips === 'object' && (
              <View>
                <Text style={styles.observationTitle}>{reportData.tips.observation}</Text>
                <View style={styles.whySection}>
                  <Text style={styles.whyLabel}>Why it matters:</Text>
                  <Text style={styles.whyText}>{reportData.tips.why}</Text>
                </View>
                <Text style={styles.exampleLabel}>Example from the session:</Text>
                <View style={styles.exampleSection}>
                  <Text style={styles.exampleQuote}>"{reportData.tips.example}"</Text>
                  <View style={styles.tipSection}>
                    <Text style={styles.tipText}>💡 {reportData.tips.actionableTip}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
          )}
        </View> */}

        {/* What We Learned About Child */}
        {/* {reportData.childReaction && (
          <View>
            <Text style={styles.cardTitle}>What We Learned About {childName}</Text>
            <View style={styles.card}>
              <Text style={styles.childReactionText}>{formatWithLineBreaks(reportData.childReaction)}</Text>
            </View>
          </View>
        )} */}

        {/* Reminder */}
        {/* {reportData.reminder && (
          <View style={styles.headerSection}>
            <View style={styles.dragonIconContainer}>
              <Image
                source={DRAGON_PURPLE}
                style={styles.dragonIcon}
                resizeMode="contain"
              />
            </View>
            <View style={styles.headerTextBox}>
              <Text style={styles.headerText}>{reportData.reminder}</Text>
            </View>
          </View>
        )} */}

        {/* Report Feedback */}
        {feedbackSubmitted ? (
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackThankYou}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.feedbackThankYouText}>Thanks for your feedback!</Text>
            </View>
          </View>
        ) : (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>Was this report helpful?</Text>

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
                  ]}>Yes</Text>
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
                ]}>Not really</Text>
              </TouchableOpacity>
            </View>

            {feedbackSentiment === 'negative' && (
              <View style={styles.feedbackFollowUp}>
                <Text style={styles.feedbackFollowUpLabel}>What could be better?</Text>

                <View style={styles.feedbackChipsRow}>
                  {NEGATIVE_REASONS.map(reason => (
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
                      ]}>{reason}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.feedbackInput}
                  placeholder="How can we improve?"
                  placeholderTextColor="#9CA3AF"
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />

                <TouchableOpacity style={styles.feedbackSubmitButton} onPress={handleSubmitFeedback}>
                  <Text style={styles.feedbackSubmitText}>Submit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Back to Home Button */}
        {/* <View style={styles.buttonContainer}>
          <Button onPress={handleBackToHome} variant="primary">
            Back to Home
          </Button>
        </View> */}
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
  headerSection: {
    paddingTop: 4,
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragonIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 26,
  },
  dragonIcon: {
    width: 90,
    height: 90,
    marginLeft: 25,
  },
  headerTextBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    minHeight: 80,
  },
  headerText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#364153',
    lineHeight: 24,
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
  scoreTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreValue: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    color: COLORS.mainPurple,
    minWidth: 100,
  },
  scoreBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    overflow: 'hidden',
  },
  scoreBar: {
    height: '100%',
    backgroundColor: '#CEA4FC', 
    borderRadius: 6,
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
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  totalText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#666666',
  },
  skillsContainer: {
    gap: 4,
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
  countText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#666666',
  },
  countTextClickable: {
    //textDecorationLine: 'underline',
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
  countTextAttention: {
    color: '#852221',
  },
  countTextExcellent: {
    color: '#6750A4',
  },
  quoteText: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textDark,
    fontStyle: 'italic',
    //lineHeight: 24,
    //marginBottom: 24,
    textAlign: 'center',
  },
  waveformContainer: {
    marginTop: 8,
    marginBottom: -10,
  },
  tipsText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 16,
  },
  observationTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  whySection: {
    marginBottom: 22,
  },
  whyLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 6,
  },
  whyText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  exampleSection: {
    marginTop:8,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    //borderColor: '#0059DB',
    //borderWidth: 2,
    //borderLeftWidth: 3,
    //borderLeftColor: '#9CA3AF',
  },
  exampleLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 6,
  },
  exampleQuote: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  tipSection: {
    backgroundColor: '#FAF5FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 16,
    //borderLeftWidth: 3,
    //borderLeftColor: '#9333EA',
  },
  tipText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#7E22CE',
    lineHeight: 20,
  },
  moreTipsText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E8E8E8',
    marginBottom: 0,
  },
  learnMoreButton: {
    alignSelf: 'center',
    marginTop: 0,
  },
  learnMoreText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#0059DB',
    textAlign: 'center',
  },
  goalCard: {
    backgroundColor: COLORS.cardPurple,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  goalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  goalText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  dragonContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragonImage: {
    width: '100%',
    height: '100%',
  },
  buttonContainer: {
    marginTop: 8,
  },
  // Session summary styles
  summaryText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryLabel: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#666666',
  },
  summaryValue: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textDark,
  },
  // Celebration text under top moment
  celebrationText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#364153',
    textAlign: 'center',
    lineHeight: 22,
  },
  // New tip main text
  tipMainText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 22,
    marginBottom: 16,
  },
  // Transition text between tip and example
  transitionText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 22,
    marginBottom: 16,
  },
  childReactionText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  // Example utterances container
  exampleUtterancesContainer: {
    marginBottom: 15,
    marginTop: 15,
    backgroundColor: '#f2f2f7',
    padding: 15,
    borderRadius: 16,
    //borderColor: '#0059DB',
    //borderWidth: 2,


  },
  // Utterance styles (matching TranscriptScreen)
  utteranceContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    //borderWidth: 1,
    //borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  utteranceHighlighted: {
    //borderColor: '#0059DB',
    //borderWidth: 2,
  },
  utteranceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  speakerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  speakerBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textDark,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  utteranceText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  // Feedback styles
  feedbackContainer: {
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  feedbackDesirable: {
    backgroundColor: '#F0FDF4', // Light green
  },
  feedbackUndesirable: {
    backgroundColor: '#FAF5FF', // Light purple
  },
  feedbackText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  feedbackTextDesirable: {
    color: '#15803D', // Dark green
  },
  feedbackTextUndesirable: {
    color: '#7E22CE', // Dark purple
  },
  // Silent slot styles
  silentSlotContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  silentSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  silentSlotBadge: {
    backgroundColor: '#FDE047',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  silentSlotBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#854D0E',
  },
  silentSlotDuration: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#854D0E',
  },
  silentSlotFeedback: {
    backgroundColor: '#FAF5FF',
    borderRadius: 8,
    padding: 12,
  },
  silentSlotFeedbackText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: '#7E22CE',
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
  coachTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  coachIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachTipTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textDark,
    flex: 1,
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
  coachSuggestion: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  coachExampleContainer: {
    marginTop: 12,
    //backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 0,
  },
  coachExampleContext: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
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
  aboutChildSection: {
    marginBottom: 16,
  },
  aboutChildContainer: {
    gap: 12,
  },
  aboutChildCard: {
    backgroundColor: '#F8F7FC',
    borderRadius: 16,
    padding: 16,
  },
  aboutChildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aboutChildIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutChildContent: {
    flex: 1,
  },
  aboutChildTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  aboutChildDescription: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  aboutChildDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  aboutChildDetailsText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  // Tomorrow's Goal styles
  nextDayGoalSection: {
    marginBottom: 16,
    marginTop: 8,
  },
  nextDayGoalGradientBorder: {
    borderRadius: 24,
    padding: 10,
  },
  nextDayGoalInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  nextDayGoalDragonContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextDayGoalDragonImage: {
    width: 140,
    height: 140,
    marginLeft: 30,
  },
  nextDayGoalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nextDayGoalLabelText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#6750A4',
  },
  nextDayGoalHighlight: {
    backgroundColor: '#FDE047',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nextDayGoalHighlightText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#1F2937',
  },
  nextDayGoalText: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 30,
  },
  // Milestone Celebration styles
  milestoneCelebrationSection: {
    marginBottom: 16,
  },
  milestoneCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
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
    fontSize: 12,
  },
  milestoneBadgeTextAchieved: {
    color: '#D97706',
  },
  milestoneBadgeTextEmerging: {
    color: '#7C3AED',
  },
  milestonePersonalizedText: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textDark,
    lineHeight: 24,
    flex: 1,
  },
  milestoneCategory: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
  },
  milestoneActionTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    //borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  milestoneActionTipText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
    lineHeight: 20,
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
    marginBottom: 16,
  },
  pdiSkillItem: {
    paddingVertical: 12,
  },
  pdiSkillItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pdiSkillHeader: {
    gap: 6,
  },
  pdiSkillTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pdiSkillName: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textDark,
    flex: 1,
  },
  pdiPerformanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pdiPerformanceText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  pdiSkillFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  pdiSkillFeedback: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    flex: 1,
  },
  pdiChevron: {
    marginTop: 2,
  },
  pdiDetailsContainer: {
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
  },
  pdiDetailsText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
});
