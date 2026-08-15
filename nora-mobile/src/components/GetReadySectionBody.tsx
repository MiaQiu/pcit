/**
 * GetReadySectionBody
 * Renders one GetReadyToPlayScreen section's body on GetReadySectionScreen,
 * parsed via formatLessonContentV2 (the shared bold/italic, bullet, and
 * heading markdown used for lesson content). Shared out of
 * GetReadyToPlayScreen so both the list and the detail screen render body
 * markdown identically.
 */

import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { formatLessonContentV2 } from '../utils/formatLessonContentV2';

// A body line like `![](placeholder:building-blocks)` resolves to a local
// asset here when one's been supplied; any name not yet in this map still
// falls back to a labeled placeholder box instead of a broken image.
const PLACEHOLDER_PREFIX = 'placeholder:';
const PLACEHOLDER_IMAGES: Record<string, ReturnType<typeof require>> = {
  'building-blocks': require('../../assets/images/playguide1.jpg'),
  'pretend-play': require('../../assets/images/playguide2.jpg'),
  'creative-materials': require('../../assets/images/playguide3.jpg'),
};

export const GetReadySectionBody: React.FC<{ body: string }> = ({ body }) => {
  const blocks = useMemo(() => formatLessonContentV2(body), [body]);
  return (
    <View>
      {blocks.map((block, i) => {
        if (block.type === 'image') {
          if (block.url.startsWith(PLACEHOLDER_PREFIX)) {
            const name = block.url.slice(PLACEHOLDER_PREFIX.length);
            const asset = PLACEHOLDER_IMAGES[name];
            if (asset) {
              return (
                <View key={i} style={styles.imageRow}>
                  <Image source={asset} style={styles.contentImage} resizeMode="cover" />
                </View>
              );
            }
            return (
              <View key={i} style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={28} color="#B9A5DA" />
                <Text style={styles.imagePlaceholderLabel}>{name.replace(/-/g, ' ')}</Text>
              </View>
            );
          }
          return (
            <View key={i} style={styles.imageRow}>
              <Image source={{ uri: block.url }} style={styles.contentImage} resizeMode="cover" />
            </View>
          );
        }
        if (block.type === 'video') return null;
        const textStyle =
          block.type === 'bullet' ? styles.bulletText : block.type === 'heading' ? styles.sectionHeading : styles.paragraphText;
        return (
          <View key={i} style={block.type === 'bullet' ? styles.bulletRow : styles.paragraphRow}>
            {block.type === 'bullet' && <Text style={styles.bulletDot}>•</Text>}
            <Text style={textStyle}>
              {block.runs.map((run, j) => (
                <Text key={j} style={[run.bold && styles.boldRun, run.italic && styles.italicRun]}>
                  {run.text}
                </Text>
              ))}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  paragraphRow: {
    marginBottom: 18,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingLeft: 2,
  },
  bulletDot: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
    marginRight: 8,
  },
  paragraphText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
  },
  bulletText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
  },
  sectionHeading: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    lineHeight: 23,
    color: COLORS.textDark,
    marginTop: 22,
    marginBottom: 8,
  },
  boldRun: {
    fontFamily: FONTS.semiBold,
  },
  italicRun: {
    fontStyle: 'italic',
  },
  imageRow: {
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 20,
  },
  contentImage: {
    width: 300,
    height: 168,
    borderRadius: 12,
    backgroundColor: '#E5E6EA',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    width: 300,
    height: 168,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D8CCEF',
    backgroundColor: '#FAF8FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  imagePlaceholderLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9C8BB8',
    textTransform: 'capitalize',
    marginTop: 6,
  },
});
