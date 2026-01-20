/**
 * ReportScreen
 * Displays daily performance report with skills, tips, and goals
 * Based on Figma design
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SkillProgressBar } from '../components/SkillProgressBar';
import { Button } from '../components/Button';
import { COLORS, FONTS, DRAGON_PURPLE } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService } from '../contexts/AppContext';
import type { RecordingAnalysis } from '@nora/core';
import { MarkdownText } from '../utils/MarkdownText';

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

export const ReportScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<ReportScreenRouteProp>();
  const recordingService = useRecordingService();
  const { recordingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<RecordingAnalysis | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  useEffect(() => {
    loadReportData();
  }, [recordingId]);

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
          <Text style={styles.headerTitle}>My Report</Text>
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
          <Text style={styles.headerTitle}>My Report</Text>
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
        <Text style={styles.headerTitle}>My Report</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Dragon Icon and Encouragement Message */}
        {/* <View style={styles.headerSection}>
          <View style={styles.dragonIconContainer}>
            <Image
              source={DRAGON_PURPLE}
              style={styles.dragonIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerTextBox}>
            <Text style={styles.headerText}>{reportData.encouragement}</Text>
          </View>
        </View> */}

        {/* Nora Score */}
        <View style={styles.scoreSection}>
          <Text style={styles.sectionTitle}>Nora Score</Text>
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
                  suffix={suffix}
                  onPress={() => navigation.navigate('SkillExplanation', { skillKey: 'Overall', score, tip: reportData.tip })}
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
            {reportData.areasToAvoid.map((area, index) => {
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

        {/* Session Summary */}
        {reportData.summary && (
          <View>
            <Text style={styles.cardTitle}>Session Summary</Text>
            <View style={styles.card}>
              <Text style={styles.summaryText}>{formatWithLineBreaks(reportData.summary)}</Text>
            </View>
          </View>
        )}

        {/* Top Moment */}
        <View>
          <Text style={styles.cardTitle}>Top Moment</Text>
          <View style={styles.card}>
            <Text style={styles.quoteText}>"{reportData.topMoment.quote}"</Text>
            {/* {reportData.topMoment.celebration && (
              <Text style={styles.celebrationText}>{reportData.topMoment.celebration}</Text>
            )} */}
          </View>
        </View>

        {/* Tips for Next Time */}
        <View>
          <Text style={styles.cardTitle}>Tips for Next Time</Text>
          <View style={styles.card}>
            {/* New format: simplified tip with example utterances */}
            {/* {reportData.tip && (
              <Text style={styles.tipMainText}>{reportData.tip}</Text>
            )} */}

            {/* Transition text */}
            {reportData.transition && (
              <Text style={styles.transitionText}>{formatWithLineBreaks(reportData.transition)}</Text>
            )}

            {/* Example utterances */}
            {reportData.exampleIndex != null && reportData.transcript && reportData.transcript.length > 0 && (() => {
              const speakerMappings = getSpeakerMappings(reportData.transcript);
              const exampleUtterances = getExampleUtterances(reportData.exampleIndex, reportData.transcript);
              const middleIndex = exampleUtterances.length === 3 ? 1 : (exampleUtterances.length === 2 && reportData.exampleIndex === 0 ? 0 : 1);

              return (
                <View style={styles.exampleUtterancesContainer}>
                  <Text style={styles.exampleLabel}>Example from the session:</Text>
                  {exampleUtterances.map((item, idx) => {
                    const { utterance, originalIndex } = item;
                    const speakerLabel = speakerMappings.labelMapping[utterance.speaker] || 'Unknown';
                    const speakerColor = speakerMappings.colorMapping[utterance.speaker] || '#E3F2FD';
                    const isAdult = speakerLabel.includes('Adult');
                    const pcitTag = utterance.tag;
                    const isMiddle = originalIndex === reportData.exampleIndex;
                    const skillType = getSkillType(pcitTag);
                    const shouldShowFeedback = isAdult && utterance.feedback && skillType !== 'neutral';

                    return (
                      <View key={idx} style={[styles.utteranceContainer, isMiddle && styles.utteranceHighlighted]}>
                        <View style={styles.utteranceHeader}>
                          <View style={[styles.speakerBadge, { backgroundColor: speakerColor }]}>
                            <Text style={styles.speakerBadgeText}>{speakerLabel}</Text>
                          </View>
                          {isAdult && pcitTag && (
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

            {/* Backward compatibility: old tips format */}
            {!reportData.tip && reportData.tips && typeof reportData.tips === 'string' && (
              <MarkdownText style={styles.tipsText}>{reportData.tips}</MarkdownText>
            )}

            {/* Backward compatibility: structured tips object */}
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

            {/* Divider Line */}
            {/* <View style={styles.divider} /> */}

            <TouchableOpacity
              style={styles.learnMoreButton}
              onPress={() => navigation.navigate('Transcript', { recordingId })}
            >
              <Text style={styles.learnMoreText}>Read full conversation with tips</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reminder */}
        {reportData.reminder && (
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
        )}

        {/* Back to Home Button */}
        <View style={styles.buttonContainer}>
          <Button onPress={handleBackToHome} variant="primary">
            Back to Home
          </Button>
        </View>
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
    marginBottom: 20,
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
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    textDecorationLine: 'underline',
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
  // Example utterances container
  exampleUtterancesContainer: {
    marginBottom: 15,
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
});
