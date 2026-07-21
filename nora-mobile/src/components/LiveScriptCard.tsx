/**
 * LiveScriptCard
 * Compact "live view" of the lesson script.
 *
 * When wordTimings are available (from forced alignment/transcription), renders
 * word-by-word highlighting: words already spoken turn black, upcoming words
 * stay grey, grouped into sentences for auto-scroll granularity. The words
 * themselves (and any **bold** spans) always come from contentV2/blocks —
 * the admin-edited source of truth — not from wordTimings' own text, since an
 * edited lesson's contentV2 can diverge from the original transcript (filler
 * words removed, punctuation cleaned up). When the two still have the same
 * word count, wordTimings' per-word timestamps drive exactly which word is
 * "spoken"; otherwise that falls back to a proportional (position/duration)
 * estimate over contentV2's own word list.
 *
 * With no wordTimings at all, falls back further to a coarse paragraph-level
 * estimate (position/duration × block count) — most lessons don't have word
 * timings yet.
 *
 * Tap the expand icon for the full scrollable script in a modal.
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, ScrollView, LayoutChangeEvent } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { LESSON_TEXT_DARK, LESSON_TEXT_GREY } from '../constants/lessonViewerColors';
import { LessonContentBlocks } from './LessonContentBlocks';
import { flattenBlocksToChunks, countChunkWords } from '../utils/formatLessonContentV2';
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

  const displayChunks = useMemo(() => (hasWordTimings ? flattenBlocksToChunks(blocks) : []), [hasWordTimings, blocks]);
  const displayWordCount = useMemo(() => countChunkWords(displayChunks), [displayChunks]);
  const wordCountMatches = hasWordTimings && wordTimings!.length === displayWordCount;

  // Index (into the flat word stream, ignoring image chunks) of the last word
  // considered "spoken". -1 means none yet.
  const activeWordIndex = useMemo(() => {
    if (!hasWordTimings || displayWordCount === 0) return -1;
    if (wordCountMatches) {
      let idx = -1;
      for (let i = 0; i < wordTimings!.length; i++) {
        if (wordTimings![i].start <= currentSeconds) idx = i;
        else break;
      }
      return idx;
    }
    if (!durationMillis) return -1;
    const ratio = Math.min(Math.max(positionMillis / durationMillis, 0), 1);
    return Math.min(Math.floor(ratio * displayWordCount), displayWordCount) - 1;
  }, [hasWordTimings, wordCountMatches, wordTimings, currentSeconds, displayWordCount, positionMillis, durationMillis]);

  const activeChunkIndex = useMemo(() => {
    if (displayChunks.length === 0) return 0;
    let cumulative = 0;
    for (let i = 0; i < displayChunks.length; i++) {
      const chunk = displayChunks[i];
      if (chunk.type !== 'sentence') continue;
      cumulative += chunk.words.length;
      if (activeWordIndex < cumulative) return i;
    }
    return displayChunks.length - 1;
  }, [displayChunks, activeWordIndex]);

  const activeBlockIndex = useMemo(() => {
    if (blocks.length === 0 || !durationMillis) return 0;
    const ratio = Math.min(Math.max(positionMillis / durationMillis, 0), 1);
    return Math.min(Math.floor(ratio * blocks.length), blocks.length - 1);
  }, [blocks.length, positionMillis, durationMillis]);

  const activeIndex = hasWordTimings ? activeChunkIndex : activeBlockIndex;
  const chunkCount = hasWordTimings ? displayChunks.length : blocks.length;

  useEffect(() => {
    const y = chunkOffsets.current[activeIndex];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
    }
  }, [activeIndex]);

  if (chunkCount === 0) return null;

  const renderWordSentences = () => {
    let globalIndex = 0;
    return displayChunks.map((chunk, index) => {
      if (chunk.type === 'image') {
        return (
          <View
            key={index}
            onLayout={(e: LayoutChangeEvent) => { chunkOffsets.current[index] = e.nativeEvent.layout.y; }}
            style={styles.imageRow}
          >
            <Image source={{ uri: chunk.url }} style={styles.contentImage} resizeMode="cover" />
          </View>
        );
      }
      if (chunk.type === 'video') {
        return (
          <View
            key={index}
            onLayout={(e: LayoutChangeEvent) => { chunkOffsets.current[index] = e.nativeEvent.layout.y; }}
            style={styles.imageRow}
          >
            <Video
              source={{ uri: chunk.url }}
              style={styles.contentImage}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={false}
            />
          </View>
        );
      }
      const startIndex = globalIndex;
      globalIndex += chunk.words.length;
      return (
        <View
          key={index}
          onLayout={(e: LayoutChangeEvent) => { chunkOffsets.current[index] = e.nativeEvent.layout.y; }}
          style={styles.sentenceRow}
        >
          <Text style={styles.bodyText}>
            {chunk.words.map((word, w) => (
              <Text
                key={w}
                style={[
                  startIndex + w <= activeWordIndex ? styles.wordSpoken : styles.wordPending,
                  word.bold && styles.wordBold,
                ]}
              >
                {word.text}{' '}
              </Text>
            ))}
          </Text>
        </View>
      );
    });
  };

  return (
    <View style={styles.card}>
      <ScrollView
        ref={scrollRef}
        style={styles.textArea}
        contentContainerStyle={styles.textAreaContent}
        showsVerticalScrollIndicator={false}
      >
        {hasWordTimings
          ? renderWordSentences()
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
              renderWordSentences()
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
  imageRow: {
    marginBottom: 12,
  },
  contentImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: '#E5E6EA',
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
  wordBold: {
    fontFamily: FONTS.bold,
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
