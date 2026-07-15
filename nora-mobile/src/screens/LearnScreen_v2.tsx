/**
 * Learn Screen v2
 * Module sections with lesson image cards; first 4 shown, expand to see rest.
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
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar } from '../components/SearchBar';
import { FONTS, COLORS } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService } from '../contexts/AppContext';
import { handleApiError, handleApiSuccess } from '../utils/NetworkMonitor';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useToast } from '../components/ToastManager';
import type { ModuleWithProgress, LessonCardData, ModuleListResponse, LessonListResponse } from '@nora/core';
import * as userStorage from '../lib/userStorage';
import { resolveImageUris } from '../services/lessonImageCache';
import { getCachedLessonData, saveLessonData, isCacheStale } from '../services/lessonDataCache';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';
import { CONTENT_V2_MODULES } from '../constants/contentV2Modules';

const H_PAD = 20;
const CARD_GAP = 10;
const PREVIEW_COUNT = 4;

const LESSON_ICONS = [
  require('../../assets/images/lessons/1_icon.png'),
  require('../../assets/images/lessons/2_icon.png'),
  require('../../assets/images/lessons/3_icon.png'),
];

// ─── Lesson card ─────────────────────────────────────────────────────────────

interface LessonCardProps {
  lesson: LessonCardData;
  moduleColor: string;
  isModuleLocked: boolean;
  cardWidth: number;
  onPress: () => void;
  localImageUri?: string;
}

const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  moduleColor,
  isModuleLocked,
  cardWidth,
  onPress,
  localImageUri,
}) => {
  const status = lesson.progress?.status;
  const isCompleted = status === 'COMPLETED';
  const isInProgress = status === 'IN_PROGRESS';
  const fallbackIcon = LESSON_ICONS[(lesson.dayNumber - 1) % LESSON_ICONS.length];

  return (
    <TouchableOpacity
      style={[styles.lessonCard, { width: cardWidth }]}
      onPress={isModuleLocked ? undefined : onPress}
      activeOpacity={isModuleLocked ? 1 : 0.75}
      disabled={isModuleLocked}
    >
      {/* Image area */}
      <View style={[styles.lessonImageWrap, { backgroundColor: moduleColor }]}>
        {!lesson.dragonImageUrl && (
          <>
            <View style={[styles.decoCircleLg, { borderColor: 'rgba(255,255,255,0.18)' }]} />
            <View style={[styles.decoCircleSm, { borderColor: 'rgba(255,255,255,0.12)' }]} />
          </>
        )}
        <Image
          source={
            (localImageUri || lesson.dragonImageUrl)
              ? { uri: localImageUri || lesson.dragonImageUrl }
              : fallbackIcon
          }
          style={styles.lessonIcon}
          resizeMode="cover"
        />

        {/* Status badge */}
        {isCompleted && (
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
        )}
        {isInProgress && !isCompleted && (
          <View style={[styles.statusBadge, styles.statusBadgeProgress]}>
            <View style={styles.progressDot} />
          </View>
        )}

        {isModuleLocked && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.85)" />
          </View>
        )}
      </View>

      {/* Text */}
      <View style={styles.lessonCardText}>
        <Text style={styles.lessonTitle} numberOfLines={3}>{lesson.title}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── Module section ───────────────────────────────────────────────────────────

interface ModuleSectionProps {
  module: ModuleWithProgress;
  lessons: LessonCardData[];
  onLessonPress: (lessonId: string) => void;
  onModulePress: () => void;
  cardWidth: number;
  showLockedNotice: boolean;
  localImageUris: Record<string, string>;
}

const ModuleSection: React.FC<ModuleSectionProps> = ({
  module,
  lessons,
  onModulePress,
  onLessonPress,
  cardWidth,
  showLockedNotice,
  localImageUris,
}) => {
  const { t } = useTranslation();
  const sortedLessons = useMemo(() => {
    const incomplete = lessons.filter(l => l.progress?.status !== 'COMPLETED');
    const completed = lessons.filter(l => l.progress?.status === 'COMPLETED');
    return [...incomplete, ...completed];
  }, [lessons]);

  return (
    <View style={styles.moduleSection}>
      {/* Module header */}
      <TouchableOpacity style={styles.moduleHeader} onPress={onModulePress} activeOpacity={0.7}>
        <Text style={styles.moduleName}>{module.title}</Text>
        {module.isLocked
          ? <Ionicons name="lock-closed" size={18} color="#BBBBBB" />
          : <Ionicons name="chevron-forward" size={28} color={COLORS.textDark} />
        }
      </TouchableOpacity>

      {/* Locked notice */}
      {showLockedNotice && (
        <View style={styles.lockedNotice}>
          <Ionicons name="lock-closed" size={12} color="#BBBBBB" />
          <Text style={styles.lockedNoticeText}>{t('learnV2.lockedNotice')}</Text>
        </View>
      )}

      {/* Horizontal lesson row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lessonRow}
        style={styles.lessonRowScroll}
      >
        {sortedLessons.map(lesson => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            moduleColor={module.backgroundColor || COLORS.mainPurple}
            isModuleLocked={!!module.isLocked}
            cardWidth={cardWidth}
            onPress={() => onLessonPress(lesson.id)}
            localImageUri={localImageUris[lesson.id]}
          />
        ))}
      </ScrollView>
    </View>
  );
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export const LearnScreen_v2: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const lessonService = useLessonService();
  const { isOnline } = useNetworkStatus();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const cardWidth = (width - H_PAD * 2) / 2.3;

  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [allLessons, setAllLessons] = useState<LessonCardData[]>([]);
  const [localImageUris, setLocalImageUris] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFoundationCompleted, setIsFoundationCompleted] = useState(false);
  const [recommendedModules, setRecommendedModules] = useState<string[]>([]);
  const [currentModuleKey, setCurrentModuleKey] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData(false);
  }, [i18n.language]);

  useEffect(() => {
    if (allLessons.length === 0) return;
    resolveImageUris(allLessons, (id, uri) => {
      setLocalImageUris(prev => ({ ...prev, [id]: uri }));
    }).then(({ uris }) => {
      if (Object.keys(uris).length > 0) setLocalImageUris(prev => ({ ...prev, ...uris }));
    });
  }, [allLessons]);

  useFocusEffect(
    useCallback(() => {
      amplitudeService.trackScreenView('Learn');
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      loadCurrentModuleKey();
      if (modules.length > 0) fetchAndSave(i18n.language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modules.length, i18n.language])
  );

  const loadCurrentModuleKey = async () => {
    try {
      const key = await userStorage.getItem('module_picker_selected_module');
      setCurrentModuleKey(key);
    } catch {
      // ignore
    }
  };

  const applyData = useCallback((modulesRes: ModuleListResponse, lessonsRes: LessonListResponse) => {
    handleApiSuccess();
    setModules(modulesRes.modules);
    setIsFoundationCompleted(modulesRes.isFoundationCompleted);
    setRecommendedModules(modulesRes.recommendedModules || []);
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
      console.error('Failed to load learn data:', err);
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

  // Lessons grouped by module key, sorted by dayNumber
  const lessonsByModule = useMemo(() => {
    const map = new Map<string, LessonCardData[]>();
    for (const lesson of allLessons) {
      const key = lesson.module as string;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lesson);
    }
    for (const lessons of map.values()) {
      lessons.sort((a, b) => a.dayNumber - b.dayNumber);
    }
    return map;
  }, [allLessons]);

  // Sorted modules: FOUNDATION first, completed modules last, rest by activity
  const sortedModules = useMemo(() => {
    const isCompleted = (m: ModuleWithProgress) =>
      m.lessonCount > 0 && m.completedLessons >= m.lessonCount;

    return [...modules].sort((a, b) => {
      // FOUNDATION always first
      if (a.key === 'FOUNDATION') return -1;
      if (b.key === 'FOUNDATION') return 1;

      // Completed modules always last
      const aDone = isCompleted(a);
      const bDone = isCompleted(b);
      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;

      // Among non-completed: current module first
      if (currentModuleKey) {
        if (a.key === currentModuleKey) return -1;
        if (b.key === currentModuleKey) return 1;
      }

      // Then recommended
      if (isFoundationCompleted && recommendedModules.length > 0) {
        const ai = recommendedModules.indexOf(a.key);
        const bi = recommendedModules.indexOf(b.key);
        if (ai !== -1 && bi === -1) return -1;
        if (ai === -1 && bi !== -1) return 1;
        if (ai !== -1 && bi !== -1) return ai - bi;
      }

      // Then in-progress
      const aIP = a.completedLessons > 0 && a.completedLessons < a.lessonCount;
      const bIP = b.completedLessons > 0 && b.completedLessons < b.lessonCount;
      if (aIP && !bIP) return -1;
      if (!aIP && bIP) return 1;
      return 0;
    });
  }, [modules, currentModuleKey, isFoundationCompleted, recommendedModules]);

  // When searching, filter lessons within each module by title/subtitle/description
  const filteredLessonsByModule = useMemo(() => {
    if (!searchQuery.trim()) return lessonsByModule;
    const q = searchQuery.toLowerCase();
    const filtered = new Map<string, LessonCardData[]>();
    for (const [key, lessons] of lessonsByModule) {
      const matching = lessons.filter(
        l =>
          l.title.toLowerCase().includes(q) ||
          (l.subtitle?.toLowerCase().includes(q) ?? false) ||
          (l.description?.toLowerCase().includes(q) ?? false)
      );
      if (matching.length > 0) filtered.set(key, matching);
    }
    return filtered;
  }, [lessonsByModule, searchQuery]);

  const handleLessonPress = (lessonId: string, moduleKey: string) => {
    const mod = modules.find(m => m.key === moduleKey);
    if (mod?.isLocked) {
      showToast(t('learnV2.completeFoundationFirst'), 'info');
      return;
    }

    const moduleLessons = lessonsByModule.get(moduleKey) ?? [];
    const currentLesson = moduleLessons.find(l => l.id === lessonId);
    const currentDay = currentLesson?.dayNumber ?? 0;
    const incomplete = moduleLessons.filter(
      l => l.id !== lessonId && l.progress?.status !== 'COMPLETED'
    );
    const nextLesson =
      incomplete.find(l => l.dayNumber > currentDay) ??
      incomplete.sort((a, b) => a.dayNumber - b.dayNumber)[0];

    amplitudeService.trackLessonStarted(lessonId, currentLesson?.title ?? '', { moduleKey, source: 'learn' });
    if (CONTENT_V2_MODULES.includes(moduleKey)) {
      navigation.push('LessonViewerV2', { lessonId, moduleKey, moduleTitle: mod?.title, nextLessonId: nextLesson?.id });
    } else {
      navigation.push('LessonViewer', { lessonId, moduleKey, nextLessonId: nextLesson?.id });
    }
  };

  const visibleModules = sortedModules.filter(m => filteredLessonsByModule.has(m.key));

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.mainPurple} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        ref={scrollViewRef}
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('learnV2.title')}</Text>
          <Text style={styles.subtitle}>{t('learnV2.subtitle')}</Text>
        </View>

        {/* Search */}
        {/* <View style={styles.searchWrap}>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        </View> */}

        {/* Module sections */}
        <View style={styles.sections}>
          {visibleModules.map((mod, idx) => {
            const lessons = filteredLessonsByModule.get(mod.key) ?? [];
            const showLockedNotice = !!mod.isLocked && !isFoundationCompleted && idx > 0;
            return (
              <ModuleSection
                key={mod.key}
                module={mod}
                lessons={lessons}
                onLessonPress={lessonId => handleLessonPress(lessonId, mod.key)}
                onModulePress={() => { amplitudeService.trackEvent('Learn Module Tapped', { moduleKey: mod.key }); navigation.push('ModuleDetail', { moduleKey: mod.key }); }}
                cardWidth={cardWidth}
                showLockedNotice={showLockedNotice}
                localImageUris={localImageUris}
              />
            );
          })}
        </View>

        {visibleModules.length === 0 && modules.length > 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('learnV2.noLessonsFound')}</Text>
            <Text style={styles.emptyMessage}>{t('learnV2.tryDifferentSearch')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },

  header: { paddingHorizontal: H_PAD, paddingTop: 8, paddingBottom: 4 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: COLORS.textDark,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#9CA3AF',
    marginTop: 2,
  },

  searchWrap: { paddingHorizontal: H_PAD, marginTop: 12 },

  sections: { marginTop: 8 },

  // ── Module section ──
  moduleSection: {
    marginTop: 24,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
    gap: 4,
    paddingHorizontal: H_PAD,
  },
  moduleName: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.textDark,
    lineHeight: 32,
    letterSpacing: -0.3,
    flex: 1,
  },
  moduleProgress: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 1,
  },

  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    marginHorizontal: H_PAD,
  },
  lockedNoticeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#BBBBBB',
    flex: 1,
  },

  lessonRowScroll: { width: '100%' },
  lessonRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
    paddingHorizontal: H_PAD,
  },

  // ── Lesson card ──
  lessonCard: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 4,
  },
  lessonImageWrap: {
    aspectRatio: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonIcon: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  decoCircleLg: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 18,
    bottom: -28,
    right: -22,
  },
  decoCircleSm: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 12,
    top: -16,
    left: -8,
  },
  statusBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.mainPurple,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  statusBadgeProgress: {
    backgroundColor: '#F59E0B',
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  lessonCardText: {
    paddingHorizontal: 5,
    paddingTop: 8,
    paddingBottom: 11,
  },
  lessonDayLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  lessonTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textDark,
  },

  // ── Empty ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: H_PAD,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  emptyMessage: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
});
