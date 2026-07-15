/**
 * LessonPlaylistSheet
 * Bottom panel listing the other lessons in the current lesson's module (a
 * fixed curriculum, not a reorderable podcast queue — so no delete/clear,
 * just a sort toggle and tap-to-switch). Expand/collapse via a simple height
 * toggle rather than a full gesture-driven sheet, to keep this scoped.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import type { LessonCardData } from '@nora/core';

interface LessonPlaylistSheetProps {
  lessons: LessonCardData[];
  moduleTitle: string;
  currentLessonId: string;
  onSelectLesson: (lessonId: string) => void;
}

type SortMode = 'day' | 'recent';

export const LessonPlaylistSheet: React.FC<LessonPlaylistSheetProps> = ({
  lessons,
  moduleTitle,
  currentLessonId,
  onSelectLesson,
}) => {
  const [sortMode, setSortMode] = useState<SortMode>('day');
  const [expanded, setExpanded] = useState(true);

  const sortedLessons = useMemo(() => {
    const copy = [...lessons];
    if (sortMode === 'day') {
      return copy.sort((a, b) => a.dayNumber - b.dayNumber);
    }
    return copy.sort((a, b) => {
      const aTime = a.progress?.lastViewedAt ? new Date(a.progress.lastViewedAt).getTime() : 0;
      const bTime = b.progress?.lastViewedAt ? new Date(b.progress.lastViewedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [lessons, sortMode]);

  return (
    <View style={[styles.container, expanded && styles.containerExpanded]}>
      <TouchableOpacity style={styles.handleRow} onPress={() => setExpanded((v) => !v)}>
        <View style={styles.handle} />
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <Text style={styles.headerTitle} numberOfLines={1}>{moduleTitle}</Text>
        <View style={styles.sortToggle}>
          <TouchableOpacity
            style={[styles.sortOption, sortMode === 'day' && styles.sortOptionActive]}
            onPress={() => setSortMode('day')}
          >
            <Text style={[styles.sortOptionText, sortMode === 'day' && styles.sortOptionTextActive]}>Day order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortOption, sortMode === 'recent' && styles.sortOptionActive]}
            onPress={() => setSortMode('recent')}
          >
            <Text style={[styles.sortOptionText, sortMode === 'recent' && styles.sortOptionTextActive]}>Recent</Text>
          </TouchableOpacity>
        </View>
      </View>

      {expanded && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {sortedLessons.map((lesson) => {
            const isCurrent = lesson.id === currentLessonId;
            return (
              <TouchableOpacity
                key={lesson.id}
                style={[styles.row, isCurrent && styles.rowActive]}
                onPress={() => onSelectLesson(lesson.id)}
                disabled={isCurrent}
              >
                <Ionicons
                  name={isCurrent ? 'volume-high' : 'musical-note-outline'}
                  size={16}
                  color={isCurrent ? COLORS.mainPurple : '#9CA3AF'}
                  style={styles.rowIcon}
                />
                <View style={styles.rowTextColumn}>
                  <Text style={[styles.rowTitle, isCurrent && styles.rowTitleActive]} numberOfLines={1}>
                    Day {lesson.dayNumber} · {lesson.title}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {sortedLessons.length === 0 && (
            <Text style={styles.emptyText}>No other lessons in this module yet.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  containerExpanded: {
    flex: 1,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textDark,
    marginRight: 8,
  },
  sortToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  sortOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sortOptionActive: {
    backgroundColor: '#FFFFFF',
  },
  sortOptionText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#9CA3AF',
  },
  sortOptionTextActive: {
    color: COLORS.textDark,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowActive: {
    opacity: 1,
  },
  rowIcon: {
    marginRight: 10,
  },
  rowTextColumn: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
  },
  rowTitleActive: {
    color: COLORS.mainPurple,
    fontWeight: '600',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
