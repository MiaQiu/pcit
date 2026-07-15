/**
 * LessonViewerScreen_v2
 * Podcast-style lesson viewer: live script view on top, playback controls in
 * the middle, sibling-lesson playlist at the bottom. Driven by Lesson.contentV2
 * + Lesson.audioUrl. Separate from LessonViewerScreen (segmented/quiz flow).
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AudioPlayBar } from '../components/AudioPlayBar';
import { LiveScriptCard } from '../components/LiveScriptCard';
import { LessonPlaylistSheet } from '../components/LessonPlaylistSheet';
import { COLORS, FONTS } from '../constants/assets';
import type { LessonDetailResponse, LessonCardData, LessonModule } from '@nora/core';
import { useLessonService } from '../contexts/AppContext';
import { formatLessonContentV2 } from '../utils/formatLessonContentV2';
import { useLessonAudioPlayer } from '../hooks/useLessonAudioPlayer';
import amplitudeService from '../services/amplitudeService';

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
  const [siblingLessons, setSiblingLessons] = useState<LessonCardData[]>([]);
  const isFirstLoad = useRef(true);

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
    if (!moduleKey) return;
    let cancelled = false;
    lessonService
      .getLessons(moduleKey as LessonModule, i18n.language)
      .then((res) => {
        if (!cancelled) setSiblingLessons(res.lessons);
      })
      .catch((err) => console.error('Failed to load sibling lessons:', err));
    return () => {
      cancelled = true;
    };
  }, [moduleKey, i18n.language]);

  const dayOrdered = useMemo(
    () => [...siblingLessons].sort((a, b) => a.dayNumber - b.dayNumber),
    [siblingLessons]
  );
  const currentIndex = dayOrdered.findIndex((l) => l.id === currentLessonId);
  const prevLesson = currentIndex > 0 ? dayOrdered[currentIndex - 1] : undefined;
  const nextLesson = currentIndex >= 0 && currentIndex < dayOrdered.length - 1 ? dayOrdered[currentIndex + 1] : undefined;

  const handleFinish = useCallback(() => {
    setCurrentLessonId((id) => {
      const idx = dayOrdered.findIndex((l) => l.id === id);
      const next = idx >= 0 && idx < dayOrdered.length - 1 ? dayOrdered[idx + 1] : undefined;
      return next ? next.id : id;
    });
  }, [dayOrdered]);

  const lesson = lessonData?.lesson;
  const player = useLessonAudioPlayer(lesson?.audioUrl, { onFinish: handleFinish });

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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close lesson"
        >
          <Ionicons name="chevron-down" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTextColumn}>
          {resolvedModuleTitle ? (
            <Text style={styles.headerModule} numberOfLines={1}>{resolvedModuleTitle}</Text>
          ) : null}
          <Text style={styles.headerTitle} numberOfLines={1}>Day {lesson.dayNumber} · {lesson.title}</Text>
        </View>
        <View style={styles.closeButton} />
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
          onPause={player.pause}
          onSeekTo={player.seekTo}
          onSeekBy={player.seekBy}
          onCycleRate={player.cycleRate}
          onPrev={prevLesson ? () => setCurrentLessonId(prevLesson.id) : undefined}
          onNext={nextLesson ? () => setCurrentLessonId(nextLesson.id) : undefined}
          hasPrev={!!prevLesson}
          hasNext={!!nextLesson}
        />
      ) : null}

      {moduleKey ? (
        <LessonPlaylistSheet
          lessons={siblingLessons}
          moduleTitle={resolvedModuleTitle}
          currentLessonId={currentLessonId}
          onSelectLesson={setCurrentLessonId}
        />
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextColumn: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerModule: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  headerTitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    fontWeight: '600',
  },
});
