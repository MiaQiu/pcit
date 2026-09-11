/**
 * TranscriptPanel
 * The transcript content (skill/avoid-item filter chips + match navigation,
 * speaker legend, full utterance list) extracted from TranscriptScreen so it
 * can be reused both as the full Transcript screen and embedded directly
 * inside SkillUtterancesScreen — no navigation required to see it there.
 *
 * Fetches its own data (same call TranscriptScreen used) so it's fully
 * self-contained regardless of where it's mounted.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { useRecordingService } from '../contexts/AppContext';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';

interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
  role?: string;  // 'adult' or 'child'
  tag?: string;   // noraTag display name (e.g. 'Echo', 'Labeled Praise')
  feedback?: string;  // Feedback for adult utterances
  revisedFeedback?: string;  // Revised feedback from Call 4
  additionalTip?: string;  // Additional tip for desirable skills
}

// Filter categories the transcript can be navigated by, grouped into PRIDE "do" and "don't" rows.
// Each category maps to the underlying noraTag values it should match in the transcript.
export const CATEGORY_TAGS: { [label: string]: string[] } = {
  Praise: ['Labeled Praise', 'Unlabeled Praise'],
  Echo: ['Echo'],
  Narration: ['Narration'],
  Question: ['Question'],
  Command: ['Command', 'Direct Command', 'Indirect Command'],
  Criticism: ['Criticism', 'Negative Talk'],
};

export const SKILL_CATEGORY_ROWS: string[][] = [
  ['Praise', 'Echo', 'Narration'],
  ['Question', 'Command', 'Criticism'],
];

// Chip color per category — same palette getTagColor() below resolves to
// for each category's primary tag.
export const CATEGORY_COLORS: { [label: string]: string } = {
  Praise: '#10B981',
  Echo: '#3B82F6',
  Narration: '#8B5CF6',
  Question: '#F97316',
  Command: '#EF4444',
  Criticism: '#DC2626',
};

interface TranscriptPanelProps {
  recordingId: string;
  initialCategory?: string;
  // When set, the panel scrolls within a fixed-height box (for embedding
  // inside another screen's ScrollView). Omit for full-screen usage, where
  // the panel fills its flex-1 parent instead.
  scrollHeight?: number;
  // When true, the filter grid shows only the initialCategory chip instead
  // of all six — used by SkillUtterancesScreen, which is already scoped to
  // one skill and shouldn't let the user wander into unrelated categories.
  restrictToInitialCategory?: boolean;
  // Fired when the user taps Next, so a host screen that embeds this panel
  // inside its own ScrollView (e.g. SkillUtterancesScreen) can scroll itself
  // so the panel stays in view instead of only scrolling inside its own box.
  onNext?: () => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ recordingId, initialCategory, scrollHeight, restrictToInitialCategory, onNext }) => {
  const { t } = useTranslation();
  const recordingService = useRecordingService();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  // Pre-selected when embedded from SkillUtterancesScreen — the
  // selectedCategory/matchIndices effect below auto-scrolls to the first
  // match once transcriptSegments loads, same as tapping the chip.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory ?? null);
  // Narrows the selected category to a single underlying noraTag (e.g. show
  // only 'Labeled Praise' within the Praise category). null = all tags.
  const [tagSubFilter, setTagSubFilter] = useState<string | null>(null);
  const [matchCursor, setMatchCursor] = useState(0);

  // In restricted (single-skill) mode the sub-filter defaults to the category's
  // primary tag (e.g. Labeled Praise) rather than "All"; this guards that
  // default so it's applied once and doesn't override the user's later choice.
  const didInitSubFilter = useRef(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const listContainerY = useRef(0);
  const itemY = useRef<{ [index: number]: number }>({});

  useEffect(() => {
    loadTranscript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId]);

  const loadTranscript = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await recordingService.getAnalysis(recordingId);
      if (data.transcript && Array.isArray(data.transcript)) {
        setTranscriptSegments(data.transcript);
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load transcript:', err);
      amplitudeService.trackError(err, 'TranscriptPanel.loadTranscript');
      setError(err.message || t('transcript.failedToLoad'));
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

    adultSpeakers.sort();
    childSpeakers.sort();

    adultSpeakers.forEach((speaker, index) => {
      labelMapping[speaker] = adultSpeakers.length > 1 ? t('transcript.speakerAdultN', { n: index + 1 }) : t('transcript.speakerAdult');
      colorMapping[speaker] = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
      colorIndex++;
    });
    childSpeakers.forEach((speaker, index) => {
      labelMapping[speaker] = childSpeakers.length > 1 ? t('transcript.speakerChildN', { n: index + 1 }) : t('transcript.speakerChild');
      colorMapping[speaker] = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
      colorIndex++;
    });

    return { labelMapping, colorMapping };
  };

  const { labelMapping: speakerLabels, colorMapping: speakerColors } = getSpeakerMappings();

  const getTagColor = (tag: string | null | undefined): string => {
    if (!tag) return '#6B7280';
    if (tag === 'Echo') return '#3B82F6';
    if (tag === 'Labeled Praise') return '#10B981';
    if (tag === 'Unlabeled Praise') return '#F59E0B';
    if (tag === 'Narration') return '#8B5CF6';
    if (tag === 'Direct Command' || tag === 'Indirect Command') return '#EF4444';
    if (tag === 'Question') return '#F97316';
    if (tag === 'Negative Talk') return '#DC2626';
    if (tag === 'NEUTRAL') return '#6B7280';
    if (tag.includes('Praise')) return '#10B981';
    if (tag.includes('Echo') || tag.includes('Reflect')) return '#3B82F6';
    if (tag.includes('Narration') || tag.includes('Narrate')) return '#8B5CF6';
    if (tag.includes('Question')) return '#EF4444';
    if (tag.includes('Command')) return '#EF4444';
    if (tag.includes('Criticism') || tag.includes('Negative')) return '#DC2626';
    if (tag.includes('Neutral')) return '#6B7280';
    return '#6B7280';
  };

  const getSkillType = (tag: string | null | undefined): 'desirable' | 'undesirable' | 'neutral' => {
    if (!tag) return 'neutral';
    if (tag === 'Echo' || tag === 'Labeled Praise' || tag === 'Narration') return 'desirable';
    if (tag === 'NEUTRAL' || tag === 'Neutral') return 'neutral';
    return 'undesirable';
  };

  // Adult noraTag values present in this transcript, used to grey out unavailable filters
  const presentTags = useMemo(() => {
    const set = new Set<string>();
    transcriptSegments.forEach((segment) => {
      if (segment.role === 'adult' && segment.tag) {
        set.add(segment.tag);
      }
    });
    return set;
  }, [transcriptSegments]);

  const isCategoryAvailable = (category: string): boolean =>
    (CATEGORY_TAGS[category] || []).some((tag) => presentTags.has(tag));

  // The underlying noraTags for the selected category that actually appear in
  // this transcript. When more than one is present (e.g. Labeled + Unlabeled
  // Praise), the sub-filter badge row lets the user narrow to just one.
  const subFilterTags = useMemo(() => {
    if (!selectedCategory) return [];
    return (CATEGORY_TAGS[selectedCategory] || []).filter((tag) => presentTags.has(tag));
  }, [selectedCategory, presentTags]);

  const matchIndices = useMemo(() => {
    if (!selectedCategory) return [];
    const tags = tagSubFilter ? [tagSubFilter] : (CATEGORY_TAGS[selectedCategory] || []);
    const indices: number[] = [];
    transcriptSegments.forEach((segment, index) => {
      if (segment.role === 'adult' && segment.tag && tags.includes(segment.tag)) {
        indices.push(index);
      }
    });
    return indices;
  }, [transcriptSegments, selectedCategory, tagSubFilter]);

  const scrollToSegment = (index: number) => {
    const y = listContainerY.current + (itemY.current[index] ?? 0);
    scrollViewRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
  };

  useEffect(() => {
    if (!didInitSubFilter.current && restrictToInitialCategory && subFilterTags.length > 1) {
      didInitSubFilter.current = true;
      setTagSubFilter(subFilterTags[0]);
      setMatchCursor(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restrictToInitialCategory, subFilterTags]);

  useEffect(() => {
    if (selectedCategory && matchIndices.length > 0) {
      const targetIndex = matchIndices[matchCursor] ?? matchIndices[0];
      requestAnimationFrame(() => scrollToSegment(targetIndex));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, matchCursor, matchIndices.length]);

  const handleSelectCategory = (category: string) => {
    if (!isCategoryAvailable(category)) return;
    setTagSubFilter(null);
    if (selectedCategory === category) {
      setSelectedCategory(null);
      setMatchCursor(0);
      return;
    }
    setSelectedCategory(category);
    setMatchCursor(0);
  };

  const handleSelectSubFilter = (tag: string | null) => {
    setTagSubFilter(tag);
    setMatchCursor(0);
  };

  const handleNextMatch = () => {
    if (matchIndices.length === 0) return;
    setMatchCursor((prev) => (prev + 1) % matchIndices.length);
    onNext?.();
  };

  const categoryRows = restrictToInitialCategory && initialCategory
    ? [[initialCategory]]
    : SKILL_CATEGORY_ROWS;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.mainPurple} />
        <Text style={styles.loadingText}>{t('transcript.loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={scrollHeight ? { height: scrollHeight } : styles.fullScreenContainer}>
      {/* Skill/avoid-item filter and next-occurrence navigation */}
      {transcriptSegments.length > 0 && (
        <View style={styles.tagFilterSection}>
          {!restrictToInitialCategory && (
            <>
              <Text style={styles.tagFilterTitle}>{t('transcript.filterHint')}</Text>
              <View style={styles.tagGrid}>
                {categoryRows.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.tagGridRow}>
                    {row.map((category) => {
                      const isAvailable = isCategoryAvailable(category);
                      const isSelected = selectedCategory === category;
                      const color = getTagColor(CATEGORY_TAGS[category][0]);
                      return (
                        <TouchableOpacity
                          key={category}
                          onPress={() => handleSelectCategory(category)}
                          disabled={!isAvailable}
                          style={[
                            styles.tagChip,
                            isAvailable ? { borderColor: color } : styles.tagChipDisabled,
                            isSelected && { backgroundColor: color },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.tagChipText,
                              isAvailable ? { color: isSelected ? '#FFFFFF' : color } : styles.tagChipTextDisabled,
                            ]}
                          >
                            {t(`transcript.pcitTags.${category}`, category)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </>
          )}

          {selectedCategory && subFilterTags.length > 1 && (
            <View style={[styles.subFilterRow, restrictToInitialCategory && styles.subFilterRowStandalone]}>
              <TouchableOpacity
                onPress={() => handleSelectSubFilter(null)}
                style={[
                  styles.subFilterBadge,
                  tagSubFilter === null
                    ? { backgroundColor: getTagColor(CATEGORY_TAGS[selectedCategory][0]), borderColor: getTagColor(CATEGORY_TAGS[selectedCategory][0]) }
                    : styles.subFilterBadgeInactive,
                ]}
              >
                <Text style={[styles.subFilterBadgeText, tagSubFilter === null ? styles.subFilterBadgeTextActive : styles.subFilterBadgeTextInactive]}>
                  {t('transcript.subFilterAll', 'All')}
                </Text>
              </TouchableOpacity>
              {subFilterTags.map((tag) => {
                const isActive = tagSubFilter === tag;
                const color = getTagColor(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => handleSelectSubFilter(tag)}
                    style={[
                      styles.subFilterBadge,
                      isActive ? { backgroundColor: color, borderColor: color } : styles.subFilterBadgeInactive,
                    ]}
                  >
                    <Text style={[styles.subFilterBadgeText, isActive ? styles.subFilterBadgeTextActive : styles.subFilterBadgeTextInactive]}>
                      {t(`transcript.pcitTags.${tag}`, tag)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {selectedCategory && (
            <View style={[styles.matchNavRow, restrictToInitialCategory && styles.matchNavRowStandalone]}>
              <Text style={styles.matchNavText}>
                {matchIndices.length > 0
                  ? t('transcript.matchCounter', { current: matchCursor + 1, total: matchIndices.length })
                  : t('transcript.noMatches')}
              </Text>
              <TouchableOpacity
                style={[styles.nextButton, matchIndices.length === 0 && styles.nextButtonDisabled]}
                onPress={handleNextMatch}
                disabled={matchIndices.length === 0}
              >
                <Text style={styles.nextButtonText}>{t('transcript.next')}</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={scrollHeight ? undefined : styles.fullScreenScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>{t('transcript.speakerLegend')}</Text>
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
            <Text style={styles.emptyText}>{t('transcript.noTranscript')}</Text>
          </View>
        ) : (
          <View
            style={styles.transcriptContainer}
            onLayout={(e) => { listContainerY.current = e.nativeEvent.layout.y; }}
          >
            {transcriptSegments.map((segment, index) => {
              const isSilentSlot = segment.speaker === '__SILENT__';

              if (isSilentSlot && !segment.feedback) return null;

              if (isSilentSlot) {
                return (
                  <View key={index} style={styles.silentSlotContainer}>
                    <View style={styles.silentSlotHeader}>
                      <View style={styles.silentSlotBadge}>
                        <Text style={styles.silentSlotBadgeText}>{t('transcript.silentMoment')}</Text>
                      </View>
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
              const isAdult = segment.role === 'adult';
              const pcitTag = segment.tag || null;
              const isCurrentMatch = selectedCategory !== null && matchIndices[matchCursor] === index;

              const skillType = getSkillType(pcitTag);
              const displayFeedback = segment.revisedFeedback || segment.feedback;
              const shouldShowFeedback = isAdult && displayFeedback && skillType !== 'neutral';

              return (
                <View
                  key={index}
                  onLayout={(e) => { itemY.current[index] = e.nativeEvent.layout.y; }}
                  style={[styles.utteranceContainer, isCurrentMatch && styles.utteranceContainerHighlighted]}
                >
                  <View style={styles.utteranceHeader}>
                    <View style={[styles.speakerBadge, { backgroundColor: speakerColor }]}>
                      <Text style={styles.speakerBadgeText}>
                        {speakerLabel}
                      </Text>
                    </View>
                    {isAdult && pcitTag && (
                      <View style={[styles.tag, { backgroundColor: getTagColor(pcitTag) }]}>
                        <Text style={styles.tagText}>{t(`transcript.pcitTags.${pcitTag}`, pcitTag)}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.utteranceText}>{segment.text}</Text>

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
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  fullScreenScroll: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textDark,
    marginTop: 16,
  },
  errorContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  tagFilterSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 12,
  },
  tagFilterTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tagGrid: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tagGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  tagChipDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  tagChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  tagChipTextDisabled: {
    color: '#9CA3AF',
  },
  matchNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  matchNavRowStandalone: {
    marginTop: 0,
  },
  subFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  subFilterRowStandalone: {
    marginTop: 0,
    marginBottom: 2,
  },
  subFilterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  subFilterBadgeInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  subFilterBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  subFilterBadgeTextActive: {
    color: '#FFFFFF',
  },
  subFilterBadgeTextInactive: {
    color: '#6B7280',
  },
  matchNavText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.mainPurple,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  nextButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  nextButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
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
  utteranceContainerHighlighted: {
    borderWidth: 2,
    borderColor: COLORS.mainPurple,
    backgroundColor: '#FAF5FF',
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
  utteranceText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
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
  },
  feedbackDesirable: {
    backgroundColor: '#F0FDF4',
  },
  feedbackUndesirable: {
    backgroundColor: '#FAF5FF',
  },
  feedbackText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  feedbackTextDesirable: {
    color: '#15803D',
  },
  feedbackTextUndesirable: {
    color: '#7E22CE',
  },
  additionalTipContainer: {
    backgroundColor: '#FAF5FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  additionalTipText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: '#7E22CE',
  },
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
});
