/**
 * Learn Screen v3
 * Single-course-style redesign of the Learn tab (replaces LearnScreen_v2 as
 * the live "Learn" tab via screens/index.ts, which is kept unreferenced
 * rather than deleted): a cover band, a progress/continue summary card, a
 * module filter + unfinished toggle row, and a lesson list grouped by module
 * with "{Module} (N lessons)" section headers — instead of ~26 separate
 * horizontally-scrolling module sections.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polygon, Circle } from 'react-native-svg';
import { FONTS, COLORS } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService } from '../contexts/AppContext';
import { handleApiError, handleApiSuccess } from '../utils/NetworkMonitor';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import type { ModuleWithProgress, LessonCardData, LessonModule, ModuleListResponse, LessonListResponse } from '@nora/core';
import { getCachedLessonData, saveLessonData, isCacheStale } from '../services/lessonDataCache';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';
import { CONTENT_V2_MODULES } from '../constants/contentV2Modules';
import { useLessonPlayer } from '../contexts/LessonPlayerContext';
import { LESSON_TEXT_DARK, LESSON_TEXT_GREY } from '../constants/lessonViewerColors';
import { LessonContentBlocks } from '../components/LessonContentBlocks';
import { formatLessonContentV2 } from '../utils/formatLessonContentV2';

// Admin-configurable via Settings → Branding in the admin portal; falls back
// to this bundled asset when no custom image has been uploaded.
const DEFAULT_COVER_IMAGE = require('../../assets/images/prof_chen.png');

const lastViewedMillis = (l: LessonCardData) =>
  l.progress?.lastViewedAt ? new Date(l.progress.lastViewedAt).getTime() : 0;

// The Read modal renders contentV2 through the same formatLessonContentV2 +
// LessonContentBlocks pipeline used elsewhere, so **bold**/"* " bullets/images/
// videos set in the admin editor actually render instead of showing as plain
// text. The one gap that pipeline doesn't cover: a lesson whose contentV2 is
// a raw, not-yet-formatted transcript (no paragraph breaks, no bold, no
// bullets, no media — i.e. nothing for the parser to key off) comes back as
// one giant paragraph. Only THAT case falls back to grouping sentences so it
// isn't a wall of text.
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

// Lessons with no audio/wordTimings yet have no durationSeconds — use a
// clearly-a-placeholder fallback rather than fabricating a number.
const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return '2:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Mini-player play/pause button doubles as a circular progress ring.
const PLAYER_RING_SIZE = 40;
const PLAYER_RING_RADIUS = 17;
const PLAYER_RING_CIRCUMFERENCE = 2 * Math.PI * PLAYER_RING_RADIUS;

export const LearnScreen_v3: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const lessonService = useLessonService();
  const { isOnline } = useNetworkStatus();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [allLessons, setAllLessons] = useState<LessonCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [moduleFilter, setModuleFilter] = useState<LessonModule | null>(null);
  const [onlyUnfinished, setOnlyUnfinished] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [scriptLesson, setScriptLesson] = useState<LessonCardData | null>(null);
  const [scriptContent, setScriptContent] = useState<string>('');
  const [scriptLoading, setScriptLoading] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverTitle, setCoverTitle] = useState<string | null>(null);
  const [coverSubtitle, setCoverSubtitle] = useState<string | null>(null);
  // Gates the initial render so the cover band never flashes the bundled
  // default image/copy before the admin-configured branding loads.
  const [brandingLoading, setBrandingLoading] = useState(true);
  const player = useLessonPlayer();

  useEffect(() => {
    lessonService.getBrandingImages()
      .then(({ learnCoverUrl, learnTitle, learnSubtitle }) => {
        setCoverImageUrl(learnCoverUrl);
        setCoverTitle(learnTitle);
        setCoverSubtitle(learnSubtitle);
      })
      .catch((err) => console.error('Failed to load branding images:', err))
      .finally(() => setBrandingLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyData = useCallback((modulesRes: ModuleListResponse, lessonsRes: LessonListResponse) => {
    handleApiSuccess();
    setModules(modulesRes.modules);
    const merged = lessonsRes.lessons.map(l => ({
      ...l,
      progress: l.progress ?? lessonsRes.userProgress?.[l.id],
    }));
    setAllLessons(merged);
  }, []);

  const fetchAndSave = async (locale: string) => {
    try {
      const [modulesRes, lessonsRes] = await Promise.all([
        lessonService.getModules(locale),
        lessonService.getLessons(undefined, locale),
      ]);
      applyData(modulesRes, lessonsRes);
      saveLessonData(locale, modulesRes, lessonsRes);
    } catch (err) {
      console.error('Failed to load learn data (v3):', err);
      handleApiError(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadData = async (showLoadingSpinner = true) => {
    const locale = i18n.language;
    const cached = await getCachedLessonData(locale);
    if (cached) {
      applyData(cached.modulesRes, cached.lessonsRes);
      setLoading(false);
      setIsRefreshing(false);
      if (isCacheStale(cached.cachedAt)) fetchAndSave(locale);
      return;
    }
    if (showLoadingSpinner) setLoading(true);
    else setIsRefreshing(true);
    await fetchAndSave(locale);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  useFocusEffect(
    useCallback(() => {
      amplitudeService.trackScreenView('Learn');
      fetchAndSave(i18n.language);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i18n.language])
  );

  const moduleByKey = useMemo(() => new Map(modules.map(m => [m.key, m])), [modules]);
  const orderedModules = useMemo(
    () =>
      modules
        .filter(m => CONTENT_V2_MODULES.includes(m.key))
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [modules]
  );

  // Flat list across the new Content V2 modules only, ordered by module displayOrder then day.
  const orderedLessons = useMemo(() => {
    const moduleOrder = new Map(orderedModules.map((m, i) => [m.key, i]));
    return allLessons
      .filter(l => CONTENT_V2_MODULES.includes(l.module) && !moduleByKey.get(l.module)?.isLocked)
      .sort((a, b) => {
        const diff = (moduleOrder.get(a.module) ?? 0) - (moduleOrder.get(b.module) ?? 0);
        return diff !== 0 ? diff : a.dayNumber - b.dayNumber;
      });
  }, [allLessons, orderedModules, moduleByKey]);

  const playingLesson = orderedLessons.find(l => l.id === player.activeLessonId);

  const handlePlayerFinish = useCallback(
    (finishedId: string) => {
      const idx = orderedLessons.findIndex((l) => l.id === finishedId);
      // Skip ahead to the next lesson that actually has narration; close the
      // mini-player if nothing further along the list has audio yet.
      const next = orderedLessons.slice(idx + 1).find((l) => l.audioUrl);
      if (next) player.loadLesson(next.id, next.audioUrl);
      else player.clear();
      lessonService
        .completeLesson(finishedId)
        .then(() => fetchAndSave(i18n.language))
        .catch((err) => console.error('Failed to mark lesson completed:', err));
    },
    [orderedLessons, player, lessonService, i18n.language]
  );

  // Only the focused screen should own "what plays next" — LessonViewerScreen_v2
  // registers its own (module-scoped) handler while it's on top.
  useFocusEffect(
    useCallback(() => {
      player.setOnFinish(handlePlayerFinish);
      return () => player.setOnFinish(null);
    }, [handlePlayerFinish, player])
  );

  const playProgress = player.durationMillis > 0
    ? Math.min(player.positionMillis / player.durationMillis, 1)
    : 0;

  const totalCount = orderedLessons.length;
  const completedCount = useMemo(
    () => orderedLessons.filter(l => l.progress?.status === 'COMPLETED').length,
    [orderedLessons]
  );
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const continueLesson = useMemo(() => {
    const inProgress = orderedLessons
      .filter(l => l.progress?.status === 'IN_PROGRESS')
      .sort((a, b) => lastViewedMillis(b) - lastViewedMillis(a));
    if (inProgress.length > 0) return inProgress[0];
    return orderedLessons.find(l => l.progress?.status !== 'COMPLETED');
  }, [orderedLessons]);

  const lastLearntLesson = useMemo(() => {
    return orderedLessons
      .filter(l => l.progress?.lastViewedAt)
      .sort((a, b) => lastViewedMillis(b) - lastViewedMillis(a))[0];
  }, [orderedLessons]);

  // While a lesson is actively playing, it takes over "Continue" and the
  // "Last viewed" badge — whatever's currently mid-playback beats stale
  // progress-based history.
  const displayContinueLesson = playingLesson ?? continueLesson;
  const displayLastLearntLesson = playingLesson ?? lastLearntLesson;

  const displayedLessons = useMemo(() => {
    let list = orderedLessons;
    if (moduleFilter) list = list.filter(l => l.module === moduleFilter);
    if (onlyUnfinished) list = list.filter(l => l.progress?.status !== 'COMPLETED');
    return list;
  }, [orderedLessons, moduleFilter, onlyUnfinished]);

  // Section-headed grouping: "{Module} (N lessons)" before each module's lessons.
  const groupedForDisplay = useMemo(() => {
    return orderedModules
      .filter(mod => !moduleFilter || mod.key === moduleFilter)
      .map(mod => ({
        module: mod,
        lessons: displayedLessons.filter(l => l.module === mod.key),
      }))
      .filter(group => group.lessons.length > 0);
  }, [orderedModules, moduleFilter, displayedLessons]);

  const handleLessonPress = (lesson: LessonCardData) => {
    const moduleKey = lesson.module;
    const mod = moduleByKey.get(moduleKey);
    amplitudeService.trackLessonStarted(lesson.id, lesson.title, { moduleKey, source: 'learn_v3' });
    if (CONTENT_V2_MODULES.includes(moduleKey)) {
      navigation.push('LessonViewerV2', { lessonId: lesson.id, moduleKey, moduleTitle: mod?.title });
    } else {
      const moduleLessons = orderedLessons.filter(l => l.module === moduleKey);
      const incomplete = moduleLessons.filter(
        l => l.id !== lesson.id && l.progress?.status !== 'COMPLETED'
      );
      const nextLesson =
        incomplete.find(l => l.dayNumber > lesson.dayNumber) ??
        incomplete.sort((a, b) => a.dayNumber - b.dayNumber)[0];
      navigation.push('LessonViewer', { lessonId: lesson.id, moduleKey, nextLessonId: nextLesson?.id });
    }
  };

  const handlePlayCirclePress = (lesson: LessonCardData) => {
    if (!lesson.audioUrl) {
      // No narration yet — fall back to the normal navigation everyone else uses.
      handleLessonPress(lesson);
      return;
    }
    if (player.activeLessonId === lesson.id) {
      if (player.isPlaying) player.pause();
      else player.play();
    } else {
      amplitudeService.trackLessonStarted(lesson.id, lesson.title, {
        moduleKey: lesson.module,
        source: 'learn_v3_inline',
      });
      player.loadLesson(lesson.id, lesson.audioUrl);
    }
  };

  const handleReadPress = async (lesson: LessonCardData) => {
    setScriptLesson(lesson);
    setScriptContent('');
    setScriptLoading(true);

    // Reading counts as viewing it — touch lastViewedAt so the "Last viewed"
    // badge picks it up, same as playing does. Don't set status here if the
    // lesson is already completed, so reopening a finished lesson to reread
    // it doesn't flip it back to IN_PROGRESS.
    const isCompleted = lesson.progress?.status === 'COMPLETED';
    lessonService
      .updateProgress(lesson.id, isCompleted ? { currentSegment: 1 } : { currentSegment: 1, status: 'IN_PROGRESS' })
      .then(() => fetchAndSave(i18n.language))
      .catch((err) => console.error('Failed to mark lesson as viewed:', err));

    try {
      const detail = await lessonService.getLessonDetail(lesson.id, i18n.language);
      setScriptContent(detail.lesson.contentV2 || '');
    } catch (err) {
      console.error('Failed to load lesson script:', err);
    } finally {
      setScriptLoading(false);
    }
  };

  const scriptFallbackParagraphs = useMemo(
    () => (isUnformattedBlob(scriptContent) ? splitIntoSentenceParagraphs(scriptContent) : null),
    [scriptContent]
  );
  const scriptBlocks = useMemo(
    () => (scriptFallbackParagraphs ? [] : formatLessonContentV2(scriptContent)),
    [scriptContent, scriptFallbackParagraphs]
  );

  const renderLessonRow = (lesson: LessonCardData) => {
    const isCompleted = lesson.progress?.status === 'COMPLETED';
    const isThisPlaying = player.activeLessonId === lesson.id;
    const durationLabel = formatDuration(lesson.durationSeconds);
    const isLastLearnt = displayLastLearntLesson?.id === lesson.id;
    return (
      <View key={lesson.id} style={styles.row}>
        {isLastLearnt && (
          <View style={styles.lastLearntBadge}>
            <Text style={styles.lastLearntBadgeText}>Last viewed</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.rowTitleTouchable, isLastLearnt && styles.rowTitleTouchableLastLearnt]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => handleLessonPress(lesson)}
        >
          <Text
            style={[
              styles.rowTitle,
              isCompleted && !isThisPlaying && styles.rowTitleCompleted,
              isThisPlaying && styles.rowTitlePlaying,
            ]}
            numberOfLines={2}
          >
            {lesson.title}
          </Text>
        </TouchableOpacity>
        <View style={styles.rowMetaRow}>
          <Text style={[styles.rowDuration, isCompleted && styles.rowDurationCompleted]}>
            {durationLabel}
            {isCompleted ? ' | completed' : ''}
          </Text>
          <View style={styles.rowActions}>
            <TouchableOpacity style={styles.readButton} onPress={() => handleReadPress(lesson)}>
              <Text style={styles.readButtonText}>Read</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.playCircle}
              onPress={() => handlePlayCirclePress(lesson)}
            >
              {isThisPlaying ? (
                <Ionicons name={player.isPlaying ? 'pause' : 'play'} size={15} color={COLORS.mainPurple} />
              ) : (
                <Svg width={14} height={14} viewBox="0 0 14 14">
                  <Polygon
                    points="3,2 3,12 12,7"
                    fill="none"
                    stroke="#6B7280"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </Svg>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading || brandingLoading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.mainPurple} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.coverBand}>
        <Image source={coverImageUrl ? { uri: coverImageUrl } : DEFAULT_COVER_IMAGE} style={styles.coverImage} resizeMode="cover" />
        <View style={styles.coverTextColumn}>
          <Text style={styles.coverTitle} numberOfLines={2}>{coverTitle ?? t('learnV3.title')}</Text>
          <Text style={styles.coverSubtitle} numberOfLines={2}>{coverSubtitle ?? t('learnV3.subtitle')}</Text>
        </View>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressRow}>
          <View style={styles.progressTextColumn}>
            <Text style={styles.progressText}>
              {completedCount} / {totalCount} lessons · {percent}% learned
            </Text>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
            </View>
          </View>
          {displayContinueLesson && (
            <TouchableOpacity style={styles.continueButton} onPress={() => handlePlayCirclePress(displayContinueLesson)}>
              <Ionicons name="play" size={13} color="#FFFFFF" />
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          )}
        </View>
        {displayContinueLesson && (
          <Text style={styles.continueLine} numberOfLines={1}>
            Continue: {displayContinueLesson.title}
          </Text>
        )}
      </View>

      <View style={styles.playlistCard}>
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterChip} onPress={() => setShowModuleModal(true)}>
            <Text style={styles.filterChipText} numberOfLines={1}>
              {moduleFilter ? moduleByKey.get(moduleFilter)?.title ?? 'Module' : 'All Modules'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.textDark} />
          </TouchableOpacity>

          <View style={styles.unfinishedToggle}>
            <Text style={styles.unfinishedText}>Only unfinished</Text>
            <Switch
              style={styles.unfinishedSwitch}
              value={onlyUnfinished}
              onValueChange={setOnlyUnfinished}
            />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadData(false)}
              enabled={isOnline}
              tintColor={COLORS.mainPurple}
            />
          }
        >
          <View style={styles.list}>
            {groupedForDisplay.map(group => (
              <View key={group.module.key}>
                <Text style={styles.sectionHeader}>
                  {group.module.title} ({group.module.lessonCount} lessons)
                </Text>
                {group.lessons.map(lesson => renderLessonRow(lesson))}
              </View>
            ))}
            {displayedLessons.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{t('learnV3.noLessonsFound')}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      <Modal visible={showModuleModal} transparent animationType="fade" onRequestClose={() => setShowModuleModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModuleModal(false)}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => { setModuleFilter(null); setShowModuleModal(false); }}
              >
                <Text style={styles.modalOptionText}>All Modules</Text>
                {!moduleFilter && <Ionicons name="checkmark" size={18} color={COLORS.mainPurple} />}
              </TouchableOpacity>
              {orderedModules.map(mod => (
                <TouchableOpacity
                  key={mod.key}
                  style={styles.modalOption}
                  disabled={mod.isLocked}
                  onPress={() => { setModuleFilter(mod.key); setShowModuleModal(false); }}
                >
                  <Text style={[styles.modalOptionText, mod.isLocked && styles.modalOptionTextDisabled]}>
                    {mod.title}
                  </Text>
                  {mod.isLocked ? (
                    <Ionicons name="lock-closed" size={16} color="#BBBBBB" />
                  ) : (
                    moduleFilter === mod.key && <Ionicons name="checkmark" size={18} color={COLORS.mainPurple} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!scriptLesson} animationType="slide" onRequestClose={() => setScriptLesson(null)}>
        <View style={[styles.scriptModalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.scriptModalHeader}>
            <TouchableOpacity
              onPress={() => setScriptLesson(null)}
              style={styles.scriptModalClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>
          {scriptLoading ? (
            <View style={styles.scriptModalLoading}>
              <ActivityIndicator size="large" color={COLORS.mainPurple} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scriptModalScrollContent} showsVerticalScrollIndicator={false}>
              {scriptLesson && (
                <View style={styles.scriptArticleHeader}>
                  <View
                    style={[
                      styles.scriptEyebrow,
                      { backgroundColor: moduleByKey.get(scriptLesson.module)?.backgroundColor ?? COLORS.cardPurple },
                    ]}
                  >
                    <Text style={styles.scriptEyebrowText}>
                      {moduleByKey.get(scriptLesson.module)?.title ?? 'Lesson'}
                    </Text>
                  </View>
                  <Text style={styles.scriptArticleTitle}>{scriptLesson.title}</Text>
                  <Text style={styles.scriptArticleMeta}>
                    Day {scriptLesson.dayNumber} · {formatDuration(scriptLesson.durationSeconds)}
                  </Text>
                  <View style={styles.scriptDivider} />
                </View>
              )}
              {scriptFallbackParagraphs ? (
                scriptFallbackParagraphs.map((paragraph, i) => (
                  <Text key={i} style={styles.scriptParagraph}>
                    {paragraph}
                  </Text>
                ))
              ) : (
                <LessonContentBlocks blocks={scriptBlocks} />
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {playingLesson && (
        <View style={styles.miniPlayer}>
          <View style={styles.miniPlayerIcon}>
            <Ionicons name="musical-notes" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.miniPlayerTextColumn}>
            <Text style={styles.miniPlayerTitle} numberOfLines={1}>{playingLesson.title}</Text>
            <Text style={styles.miniPlayerDuration}>{formatDuration(playingLesson.durationSeconds)}</Text>
          </View>
          <TouchableOpacity
            style={styles.miniPlayerPlayButton}
            onPress={() => (player.isPlaying ? player.pause() : player.play())}
            disabled={player.isLoading}
          >
            <Svg width={PLAYER_RING_SIZE} height={PLAYER_RING_SIZE} style={StyleSheet.absoluteFill}>
              <Circle
                cx={PLAYER_RING_SIZE / 2}
                cy={PLAYER_RING_SIZE / 2}
                r={PLAYER_RING_RADIUS}
                stroke="#E5E7EB"
                strokeWidth={3}
                fill="none"
              />
              <Circle
                cx={PLAYER_RING_SIZE / 2}
                cy={PLAYER_RING_SIZE / 2}
                r={PLAYER_RING_RADIUS}
                stroke={COLORS.mainPurple}
                strokeWidth={3}
                fill="none"
                strokeDasharray={`${PLAYER_RING_CIRCUMFERENCE} ${PLAYER_RING_CIRCUMFERENCE}`}
                strokeDashoffset={PLAYER_RING_CIRCUMFERENCE * (1 - playProgress)}
                strokeLinecap="round"
                transform={`rotate(-90 ${PLAYER_RING_SIZE / 2} ${PLAYER_RING_SIZE / 2})`}
              />
            </Svg>
            {player.isLoading ? (
              <ActivityIndicator size="small" color={COLORS.textDark} />
            ) : (
              <Ionicons name={player.isPlaying ? 'pause' : 'play'} size={16} color={COLORS.textDark} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.miniPlayerButton} onPress={() => player.clear()}>
            <Ionicons name="close" size={20} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7FB' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },

  coverBand: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7FB',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  coverImage: {
    width: 128,
    height: 128,
    borderRadius: 20,
    marginRight: 14,
  },
  coverTextColumn: {
    flex: 1,
  },
  coverTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    lineHeight: 24,
  },
  coverSubtitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.textDark,
    marginTop: 6,
  },

  progressCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 10,
    marginTop: 4,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTextColumn: {
    flex: 1,
  },
  progressText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.mainPurple,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.mainPurple,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  continueButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  continueLine: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.mainPurple,
    backgroundColor: COLORS.cardPurple,
    marginTop: 10,
    paddingHorizontal: 5,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },

  playlistCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 10,
    marginTop: 16,
    marginBottom: -20,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    //backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 0,
    paddingVertical: 8,
    maxWidth: 130,
  },
  filterChipText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textDark,
  },
  unfinishedToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  unfinishedText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textDark,
  },
  unfinishedSwitch: {
    transform: [{ scale: 0.5 }],
    // transform doesn't shrink the reserved layout box — pull the leftover
    // space in so the toggle sits close to its label instead of floating.
    marginVertical: -6,
    marginHorizontal: -8,
  },

  list: {
    marginTop: 8,
  },
  sectionHeader: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginTop: 20,
    marginBottom: 4,
  },
  row: {
    position: 'relative',
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastLearntBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.cardPurple,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    //marginBottom:3,
  },
  lastLearntBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.mainPurple,
  },
  rowTitleTouchable: {
    width: '100%',
    paddingVertical: 8,
    marginVertical: -8,
  },
  // The "Last viewed" badge sits absolutely above this row's top edge —
  // nudge the title down so there's a clean 2px gap instead of overlapping.
  rowTitleTouchableLastLearnt: {
    marginTop: 0,
  },
  rowTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 18,
    //marginTop:3,
  },
  rowTitlePlaying: {
    color: COLORS.mainPurple,
  },
  rowTitleCompleted: {
    color: '#8B8F9A',
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
   // marginTop: 0,
  },
  readButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  readButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textDark,
  },
  rowDuration: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  rowDurationCompleted: {
    color: '#8B8F9A',
  },
  playCircle: {
    width: 28,
    height: 28,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 56,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textDark,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#687087',
  },
  modalOptionTextDisabled: {
    color: '#BBBBBB',
  },

  miniPlayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  miniPlayerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.mainPurple,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  miniPlayerTextColumn: {
    flex: 1,
    marginRight: 8,
  },
  miniPlayerTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
  },
  miniPlayerDuration: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  miniPlayerPlayButton: {
    width: PLAYER_RING_SIZE,
    height: PLAYER_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlayerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scriptModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scriptModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scriptModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scriptModalLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scriptModalScrollContent: {
    paddingTop: 8,
    paddingBottom: 40,
    paddingHorizontal: 28,
  },
  scriptArticleHeader: {
    marginBottom: 8,
  },
  scriptEyebrow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 14,
  },
  scriptEyebrowText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textDark,
  },
  scriptArticleTitle: {
    fontFamily: FONTS.bold,
    fontSize: 25,
    lineHeight: 33,
    color: LESSON_TEXT_DARK,
    marginBottom: 10,
  },
  scriptArticleMeta: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: LESSON_TEXT_GREY,
    marginBottom: 22,
  },
  scriptDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 22,
  },
  scriptParagraph: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 27,
    color: LESSON_TEXT_DARK,
    marginBottom: 20,
  },
});
