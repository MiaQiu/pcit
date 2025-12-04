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
            <View style={[styles.speakerBadge, styles.parentBadge]}>
              <Text style={styles.speakerBadgeText}>Parent</Text>
            </View>
            <View style={[styles.speakerBadge, styles.childBadge]}>
              <Text style={styles.speakerBadgeText}>Child</Text>
            </View>
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
              const isParent = segment.speaker === '0';
              const tags = isParent ? getPCITTagsForUtterance(index, segment.text) : [];

              return (
                <View key={index} style={styles.utteranceContainer}>
                  {/* Speaker label and timestamp */}
                  <View style={styles.utteranceHeader}>
                    <View style={[styles.speakerBadge, isParent ? styles.parentBadge : styles.childBadge]}>
                      <Text style={styles.speakerBadgeText}>
                        {isParent ? 'Parent' : 'Child'}
                      </Text>
                    </View>
                    <Text style={styles.timestamp}>{formatTime(segment.start)}</Text>
                  </View>

                  {/* Utterance text */}
                  <Text style={styles.utteranceText}>{segment.text}</Text>

                  {/* PCIT tags (only for parent) */}
                  {tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                      {tags.map((tag, tagIndex) => (
                        <View key={tagIndex} style={[styles.tag, { backgroundColor: tag.color }]}>
                          <Text style={styles.tagText}>{tag.tag}</Text>
                        </View>
                      ))}
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
    paddingBottom: 40,
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
});
