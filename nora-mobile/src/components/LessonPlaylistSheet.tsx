/**
 * LessonPlaylistSheet
 * Draggable bottom sheet listing lessons across all Content V2 modules (a
 * fixed curriculum, not a reorderable podcast queue — so no delete/clear/
 * reorder), grouped by module in module displayOrder, lessons sorted by day
 * within each group. Collapsed, it peeks up showing just the "Play List"
 * header; drag (or tap) the handle to slide it up to full screen for the
 * complete list. Auto-scrolls to and stops at the currently playing lesson's
 * row (highlighted in purple) whenever it changes or the sheet expands,
 * while keeping enough headroom above the row that its module header never
 * gets clipped.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, LayoutChangeEvent, Animated, PanResponder, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { LESSON_TEXT_DARK, LESSON_TEXT_GREY } from '../constants/lessonViewerColors';
import type { LessonCardData } from '@nora/core';

export interface PlaylistModule {
  key: string;
  title: string;
}

interface LessonPlaylistSheetProps {
  lessons: LessonCardData[];
  modules: PlaylistModule[];
  currentLessonId: string;
  onSelectLesson: (lessonId: string) => void;
  /** Height of the screen content above the sheet (nav/identity/script/audio bar) — when
   * provided, the collapsed sheet rests right below that content instead of at the very
   * bottom of the screen. */
  collapsedTop?: number;
}

// Approximate rendered height of a module header (paddingTop + text + paddingBottom)
// — kept as headroom above the target row so scrolling to a lesson never clips
// its section header, even when that lesson is the first one in its module.
const HEADER_ALLOWANCE = 44;
const COLLAPSED_HEIGHT = 90;
const DRAG_SNAP_THRESHOLD = 60;
const VELOCITY_SNAP_THRESHOLD = 0.4;

export const LessonPlaylistSheet: React.FC<LessonPlaylistSheetProps> = ({
  lessons,
  modules,
  currentLessonId,
  onSelectLesson,
  collapsedTop,
}) => {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The sheet lives inside a SafeAreaView (edges: top/left/right), whose own
  // content box is already shorter than the raw window by insets.top — size
  // and position the sheet against that same box, not the raw window, or it
  // ends up sitting insets.top too high (covering content above it).
  const availableHeight = windowHeight - insets.top;
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const groupOffsets = useRef<Record<string, number>>({});
  const rowOffsets = useRef<Record<string, number>>({});

  const expandedY = 12;
  const restingY = availableHeight - COLLAPSED_HEIGHT - insets.bottom;
  // Rest right below the content above the sheet (plus a little breathing room)
  // once we know its height, rather than always anchoring the peek to the
  // bottom of the screen.
  const collapsedY = collapsedTop ? Math.min(collapsedTop + 8, restingY) : restingY;

  const translateY = useRef(new Animated.Value(collapsedY)).current;
  const dragStartY = useRef(collapsedY);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  // PanResponder is created once (via useRef below), so its callbacks close over
  // whatever expandedY/collapsedY/snapTo were at creation time — route them
  // through refs kept current every render instead of raw closed-over values.
  const expandedYRef = useRef(expandedY);
  expandedYRef.current = expandedY;
  const collapsedYRef = useRef(collapsedY);
  collapsedYRef.current = collapsedY;

  useEffect(() => {
    if (expandedRef.current) return;
    dragStartY.current = collapsedY;
    Animated.spring(translateY, { toValue: collapsedY, useNativeDriver: true, bounciness: 4 }).start();
  }, [collapsedY]);

  const snapToRef = useRef((_toExpanded: boolean) => {});
  snapToRef.current = (toExpanded: boolean) => {
    setExpanded(toExpanded);
    Animated.spring(translateY, {
      toValue: toExpanded ? expandedYRef.current : collapsedYRef.current,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };
  const snapTo = (toExpanded: boolean) => snapToRef.current(toExpanded);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        dragStartY.current = expandedRef.current ? expandedYRef.current : collapsedYRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(Math.max(dragStartY.current + gesture.dy, expandedYRef.current), collapsedYRef.current);
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const draggedUp = gesture.dy < -DRAG_SNAP_THRESHOLD || gesture.vy < -VELOCITY_SNAP_THRESHOLD;
        const draggedDown = gesture.dy > DRAG_SNAP_THRESHOLD || gesture.vy > VELOCITY_SNAP_THRESHOLD;
        if (draggedUp) snapToRef.current(true);
        else if (draggedDown) snapToRef.current(false);
        else snapToRef.current(expandedRef.current);
      },
    })
  ).current;

  const groupedByModule = useMemo(() => {
    return modules
      .map((mod) => ({
        module: mod,
        lessons: lessons
          .filter((l) => l.module === mod.key)
          .sort((a, b) => a.dayNumber - b.dayNumber),
      }))
      .filter((group) => group.lessons.length > 0);
  }, [lessons, modules]);

  useEffect(() => {
    if (!expanded) return;
    const timeout = setTimeout(() => {
      const currentLesson = lessons.find((l) => l.id === currentLessonId);
      if (!currentLesson) return;
      const groupY = groupOffsets.current[currentLesson.module];
      const rowY = rowOffsets.current[currentLesson.id];
      if (groupY === undefined || rowY === undefined) return;
      // Never scroll past the group's own top, so the header stays visible
      // even when the target lesson is the first row in its module.
      const target = Math.max(groupY, groupY + rowY - HEADER_ALLOWANCE);
      scrollRef.current?.scrollTo({ y: Math.max(target, 0), animated: true });
    }, 100);
    return () => clearTimeout(timeout);
  }, [currentLessonId, expanded, lessons]);

  const renderRow = (lesson: LessonCardData) => {
    const isCurrent = lesson.id === currentLessonId;
    return (
      <TouchableOpacity
        key={lesson.id}
        style={[styles.row, isCurrent && styles.rowActive]}
        onPress={() => onSelectLesson(lesson.id)}
        onLayout={(e: LayoutChangeEvent) => { rowOffsets.current[lesson.id] = e.nativeEvent.layout.y; }}
        disabled={isCurrent}
      >
        {isCurrent ? (
          <Ionicons name="musical-notes" size={16} color={COLORS.mainPurple} style={styles.rowIcon} />
        ) : (
          <View style={styles.rowIcon} />
        )}
        <View style={styles.rowTextColumn}>
          <Text style={[styles.rowTitle, isCurrent && styles.rowTitleActive]} numberOfLines={1}>
            Day {lesson.dayNumber} · {lesson.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View
      style={[styles.container, { height: availableHeight, transform: [{ translateY }] }]}
    >
      <View {...panResponder.panHandlers}>
        <TouchableOpacity style={styles.handleRow} onPress={() => snapTo(!expanded)}>
          <View style={styles.handle} />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <Text style={styles.headerTitle} numberOfLines={1}>Play List</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
        scrollEnabled={expanded}
      >
        {groupedByModule.map((group) => (
          <View
            key={group.module.key}
            style={styles.moduleGroup}
            onLayout={(e: LayoutChangeEvent) => { groupOffsets.current[group.module.key] = e.nativeEvent.layout.y; }}
          >
            <Text style={styles.moduleHeader}>{group.module.title}</Text>
            {group.lessons.map((lesson) => renderRow(lesson))}
          </View>
        ))}
        {lessons.length === 0 && (
          <Text style={styles.emptyText}>No lessons yet.</Text>
        )}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    fontWeight: '600',
    color: LESSON_TEXT_DARK,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  moduleGroup: {
    marginBottom: 8,
  },
  moduleHeader: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    fontWeight: '600',
    color: LESSON_TEXT_DARK,
    textTransform: 'uppercase',
    paddingTop: 14,
    paddingBottom: 4,
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
    width: 16,
    marginRight: 10,
  },
  rowTextColumn: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: LESSON_TEXT_DARK,
  },
  rowTitleActive: {
    color: COLORS.mainPurple,
    fontWeight: '600',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: LESSON_TEXT_GREY,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
