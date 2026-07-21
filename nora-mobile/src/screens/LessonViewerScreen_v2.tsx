/**
 * LessonViewerScreen_v2
 * Podcast-style lesson viewer: live script view on top, playback controls in
 * the middle, sibling-lesson playlist at the bottom. Driven by Lesson.contentV2
 * + Lesson.audioUrl. Separate from LessonViewerScreen (segmented/quiz flow).
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AudioPlayBar } from '../components/AudioPlayBar';
import { LiveScriptCard } from '../components/LiveScriptCard';
import { LessonPlaylistSheet, PlaylistModule } from '../components/LessonPlaylistSheet';
import { COLORS, FONTS } from '../constants/assets';
import type { LessonDetailResponse, LessonCardData } from '@nora/core';
import { useLessonService } from '../contexts/AppContext';
import { formatLessonContentV2 } from '../utils/formatLessonContentV2';
import { useLessonPlayer } from '../contexts/LessonPlayerContext';
import { CONTENT_V2_MODULES } from '../constants/contentV2Modules';
import { LESSON_TEXT_DARK, LESSON_TEXT_GREY } from '../constants/lessonViewerColors';
import amplitudeService from '../services/amplitudeService';

// Admin-configurable via Settings → Branding in the admin portal; falls back
// to this bundled asset when no custom image has been uploaded.
const DEFAULT_IDENTITY_IMAGE = require('../../assets/images/prof_chen.png');

interface LessonViewerScreenV2Props {
  route: {
    params: {
      lessonId: string;
      moduleKey?: string;
      moduleTitle?: string;
    };
  };
  navigation: any;
}

function humanizeModuleKey(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export const LessonViewerScreenV2: React.FC<LessonViewerScreenV2Props> = ({ route, navigation }) => {
  const { moduleKey, moduleTitle: initialModuleTitle } = route.params;
  const { i18n } = useTranslation();
  const lessonService = useLessonService();

  const [currentLessonId, setCurrentLessonId] = useState(route.params.lessonId);
  const [loading, setLoading] = useState(true);
  const [lessonData, setLessonData] = useState<LessonDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playlistLessons, setPlaylistLessons] = useState<LessonCardData[]>([]);
  const [playlistModules, setPlaylistModules] = useState<PlaylistModule[]>([]);
  const [contentHeight, setContentHeight] = useState(0);
  const [identityImageUrl, setIdentityImageUrl] = useState<string | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    lessonService.getBrandingImages()
      .then(({ lessonViewerUrl }) => setIdentityImageUrl(lessonViewerUrl))
      .catch((err) => console.error('Failed to load branding images:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    lessonService
      .getLessonDetail(currentLessonId, i18n.language)
      .then((data) => {
        if (cancelled) return;
        setLessonData(data);
        amplitudeService.trackLessonStarted(currentLessonId, data.lesson.title, {
          moduleKey,
          source: isFirstLoad.current ? 'lesson_viewer_v2' : 'lesson_viewer_v2_track_change',
        });
        isFirstLoad.current = false;
      })
      .catch((err) => {
        console.error('Failed to load lesson (v2):', err);
        if (!cancelled) setError(err.message || 'Failed to load lesson');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentLessonId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      lessonService.getLessons(undefined, i18n.language),
      lessonService.getModules(i18n.language),
    ])
      .then(([lessonsRes, modulesRes]) => {
        if (cancelled) return;
        setPlaylistLessons(lessonsRes.lessons.filter((l) => CONTENT_V2_MODULES.includes(l.module)));
        setPlaylistModules(
          modulesRes.modules
            .filter((m) => CONTENT_V2_MODULES.includes(m.key))
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((m) => ({ key: m.key, title: m.title }))
        );
      })
      .catch((err) => console.error('Failed to load playlist lessons/modules:', err));
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  const dayOrdered = useMemo(
    () =>
      playlistLessons
        .filter((l) => !moduleKey || l.module === moduleKey)
        .sort((a, b) => a.dayNumber - b.dayNumber),
    [playlistLessons, moduleKey]
  );
  const currentIndex = dayOrdered.findIndex((l) => l.id === currentLessonId);
  const prevLesson = currentIndex > 0 ? dayOrdered[currentIndex - 1] : undefined;
  const nextLesson = currentIndex >= 0 && currentIndex < dayOrdered.length - 1 ? dayOrdered[currentIndex + 1] : undefined;

  const player = useLessonPlayer();

  const lesson = lessonData?.lesson;

  // Attach to (or start) the shared player for whichever lesson this screen
  // is currently showing. No-ops if it's already the active track elsewhere
  // (e.g. started from the LearnScreen_v3 mini-player), so opening this
  // screen inherits the exact playing/paused state and position instead of
  // restarting a second Sound instance for the same audio.
  useEffect(() => {
    if (!lesson) return;
    player.loadLesson(lesson.id, lesson.audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, lesson?.audioUrl]);

  const handleFinish = useCallback(
    (finishedId: string) => {
      const idx = dayOrdered.findIndex((l) => l.id === finishedId);
      const next = idx >= 0 && idx < dayOrdered.length - 1 ? dayOrdered[idx + 1] : undefined;
      if (next) {
        setCurrentLessonId(next.id);
        player.loadLesson(next.id, next.audioUrl);
      } else {
        player.clear();
      }
      lessonService
        .completeLesson(finishedId)
        .catch((err) => console.error('Failed to mark lesson completed:', err));
    },
    [dayOrdered, lessonService, player]
  );

  // Only the focused screen should own "what plays next" — LearnScreen_v3
  // registers its own (cross-module) handler while it's on top.
  useFocusEffect(
    useCallback(() => {
      player.setOnFinish(handleFinish);
      return () => player.setOnFinish(null);
    }, [handleFinish, player])
  );

  const blocks = useMemo(() => formatLessonContentV2(lesson?.contentV2 || ''), [lesson?.contentV2]);

  const handlePlayPause = () => {
    if (player.isPlaying) player.pause();
    else player.play();
  };

  const resolvedModuleTitle = initialModuleTitle || (moduleKey ? humanizeModuleKey(moduleKey) : '');

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !lesson) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Lesson not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Close lesson"
          >
            <Ionicons name="chevron-down" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.identityRow}>
          <Image source={identityImageUrl ? { uri: identityImageUrl } : DEFAULT_IDENTITY_IMAGE} style={styles.identityImage} resizeMode="cover" />
          <View style={styles.identityTextColumn}>
            <Text style={styles.identityTitle} numberOfLines={2}>
              Day {lesson.dayNumber} · {lesson.title}
            </Text>
            {resolvedModuleTitle ? (
              <Text style={styles.identitySubtitle} numberOfLines={1}>{resolvedModuleTitle}</Text>
            ) : null}
          </View>
        </View>

        <LiveScriptCard
          blocks={blocks}
          wordTimings={lesson.wordTimings}
          positionMillis={player.positionMillis}
          durationMillis={player.durationMillis}
        />

        {lesson.audioUrl ? (
          <AudioPlayBar
            isLoading={player.isLoading}
            isPlaying={player.isPlaying}
            positionMillis={player.positionMillis}
            durationMillis={player.durationMillis}
            rate={player.rate}
            onPlayPause={handlePlayPause}
            onSeekTo={player.seekTo}
            onSeekBy={player.seekBy}
            onCycleRate={player.cycleRate}
            onPrev={prevLesson ? () => setCurrentLessonId(prevLesson.id) : undefined}
            onNext={nextLesson ? () => setCurrentLessonId(nextLesson.id) : undefined}
            hasPrev={!!prevLesson}
            hasNext={!!nextLesson}
          />
        ) : null}
      </View>

      <LessonPlaylistSheet
        lessons={playlistLessons}
        modules={playlistModules}
        currentLessonId={currentLessonId}
        onSelectLesson={setCurrentLessonId}
        collapsedTop={contentHeight}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: LESSON_TEXT_DARK,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  identityImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 14,
    overflow: 'hidden',
  },
  identityTextColumn: {
    flex: 1,
  },
  identityTitle: {
    fontFamily: FONTS.regular,
    fontSize: 18,
    fontWeight: '700',
    color: LESSON_TEXT_DARK,
    lineHeight: 24,
  },
  identitySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: LESSON_TEXT_GREY,
    marginTop: 6,
  },
});
