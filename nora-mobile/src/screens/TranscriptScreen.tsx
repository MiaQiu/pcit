/**
 * TranscriptScreen
 * Displays full conversation transcript with speaker labels and PCIT coding
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService } from '../contexts/AppContext';

type TranscriptScreenRouteProp = RouteProp<RootStackParamList, 'Transcript'>;

interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
  role?: string;  // 'adult' or 'child'
  tag?: string;   // PCIT tag
  feedback?: string;  // Feedback for adult utterances
  revisedFeedback?: string;  // Revised feedback from Call 4
  additionalTip?: string;  // Additional tip for desirable skills
}

interface PCITTag {
  tag: string;
  color: string;
}

// PCIT tag color mapping
const TAG_COLORS: { [key: string]: string } = {
  // CDI - DO tags (green/blue/purple)
  'Praise': '#10B981',
  'Echo': '#3B82F6',
  'Narration': '#8B5CF6',

  // CDI - DON'T tags (red/orange)
  'Question': '#EF4444',
  'Command': '#EF4444',
  'Criticism': '#DC2626',
  'Negative Phrases': '#DC2626',

  // PDI - DO tags (green)
  'Direct Command': '#10B981',
  'Positive Command': '#10B981',
  'Specific Command': '#10B981',
  'Labeled Praise': '#10B981',
  'Correct Warning': '#3B82F6',
  'Correct Time-Out Statement': '#3B82F6',

  // PDI - DON'T tags (red/orange)
  'Indirect Command': '#F97316',
  'Negative Command': '#EF4444',
  'Vague Command': '#F97316',
  'Chained Command': '#F97316',
  'Harsh Tone': '#DC2626',

  // Neutral (gray)
  'Neutral': '#6B7280',
};

export const TranscriptScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<TranscriptScreenRouteProp>();
  const recordingService = useRecordingService();
  const { recordingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [pcitCoding, setPcitCoding] = useState<any>(null);

  useEffect(() => {
    loadTranscript();
  }, [recordingId]);

  const loadTranscript = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await recordingService.getAnalysis(recordingId);

      // Extract transcript segments and PCIT coding
      if (data.transcript && Array.isArray(data.transcript)) {
        setTranscriptSegments(data.transcript);
      }
      if (data.pcitCoding) {
        setPcitCoding(data.pcitCoding);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load transcript:', err);
      setError(err.message || 'Failed to load transcript');
      setLoading(false);
    }
  };

  // Light background colors for different speakers
  const SPEAKER_COLORS = [
    '#E3F2FD', // Light blue
    '#FFF3E0', // Light orange
    '#F3E5F5', // Light purple
    '#E8F5E9', // Light green
    '#FFF9C4', // Light yellow
    '#FCE4EC', // Light pink
  ];

  // Build speaker label mapping and color mapping
  const getSpeakerMappings = () => {
    const labelMapping: { [key: string]: string } = {};
    const colorMapping: { [key: string]: string } = {};
    const seenSpeakers = new Set<string>();
    const adultSpeakers: string[] = [];
    const childSpeakers: string[] = [];
    let colorIndex = 0;

    // Group speakers by role (only add each speaker once)
    transcriptSegments.forEach(segment => {
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

  const { labelMapping: speakerLabels, colorMapping: speakerColors } = getSpeakerMappings();

  const handleBack = () => {
    navigation.goBack();
  };

  // Parse PCIT coding to extract tags for each utterance
  const getPCITTagsForUtterance = (index: number, text: string): PCITTag[] => {
    if (!pcitCoding?.coding) return [];

    const tags: PCITTag[] = [];
    const codingLines = pcitCoding.coding.split('\n');

    // Normalize text by removing extra spaces
    const normalizeText = (str: string) => str.replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedUtterance = normalizeText(text);

    // Track best match
    let bestMatch: { line: string; score: number } | null = null;

    // Find the line that matches this utterance by looking for quoted text
    for (const line of codingLines) {
      // Look for quoted text in the coding line
      const quoteMatch = line.match(/"([^"]+)"/);
      if (quoteMatch) {
        const quotedText = quoteMatch[1];
        const normalizedQuoted = normalizeText(quotedText);

        // Calculate match score
        // Prefer exact matches, then utterance contains quoted, then quoted contains utterance
        let score = 0;
        if (normalizedUtterance === normalizedQuoted) {
          score = 100; // Exact match
        } else if (normalizedUtterance.includes(normalizedQuoted)) {
          // Utterance contains the quoted text (quoted text is a subset)
          score = 50 + (normalizedQuoted.length / normalizedUtterance.length) * 40;
        } else if (normalizedQuoted.includes(normalizedUtterance)) {
          // Quoted text contains the utterance (less likely but possible)
          score = 30;
        }

        // Update best match if this is better
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { line, score };
        }
      }
    }

    // Extract tags from best matching line
    if (bestMatch) {
      // Extract tags from brackets [DO: ...] or [DON'T: ...] or [Neutral]
      const tagMatches = bestMatch.line.match(/\[(DO|DON'T):\s*([^\]]+)\]|\[Neutral\]/g);
      if (tagMatches) {
        tagMatches.forEach((match: string) => {
          let tagName = match.replace(/\[(DO|DON'T):\s*|\[|\]/g, '');
          const color = TAG_COLORS[tagName] || (match.includes("DON'T") ? '#EF4444' : '#10B981');
          tags.push({ tag: tagName, color });
        });
      }
    }

    return tags;
  };

  // Format timestamp
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Full Transcript</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
          <Text style={styles.loadingText}>Loading transcript...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Full Transcript</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
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
        <Text style={styles.headerTitle}>Full Transcript</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Speaker Legend</Text>
          <View style={styles.legendRow}>
            {Object.entries(speakerLabels).map(([speaker, label]) => {
              const backgroundColor = speakerColors[speaker];
              return (
                <View key={speaker} style={[styles.speakerLegendBadge, { backgroundColor }]}>
                  <Text style={styles.speakerLegendText}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Transcript */}
        {transcriptSegments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transcript available</Text>
          </View>
        ) : (
          <View style={styles.transcriptContainer}>
            {transcriptSegments.map((segment, index) => {
              // Check if this is a silent slot
              const isSilentSlot = segment.speaker === '__SILENT__';

              if (isSilentSlot) {
                // Render silent slot specially
                const duration = segment.end - segment.start;
                const durationText = duration >= 60
                  ? `${Math.floor(duration / 60)}m ${Math.round(duration % 60)}s`
                  : `${duration.toFixed(1)}s`;

                return (
                  <View key={index} style={styles.silentSlotContainer}>
                    <View style={styles.silentSlotHeader}>
                      <View style={styles.silentSlotBadge}>
                        <Text style={styles.silentSlotBadgeText}>Silent Moment</Text>
                      </View>
                      {/* <Text style={styles.silentSlotDuration}>{durationText}</Text> */}
                    </View>
                    {segment.feedback && (
                      <View style={styles.silentSlotFeedback}>
                        <Text style={styles.silentSlotFeedbackText}>
                          💡 {segment.feedback}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              }

              const speakerLabel = speakerLabels[segment.speaker] || 'Unknown';
              const speakerColor = speakerColors[segment.speaker] || '#FFFFFF';
              const isAdult = speakerLabel.includes('Adult');
              const pcitTag = segment.tag; // Get tag directly from database

              // Get tag color from mapping
              const getTagColor = (tag: string | undefined): string => {
                if (!tag) return '#6B7280';

                // New CDI tag names (without DO:/DON'T: prefix)
                if (tag === 'Echo') return '#3B82F6'; // Blue
                if (tag === 'Labeled Praise') return '#10B981'; // Green
                if (tag === 'Unlabeled Praise') return '#F59E0B'; // Amber
                if (tag === 'Narration') return '#8B5CF6'; // Purple
                if (tag === 'Direct Command' || tag === 'Indirect Command') return '#EF4444'; // Red
                if (tag === 'Question') return '#F97316'; // Orange
                if (tag === 'Negative Talk') return '#DC2626'; // Dark red
                if (tag === 'NEUTRAL') return '#6B7280'; // Gray

                // Legacy tag names (with DO:/DON'T: prefix) for backward compatibility
                if (tag.includes('Praise')) return '#10B981';
                if (tag.includes('Echo') || tag.includes('Reflect')) return '#3B82F6';
                if (tag.includes('Narration') || tag.includes('Narrate')) return '#8B5CF6';
                if (tag.includes('Question')) return '#EF4444';
                if (tag.includes('Command')) return '#EF4444';
                if (tag.includes('Criticism') || tag.includes('Negative')) return '#DC2626';
                if (tag.includes('Neutral')) return '#6B7280';

                return '#6B7280'; // Default gray
              };

              // Determine feedback type based on tag
              const getSkillType = (tag: string | undefined): 'desirable' | 'undesirable' | 'neutral' => {
                if (!tag) return 'neutral';

                // Desirable skills
                if (tag === 'Echo' || tag === 'Labeled Praise' || tag === 'Narration') {
                  return 'desirable';
                }

                // Neutral skills
                if (tag === 'NEUTRAL' || tag === 'Neutral') {
                  return 'neutral';
                }

                // Everything else is undesirable
                return 'undesirable';
              };

              const skillType = getSkillType(pcitTag);
              // Prefer revisedFeedback over original feedback
              const displayFeedback = segment.revisedFeedback || segment.feedback;
              const shouldShowFeedback = isAdult && displayFeedback && skillType !== 'neutral';

              return (
                <View key={index} style={styles.utteranceContainer}>
                  {/* Speaker label and PCIT tag */}
                  <View style={styles.utteranceHeader}>
                    <View style={[styles.speakerBadge, { backgroundColor: speakerColor }]}>
                      <Text style={styles.speakerBadgeText}>
                        {speakerLabel}
                      </Text>
                    </View>
                    {isAdult && pcitTag && (
                      <View style={[styles.tag, { backgroundColor: getTagColor(pcitTag) }]}>
                        <Text style={styles.tagText}>{pcitTag}</Text>
                      </View>
                    )}
                  </View>

                  {/* Utterance text */}
                  <Text style={styles.utteranceText}>{segment.text}</Text>

                  {/* Feedback for adult utterances */}
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
                        {displayFeedback}
                      </Text>
                    </View>
                  )}
                  {/* Additional tip for desirable skills */}
                  {skillType === 'desirable' && segment.additionalTip && (
                    <View style={styles.additionalTipContainer}>
                      <Text style={styles.additionalTipText}>
                        💡 Tip: {segment.additionalTip}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
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
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  legendCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  legendTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  transcriptContainer: {
    gap: 16,
  },
  utteranceContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  parentBadge: {
    backgroundColor: '#DBEAFE',
  },
  childBadge: {
    backgroundColor: '#FEF3C7',
  },
  speakerBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textDark,
  },
  speakerLegendBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  speakerLegendText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
  },
  timestamp: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  utteranceText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  feedbackContainer: {
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    //borderLeftWidth: 3,
  },
  feedbackDesirable: {
    backgroundColor: '#F0FDF4', // Light green
    //borderLeftColor: '#16A34A', // Dark green
  },
  feedbackUndesirable: {
    backgroundColor: '#FAF5FF', // Light purple
    //borderLeftColor: '#9333EA', // Dark purple
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
  additionalTipContainer: {
    backgroundColor: '#FAF5FF', // Light purple (same as tips)
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  additionalTipText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: '#7E22CE', // Dark purple (same as tips)
  },
  // Silent slot styles
  silentSlotContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#FAF5FF', // Light purple (same as other tips)
    borderRadius: 8,
    padding: 12,
  },
  silentSlotFeedbackText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: '#7E22CE', // Dark purple (same as other tips)
  },
});
