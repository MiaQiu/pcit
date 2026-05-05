/**
 * ModuleDetailScreen
 * Shows module info and all its lessons in a 2-column card grid.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService } from '../contexts/AppContext';
import { useToast } from '../components/ToastManager';
import type { ModuleDetailResponse } from '@nora/core';
import * as userStorage from '../lib/userStorage';
import { resolveImageUris } from '../services/lessonImageCache';
import { useTranslation } from 'react-i18next';

const H_PAD = 20;
const CARD_GAP = 10;

const LESSON_ICONS = [
  require('../../assets/images/lessons/1_icon.png'),
  require('../../assets/images/lessons/2_icon.png'),
  require('../../assets/images/lessons/3_icon.png'),
];

export const ModuleDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<any>();
  const { moduleKey } = route.params;
  const lessonService = useLessonService();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const cardWidth = (width - H_PAD * 2 - CARD_GAP) / 2;

  const [data, setData] = useState<ModuleDetailResponse | null>(null);
  const [localImageUris, setLocalImageUris] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isCurrentModule, setIsCurrentModule] = useState(false);

  useEffect(() => {
    loadModuleDetail();
    checkIfCurrentModule();
  }, [moduleKey]);

  useEffect(() => {
    const lessons = data?.lessons;
    if (!lessons || lessons.length === 0) return;
    resolveImageUris(lessons).then(({ uris, pendingDownloads }) => {
      if (Object.keys(uris).length > 0) setLocalImageUris(prev => ({ ...prev, ...uris }));
      pendingDownloads.then(newUris => {
        if (Object.keys(newUris).length > 0) setLocalImageUris(prev => ({ ...prev, ...newUris }));
      });
    });
  }, [data]);

  useFocusEffect(
    useCallback(() => {
      if (data) loadModuleDetail(false);
    }, [data?.module?.key])
  );

  const loadModuleDetail = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      else setIsRefreshing(true);
      const response = await lessonService.getModuleDetail(moduleKey);
      setData(response);
      setIsLocked(false);
    } catch (error: any) {
      console.error('Failed to load module detail:', error);
      if (error?.status === 403 || error?.statusCode === 403) {
        setIsLocked(true);
        showToast('Complete the Foundation module first', 'info');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const checkIfCurrentModule = async () => {
    try {
      const selected = await userStorage.getItem('module_picker_selected_module');
      setIsCurrentModule(selected === moduleKey);
    } catch {}
  };

  const handleSetAsCurrentModule = async () => {
    try {
      await userStorage.setItem('module_picker_selected_module', moduleKey);
      setIsCurrentModule(true);
      showToast('Set as your daily lesson', 'success');
    } catch {}
  };

  const handleLessonPress = (lessonId: string) => {
    navigation.push('LessonViewer', { lessonId, moduleKey });
  };

  // Shared top bar — always rendered so layout is stable across all states
  const topBar = (title: string) => (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backCircle} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
      </TouchableOpacity>
      <Text style={styles.topBarTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.backCirclePlaceholder} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {topBar('')}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
        </View>
      </SafeAreaView>
    );
  }

  if (isLocked) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {topBar('')}
        <View style={styles.lockedContainer}>
          <Ionicons name="lock-closed" size={48} color="#CCCCCC" />
          <Text style={styles.lockedTitle}>{t('moduleDetail.moduleLocked')}</Text>
          <Text style={styles.lockedMessage}>{t('moduleDetail.lockedMessage')}</Text>
          <TouchableOpacity
            style={styles.goToFoundationBtn}
            onPress={() => {
              navigation.goBack();
              setTimeout(() => navigation.push('ModuleDetail', { moduleKey: 'FOUNDATION' }), 100);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.goToFoundationText}>{t('moduleDetail.goToFoundation')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const { module: mod, lessons } = data;
  const completedCount = lessons.filter(l => l.progress?.status === 'COMPLETED').length;
  const moduleColor = mod.backgroundColor || COLORS.mainPurple;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {topBar(mod.title)}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadModuleDetail(false)}
            tintColor={COLORS.mainPurple}
          />
        }
      >
        {/* Module info */}
        <View style={styles.moduleInfo}>
          <Text style={styles.title}>{mod.title}</Text>
          {mod.description ? (
            <Text style={styles.description}>{mod.description}</Text>
          ) : null}

          {mod.key !== 'FOUNDATION' && completedCount < lessons.length && (
            <TouchableOpacity
              style={isCurrentModule ? styles.currentModuleBtn : styles.startModuleBtn}
              onPress={handleSetAsCurrentModule}
              activeOpacity={0.7}
              disabled={isCurrentModule}
            >
              {isCurrentModule && <Ionicons name="checkmark" size={16} color={COLORS.mainPurple} />}
              <Text style={isCurrentModule ? styles.currentModuleBtnText : styles.startModuleBtnText}>
                {isCurrentModule ? 'Current module' : 'Set as daily lesson'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2-column card grid */}
        <View style={styles.grid}>
          {lessons.map((lesson) => {
            const isCompleted = lesson.progress?.status === 'COMPLETED';
            const isInProgress = lesson.progress?.status === 'IN_PROGRESS';
            const fallbackIcon = LESSON_ICONS[(lesson.dayNumber - 1) % LESSON_ICONS.length];
            const imageUrl = localImageUris[lesson.id] || (lesson as any).dragonImageUrl;

            return (
              <TouchableOpacity
                key={lesson.id}
                style={[styles.card, { width: cardWidth }]}
                onPress={() => handleLessonPress(lesson.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.cardImageWrap, { backgroundColor: moduleColor }]}>
                  {!imageUrl && (
                    <>
                      <View style={styles.decoCircleLg} />
                      <View style={styles.decoCircleSm} />
                    </>
                  )}
                  <Image
                    source={imageUrl ? { uri: imageUrl } : fallbackIcon}
                    style={styles.cardIcon}
                    resizeMode="cover"
                  />
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
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{lesson.title}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCirclePlaceholder: { width: 34 },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
    marginHorizontal: 8,
  },

  scrollContent: { paddingBottom: 40 },

  moduleInfo: { paddingHorizontal: H_PAD, paddingTop: 16, paddingBottom: 16 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.textDark,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    marginBottom: 12,
  },

  startModuleBtn: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  startModuleBtnText: { fontFamily: FONTS.semiBold, fontSize: 15, color: '#FFFFFF' },
  currentModuleBtn: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.mainPurple,
  },
  currentModuleBtnText: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.mainPurple },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    paddingHorizontal: H_PAD,
  },

  card: {
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
  cardImageWrap: {
    aspectRatio: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
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
    borderColor: 'rgba(255,255,255,0.18)',
    bottom: -28,
    right: -22,
  },
  decoCircleSm: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 12,
    borderColor: 'rgba(255,255,255,0.12)',
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
  statusBadgeProgress: { backgroundColor: '#F59E0B' },
  progressDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },

  cardText: { padding: 10, paddingBottom: 11 },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textDark,
  },

  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockedTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  lockedMessage: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  goToFoundationBtn: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  goToFoundationText: { fontFamily: FONTS.semiBold, fontSize: 16, color: '#FFFFFF' },
});
