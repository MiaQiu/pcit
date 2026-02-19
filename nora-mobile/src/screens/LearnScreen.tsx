/**
 * Learn Screen
 * Module-based browsing with search, filter chips, and featured card
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, Text, StyleSheet, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ModuleCard } from '../components/ModuleCard';
import { SearchBar } from '../components/SearchBar';
import { FilterChips } from '../components/FilterChips';
import { FONTS, COLORS } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService } from '../contexts/AppContext';
import { handleApiError, handleApiSuccess } from '../utils/NetworkMonitor';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useToast } from '../components/ToastManager';
import type { ModuleWithProgress } from '@nora/core';

export const LearnScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const lessonService = useLessonService();
  const { isOnline } = useNetworkStatus();
  const { showToast } = useToast();
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [isFoundationCompleted, setIsFoundationCompleted] = useState(false);
  const [recommendedModules, setRecommendedModules] = useState<string[]>([]);
  const [currentModuleKey, setCurrentModuleKey] = useState<string | null>(null);

  useEffect(() => {
    loadModules();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      loadCurrentModuleKey();
      if (modules.length > 0) {
        loadModules(false);
      }
    }, [modules.length])
  );

  const loadCurrentModuleKey = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const key = await AsyncStorage.getItem('module_picker_selected_module');
      setCurrentModuleKey(key);
    } catch (error) {
      console.log('Failed to load current module key:', error);
    }
  };

  const loadModules = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const response = await lessonService.getModules();
      handleApiSuccess();
      setModules(response.modules);
      setIsFoundationCompleted(response.isFoundationCompleted);
      setRecommendedModules(response.recommendedModules || []);
    } catch (err) {
      console.error('Failed to load modules:', err);
      const errorMessage = handleApiError(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Build filter chips from modules
  const filterChips = useMemo(() => {
    const chips = [{ key: 'ALL', label: 'All' }];
    modules.forEach(mod => {
      chips.push({ key: mod.key, label: mod.shortName });
    });
    return chips;
  }, [modules]);

  // Filter modules by search and active chip
  const filteredModules = useMemo(() => {
    let result = modules;

    // Filter by chip
    if (activeFilter !== 'ALL') {
      result = result.filter(m => m.key === activeFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.title.toLowerCase().includes(query) ||
        m.shortName.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query)
      );
    }

    // Sort: Foundation always first, then apply context-dependent sorting
    result = [...result].sort((a, b) => {
      // Foundation always first
      if (a.key === 'FOUNDATION') return -1;
      if (b.key === 'FOUNDATION') return 1;

      // Current module (user's active selection) second
      if (currentModuleKey) {
        if (a.key === currentModuleKey) return -1;
        if (b.key === currentModuleKey) return 1;
      }

      // If Foundation is completed, sort recommended modules next
      if (isFoundationCompleted && recommendedModules.length > 0) {
        const aRecommendedIdx = recommendedModules.indexOf(a.key);
        const bRecommendedIdx = recommendedModules.indexOf(b.key);
        const aIsRecommended = aRecommendedIdx !== -1;
        const bIsRecommended = bRecommendedIdx !== -1;

        if (aIsRecommended && !bIsRecommended) return -1;
        if (!aIsRecommended && bIsRecommended) return 1;
        if (aIsRecommended && bIsRecommended) return aRecommendedIdx - bRecommendedIdx;
      }

      // Then in-progress modules (by most recent activity)
      const aInProgress = a.completedLessons > 0 && a.completedLessons < a.lessonCount;
      const bInProgress = b.completedLessons > 0 && b.completedLessons < b.lessonCount;

      if (aInProgress && !bInProgress) return -1;
      if (!aInProgress && bInProgress) return 1;
      if (aInProgress && bInProgress) {
        const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return bTime - aTime;
      }
      return 0;
    });

    return result;
  }, [modules, activeFilter, searchQuery, isFoundationCompleted, recommendedModules, currentModuleKey]);

  const handleModulePress = (moduleKey: string) => {
    const mod = modules.find(m => m.key === moduleKey);
    if (mod?.isLocked) {
      showToast('Complete the Foundation module first', 'info');
      return;
    }
    navigation.push('ModuleDetail', { moduleKey });
  };

  const handleBrowseAll = () => {
    setActiveFilter('ALL');
    setSearchQuery('');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadModules(false)}
            enabled={isOnline}
            tintColor={COLORS.mainPurple}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.mainTitle}>Explore lessons</Text>
        </View>

        <View style={styles.content}>
          {/* Search Bar */}
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Filter Chips */}
          <FilterChips
            chips={filterChips}
            activeKey={activeFilter}
            onSelect={setActiveFilter}
          />

          {/* Error state */}
          {error && !loading && modules.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Couldn't Load Modules</Text>
              <Text style={styles.emptyMessage}>{error}</Text>
            </View>
          )}

          {/* Module count */}
          {filteredModules.length > 0 && (
            <Text style={styles.subheader}>Module Library</Text>
          )}

          {/* Active Module Cards */}
          {filteredModules
            .filter(m => !(m.lessonCount > 0 && m.completedLessons >= m.lessonCount))
            .map((mod) => (
              <React.Fragment key={mod.key}>
                <ModuleCard
                  module={mod}
                  onPress={() => handleModulePress(mod.key)}
                  isCurrentModule={mod.key === currentModuleKey}
                />
                {/* Show locked notice after Foundation card */}
                {mod.key === 'FOUNDATION' && !isFoundationCompleted && filteredModules.length > 1 && (
                  <View style={styles.lockedNotice}>
                    <Ionicons name="lock-closed" size={14} color="#999999" />
                    <Text style={styles.lockedNoticeText}>
                      The other modules are locked. Please complete the Foundation module first.
                    </Text>
                  </View>
                )}
              </React.Fragment>
            ))
          }

          {/* Completed Modules */}
          {(() => {
            const completedModules = filteredModules.filter(
              m => m.lessonCount > 0 && m.completedLessons >= m.lessonCount
            );
            if (completedModules.length === 0) return null;
            return (
              <>
                <Text style={[styles.subheader, styles.completedSubheader]}>Completed modules</Text>
                {completedModules.map((mod) => (
                  <ModuleCard
                    key={mod.key}
                    module={mod}
                    onPress={() => handleModulePress(mod.key)}
                  />
                ))}
              </>
            );
          })()}

          {/* No results */}
          {filteredModules.length === 0 && modules.length > 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No modules found</Text>
              <Text style={styles.emptyMessage}>
                Try a different search term or filter
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  mainTitle: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: COLORS.textDark,
    marginTop: 8,
  },
  content: {
    paddingHorizontal: 24,
  },
  subheader: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  completedSubheader: {
    marginTop: 8,
    color: '#999999',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  lockedNoticeText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#999999',
    flex: 1,
    lineHeight: 18,
  },
});
