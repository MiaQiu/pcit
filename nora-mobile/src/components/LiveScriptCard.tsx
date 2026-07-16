/**
 * LiveScriptCard
 * Compact "live view" of the lesson script.
 *
 * When wordTimings are available (from forced alignment/transcription), renders
 * precise word-by-word highlighting: words already spoken turn black, upcoming
 * words stay grey, grouped into sentences for auto-scroll granularity.
 *
 * Otherwise falls back to a coarse paragraph-level estimate (position/duration
 * × block count) — most lessons don't have word timings yet.
 *
 * Tap the expand icon for the full scrollable script in a modal.
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { LESSON_TEXT_DARK, LESSON_TEXT_GREY } from '../constants/lessonViewerColors';
import { LessonContentBlocks } from './LessonContentBlocks';
import { groupWordTimingsIntoSentences } from '../utils/groupWordTimings';
import type { ContentBlock } from '../utils/formatLessonContentV2';
import type { WordTiming } from '@nora/core';

interface LiveScriptCardProps {
  blocks: ContentBlock[];
  wordTimings?: WordTiming[];
  positionMillis: number;
  durationMillis: number;
}

export const LiveScriptCard: React.FC<LiveScriptCardProps> = ({ blocks, wordTimings, positionMillis, durationMillis }) => {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const chunkOffsets = useRef<number[]>([]);
  const insets = useSafeAreaInsets();

  const currentSeconds = positionMillis / 1000;
  const hasWordTimings = !!wordTimings && wordTimings.length > 0;

  const sentences = useMemo(
    () => (hasWordTimings ? groupWordTimingsIntoSentences(wordTimings!) : []),
    [hasWordTimings, wordTimings]
  );

  const activeSentenceIndex = useMemo(() => {
    if (sentences.length === 0) return 0;
    let idx = 0;
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].start <= currentSeconds) idx = i;
      else break;
    }
    return idx;
  }, [sentences, currentSeconds]);

  const activeBlockIndex = useMemo(() => {
    if (blocks.length === 0 || !durationMillis) return 0;
    const ratio = Math.min(Math.max(positionMillis / durationMillis, 0), 1);
    return Math.min(Math.floor(ratio * blocks.length), blocks.length - 1);
  }, [blocks.length, positionMillis, durationMillis]);

  const activeIndex = hasWordTimings ? activeSentenceIndex : activeBlockIndex;
  const chunkCount = hasWordTimings ? sentences.length : blocks.length;

  useEffect(() => {
    const y = chunkOffsets.current[activeIndex];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
    }
  }, [activeIndex]);

  if (chunkCount === 0) return null;

  return (
    <View style={styles.card}>
      <ScrollView
        ref={scrollRef}
        style={styles.textArea}
        contentContainerStyle={styles.textAreaContent}
        showsVerticalScrollIndicator={false}
      >
        {hasWordTimings
          ? sentences.map((sentence, index) => (
              <View
                key={index}
                onLayout={(e: LayoutChangeEvent) => { chunkOffsets.current[index] = e.nativeEvent.layout.y; }}
                style={styles.sentenceRow}
              >
                <Text style={styles.bodyText}>
                  {sentence.words.map((word, w) => (
                    <Text
                      key={w}
                      style={word.start <= currentSeconds ? styles.wordSpoken : styles.wordPending}
                    >
                      {word.text}{' '}
                    </Text>
                  ))}
                </Text>
              </View>
            ))
          : blocks.map((block, index) => (
              <View
                key={index}
                onLayout={(e: LayoutChangeEvent) => { chunkOffsets.current[index] = e.nativeEvent.layout.y; }}
              >
                <LessonContentBlocks blocks={[block]} activeIndex={index === activeIndex ? 0 : -1} />
              </View>
            ))}
      </ScrollView>
      <LinearGradient
        colors={['rgba(245,245,248,0)', '#F5F5F8']}
        style={styles.bottomFade}
        pointerEvents="none"
      />
      <TouchableOpacity style={styles.expandButton} onPress={() => setExpanded(true)} accessibilityLabel="Expand script">
        <Ionicons name="expand" size={16} color={COLORS.textDark} />
      </TouchableOpacity>

      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Script</Text>
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              style={styles.modalClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.modalCloseIcon}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            {hasWordTimings ? (
              sentences.map((sentence, index) => (
                <View key={index} style={styles.sentenceRow}>
                  <Text style={styles.bodyText}>
                    {sentence.words.map((word, w) => (
                      <Text key={w} style={word.start <= currentSeconds ? styles.wordSpoken : styles.wordPending}>
                        {word.text}{' '}
                      </Text>
                    ))}
                  </Text>
                </View>
              ))
            ) : (
              <LessonContentBlocks blocks={blocks} />
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 8,
    marginTop: -10,
    height: 220,
    backgroundColor: '#F5F5F8',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  textArea: {
    flex: 1,
  },
  textAreaContent: {
    paddingBottom: 24,
  },
  sentenceRow: {
    marginBottom: 12,
  },
  bodyText: {
    fontFamily: FONTS.regular,
    fontSize: 19,
    lineHeight: 30,
  },
  wordSpoken: {
    color: LESSON_TEXT_DARK,
  },
  wordPending: {
    color: LESSON_TEXT_GREY,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
  },
  expandButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E6EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    fontWeight: '600',
    color: LESSON_TEXT_DARK,
  },
  modalClose: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseIcon: {
    fontSize: 24,
    color: LESSON_TEXT_DARK,
  },
  modalScrollContent: {
    padding: 20,
  },
});
