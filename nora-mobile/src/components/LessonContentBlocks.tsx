/**
 * LessonContentBlocks
 * Renders parsed lesson content (paragraphs/bullets with bold runs) from
 * formatLessonContentV2. Shared by LiveScriptCard's compact view, its full-text
 * expand modal, and any other LessonViewerScreen_v2 content surface — so the
 * bold/bullet rendering rules live in exactly one place.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '../constants/assets';
import { LESSON_TEXT_DARK, LESSON_TEXT_GREY } from '../constants/lessonViewerColors';
import type { ContentBlock } from '../utils/formatLessonContentV2';

interface LessonContentBlocksProps {
  blocks: ContentBlock[];
  activeIndex?: number;
}

export const LessonContentBlocks: React.FC<LessonContentBlocksProps> = ({ blocks, activeIndex }) => {
  return (
    <>
      {blocks.map((block, i) => {
        const dimmed = activeIndex !== undefined && i !== activeIndex;
        return (
          <View key={i} style={block.type === 'bullet' ? styles.bulletRow : styles.paragraph}>
            {block.type === 'bullet' && <Text style={[styles.bulletDot, dimmed && styles.dimmed]}>•</Text>}
            <Text style={[block.type === 'bullet' ? styles.bulletText : styles.bodyText, dimmed && styles.dimmed]}>
              {block.runs.map((run, j) => (
                <Text key={j} style={run.bold ? styles.bold : undefined}>{run.text}</Text>
              ))}
            </Text>
          </View>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  paragraph: {
    marginBottom: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingLeft: 4,
  },
  bulletDot: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: LESSON_TEXT_DARK,
    marginRight: 8,
    lineHeight: 24,
  },
  bodyText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: LESSON_TEXT_DARK,
  },
  bulletText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: LESSON_TEXT_DARK,
  },
  bold: {
    fontWeight: '700',
  },
  dimmed: {
    color: LESSON_TEXT_GREY,
  },
});
