/**
 * Lesson Read Screen
 * Plain-text reading view for a lesson's Content V2 script — the "read
 * version" of a lesson, as opposed to the audio-first LessonViewerV2 player.
 * Reuses the same fetch + format + render pipeline as LearnScreen_v3's Read
 * modal (formatLessonContentV2 + LessonContentBlocks), as a standalone
 * screen so other flows (e.g. the Demo Video detail screen) can link to it
 * directly without going through the Learn tab.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS } from '../constants/assets';
import { LESSON_TEXT_DARK, LESSON_TEXT_GREY } from '../constants/lessonViewerColors';
import { LessonContentBlocks } from '../components/LessonContentBlocks';
import { ShareSheet } from '../components/ShareSheet';
import { formatLessonContentV2 } from '../utils/formatLessonContentV2';
import { useLessonService } from '../contexts/AppContext';
import { RootStackParamList, RootStackNavigationProp } from '../navigation/types';

const SENTENCES_PER_FALLBACK_PARAGRAPH = 7;
const isUnformattedBlob = (text: string): boolean =>
  !/\n\s*\n/.test(text) && !/\*\*/.test(text) && !/^\* /m.test(text) && !/!\[/.test(text);
const splitIntoSentenceParagraphs = (text: string): string[] => {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? [text];
  const result: string[] = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_FALLBACK_PARAGRAPH) {
    result.push(sentences.slice(i, i + SENTENCES_PER_FALLBACK_PARAGRAPH).join('').trim());
  }
  return result.filter(Boolean);
};

type LessonReadRouteProp = RouteProp<RootStackParamList, 'LessonRead'>;

export const LessonReadScreen: React.FC = () => {
  const route = useRoute<LessonReadRouteProp>();
  const navigation = useNavigation<RootStackNavigationProp>();
  const { lessonId, title: initialTitle } = route.params;
  const lessonService = useLessonService();
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(initialTitle ?? '');
  const [content, setContent] = useState('');
  const [shareCount, setShareCount] = useState(0);
  const [moduleTitle, setModuleTitle] = useState('');
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    lessonService.getLessonDetail(lessonId, i18n.language)
      .then(detail => {
        if (cancelled) return;
        setTitle(detail.lesson.title);
        setContent(detail.lesson.contentV2 || '');
        setShareCount(detail.lesson.shareCount ?? 0);
        setModuleTitle(detail.lesson.moduleTitle || '');
      })
      .catch(err => console.error('Failed to load lesson script:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const fallbackParagraphs = useMemo(
    () => (isUnformattedBlob(content) ? splitIntoSentenceParagraphs(content) : null),
    [content]
  );
  const blocks = useMemo(
    () => (fallbackParagraphs ? [] : formatLessonContentV2(content)),
    [content, fallbackParagraphs]
  );

  const webUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3001';
  const shareUrl = `${webUrl}/share-lesson.html?lesson_id=${lessonId}`;
  const shareImageUrl = `${webUrl}/api/lessons/${lessonId}/share-image.png`;
  const handleShare = () => setShareSheetVisible(true);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backCircle} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{t('lessonRead.title')}</Text>
        <View style={styles.shareGroup}>
          {shareCount > 0 && <Text style={styles.shareCount}>{shareCount}</Text>}
          <TouchableOpacity onPress={handleShare} style={styles.backCircle} activeOpacity={0.7} accessibilityLabel="Share">
            <Ionicons name="share-outline" size={18} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.articleTitle}>{title}</Text>
          {!content ? (
            <Text style={styles.bodyText}>{t('lessonRead.noContent')}</Text>
          ) : fallbackParagraphs ? (
            fallbackParagraphs.map((p, i) => (
              <Text key={i} style={styles.bodyText}>{p}</Text>
            ))
          ) : (
            <LessonContentBlocks blocks={blocks} />
          )}
        </ScrollView>
      )}

      <ShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        targetUrl={shareUrl}
        title={moduleTitle || 'Nora'}
        subtitle={title}
        previewImageUrl={shareImageUrl}
      />
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
  shareGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 5,
  },
  shareCount: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
    marginHorizontal: 8,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },
  articleTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    color: LESSON_TEXT_DARK,
    marginTop: 8,
    marginBottom: 16,
  },
  bodyText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 25,
    color: LESSON_TEXT_GREY,
    marginBottom: 16,
  },
});
