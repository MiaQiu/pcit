/**
 * Learn Screen
 * Module-based browsing with search, filter chips, and featured card
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, Text, StyleSheet, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ModuleCard } from '../components/ModuleCard';
import { SearchBar } from '../components/SearchBar';
import { FilterChips } from '../components/FilterChips';
import { FONTS, COLORS } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService } from '../contexts/AppContext';
import { handleApiError, handleApiSuccess } from '../utils/NetworkMonitor';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import type { ModuleWithProgress } from '@nora/core';

export const LearnScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const lessonService = useLessonService();
  const { isOnline } = useNetworkStatus();
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  useEffect(() => {
    loadModules();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      if (modules.length > 0) {
        loadModules(false);
      }
    }, [modules.length])
  );

  const loadModules = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const response = await lessonService.getModules();
      handleApiSuccess();
      setModules(response.modules);
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

    return result;
  }, [modules, activeFilter, searchQuery]);

  const handleModulePress = (moduleKey: string) => {
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
            <Text style={styles.subheader}>Module Library
              {/* {filteredModules.length} {filteredModules.length === 1 ? 'module' : 'modules'} — Browse freely (no required order) */}
            </Text>
          )}

          {/* Module Cards */}
          {filteredModules.map(mod => (
            <ModuleCard
              key={mod.key}
              module={mod}
              onPress={() => handleModulePress(mod.key)}
            />
          ))}

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
});
