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
import { SafeAreaView } from 'react-native-safe-area-context';
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

const lastViewedMillis = (l: LessonCardData) =>
  l.progress?.lastViewedAt ? new Date(l.progress.lastViewedAt).getTime() : 0;

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

  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [allLessons, setAllLessons] = useState<LessonCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [moduleFilter, setModuleFilter] = useState<LessonModule | null>(null);
  const [onlyUnfinished, setOnlyUnfinished] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const player = useLessonPlayer();

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
      if (modules.length > 0) fetchAndSave(i18n.language);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modules.length, i18n.language])
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

  const renderLessonRow = (lesson: LessonCardData) => {
    const isCompleted = lesson.progress?.status === 'COMPLETED';
    const isThisPlaying = player.activeLessonId === lesson.id;
    const durationLabel = formatDuration(lesson.durationSeconds);
    return (
      <View key={lesson.id} style={styles.row}>
        <TouchableOpacity
          style={styles.rowTitleTouchable}
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
          <Text style={styles.rowDuration}>
            {durationLabel}
            {isCompleted ? ' | completed' : ''}
          </Text>
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
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.mainPurple} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.coverBand}>
        <Image source={require('../../assets/images/prof_chen.png')} style={styles.coverImage} resizeMode="cover" />
        <View style={styles.coverTextColumn}>
          <Text style={styles.coverTitle} numberOfLines={2}>{t('learnV3.title')}</Text>
          <Text style={styles.coverSubtitle} numberOfLines={1}>{t('learnV3.subtitle')}</Text>
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
          {continueLesson && (
            <TouchableOpacity style={styles.continueButton} onPress={() => handlePlayCirclePress(continueLesson)}>
              <Ionicons name="play" size={13} color="#FFFFFF" />
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          )}
        </View>
        {continueLesson && (
          <Text style={styles.continueLine} numberOfLines={1}>
            Continue: {continueLesson.title}
          </Text>
        )}
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterChip} onPress={() => setShowModuleModal(true)}>
          <Text style={styles.filterChipText} numberOfLines={1}>
            {moduleFilter ? moduleByKey.get(moduleFilter)?.title ?? 'Module' : 'All Modules'}
          </Text>
          <Ionicons name="chevron-down" size={14} color={COLORS.textDark} />
        </TouchableOpacity>

        <View style={styles.unfinishedToggle}>
          <Text style={styles.unfinishedText}>Only unfinished</Text>
          <Switch value={onlyUnfinished} onValueChange={setOnlyUnfinished} />
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
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },

  coverBand: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    fontFamily: FONTS.regular,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    lineHeight: 24,
  },
  coverSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 6,
  },

  progressCard: {
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
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
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 10,
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
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

  list: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginTop: 20,
    marginBottom: 4,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowTitleTouchable: {
    width: '100%',
    paddingVertical: 8,
    marginVertical: -8,
  },
  rowTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 14,
  },
  rowTitlePlaying: {
    color: COLORS.mainPurple,
  },
  rowTitleCompleted: {
    color: '#9CA3AF',
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  rowDuration: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  playCircle: {
    width: 28,
    height: 28,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    marginTop: 5,
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
    color: COLORS.textDark,
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
});
