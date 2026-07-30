/**
 * Demo Video Detail Screen
 * Full playback screen for a single "Demo Videos" entry: a short description,
 * the embedded video (native controls incl. fullscreen, audio on), and — if
 * the admin linked one — a link to the read version of the lesson that
 * teaches the skill being demonstrated.
 *
 * Rotating into landscape for a bigger view relies on the native player's
 * own fullscreen control rather than an app-wide orientation unlock — see
 * git history for the expo-screen-orientation attempt that was reverted
 * (native module wasn't available without a full native rebuild, which
 * hit unrelated Xcode/RN toolchain issues in this environment).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS } from '../constants/assets';
import { RootStackParamList, RootStackNavigationProp } from '../navigation/types';
import amplitudeService from '../services/amplitudeService';
import { formatLessonContentV2 } from '../utils/formatLessonContentV2';
import type { ContentBlock, TextRun } from '../utils/formatLessonContentV2';
import { LessonContentBlocks } from '../components/LessonContentBlocks';

type DemoVideoDetailRouteProp = RouteProp<RootStackParamList, 'DemoVideoDetail'>;

// A line authored as "Question||Answer||" in the admin's Additional Text
// field (via its Fold toolbar button) becomes one FAQ-style accordion row:
// everything before the ||...|| span is the always-visible header, the
// folded span (and anything after it on the same line) is the answer,
// hidden until tapped. A line with no fold marker is just a static header
// row with no +/- toggle.
interface FaqEntry {
  header: TextRun[];
  answer: TextRun[] | null;
}

function toFaqEntries(blocks: ContentBlock[]): FaqEntry[] {
  const entries: FaqEntry[] = [];
  for (const block of blocks) {
    if (block.type === 'image' || block.type === 'video') continue;
    const foldIndex = block.runs.findIndex((run) => run.folded);
    entries.push(
      foldIndex === -1
        ? { header: block.runs, answer: null }
        : { header: block.runs.slice(0, foldIndex), answer: block.runs.slice(foldIndex) }
    );
  }
  return entries;
}

function FaqRunText({ runs }: { runs: TextRun[] }) {
  return (
    <>
      {runs.map((run, i) => (
        <Text key={i} style={[run.bold && faqStyles.bold, run.italic && faqStyles.italic]}>{run.text}</Text>
      ))}
    </>
  );
}

const FaqAccordion: React.FC<{ blocks: ContentBlock[] }> = ({ blocks }) => {
  const entries = useMemo(() => toFaqEntries(blocks), [blocks]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <View style={faqStyles.list}>
      {entries.map((entry, i) => {
        const canToggle = entry.answer !== null;
        const isOpen = canToggle && expanded.has(i);
        return (
          <TouchableOpacity
            key={i}
            style={faqStyles.card}
            activeOpacity={canToggle ? 0.75 : 1}
            disabled={!canToggle}
            onPress={() => toggle(i)}
          >
            <View style={faqStyles.headerRow}>
              <Text style={[faqStyles.headerText, isOpen && faqStyles.headerTextOpen]}>
                <FaqRunText runs={entry.header} />
              </Text>
              {canToggle && (
                <Ionicons name={isOpen ? 'remove' : 'add'} size={20} color={isOpen ? COLORS.mainPurple : COLORS.textDark} />
              )}
            </View>
            {isOpen && entry.answer && (
              <Text style={faqStyles.answerText}>
                <FaqRunText runs={entry.answer} />
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export const DemoVideoDetailScreen: React.FC = () => {
  const route = useRoute<DemoVideoDetailRouteProp>();
  const navigation = useNavigation<RootStackNavigationProp>();
  const { video } = route.params;
  const { t } = useTranslation();

  useEffect(() => {
    amplitudeService.trackScreenView('DemoVideoDetail');
  }, []);

  const descriptionBlocks = useMemo(
    () => (video.description ? formatLessonContentV2(video.description) : []),
    [video.description]
  );
  const additionalTextBlocks = useMemo(
    () => (video.additionalText ? formatLessonContentV2(video.additionalText) : []),
    [video.additionalText]
  );

  const handleViewLesson = () => {
    if (!video.lessonId) return;
    amplitudeService.trackEvent('Demo Video Lesson Link Tapped', { demoVideoId: video.id, lessonId: video.lessonId });
    navigation.push('LessonRead', { lessonId: video.lessonId, moduleKey: video.moduleKey ?? undefined, title: video.lessonTitle ?? undefined });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backCircle} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.backCircle} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{video.title}</Text>
        {descriptionBlocks.length > 0 && (
          <View style={styles.description}>
            <LessonContentBlocks blocks={descriptionBlocks} />
          </View>
        )}

        <View style={styles.videoWrap}>
          <Video
            source={{ uri: video.videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
            isMuted={false}
            volume={1.0}
          />
        </View>

        {additionalTextBlocks.length > 0 && (
          <View style={styles.additionalText}>
            <FaqAccordion blocks={additionalTextBlocks} />
          </View>
        )}

        {!!video.lessonId && (
          <TouchableOpacity style={styles.lessonLink} onPress={handleViewLesson} activeOpacity={0.75}>
            <View style={styles.lessonLinkText}>
              <Text style={styles.lessonLinkTitle}>{t('demoVideoDetail.viewLesson')}</Text>
              {!!video.lessonTitle && (
                <Text style={styles.lessonLinkSubtitle} numberOfLines={1}>{video.lessonTitle}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={22} color={COLORS.mainPurple} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: COLORS.textDark,
    marginTop: 4,
  },
  description: {
    marginTop: 8,
  },
  additionalText: {
    marginTop: 18,
  },
  videoWrap: {
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginTop: 18,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  lessonLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#F5F0FC',
  },
  lessonLinkText: { flex: 1, marginRight: 12 },
  lessonLinkTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.mainPurple,
  },
  lessonLinkSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
});

const faqStyles = StyleSheet.create({
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#F7F7F9',
    borderRadius: 16,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textDark,
  },
  headerTextOpen: {
    color: COLORS.mainPurple,
  },
  answerText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    marginTop: 10,
  },
  bold: {
    fontFamily: FONTS.bold,
  },
  italic: {
    fontStyle: 'italic',
  },
});
