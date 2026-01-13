/**
 * Keyword Definition Modal
 * Displays keyword definitions when users tap on underlined terms in lessons
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { FONTS, COLORS } from '../constants/assets';
import { Keyword } from '@nora/core';

interface KeywordDefinitionModalProps {
  visible: boolean;
  keyword: Keyword | null;
  onClose: () => void;
}

/**
 * Format definition text with markdown-like formatting:
 * - Convert **text** to bold
 * - Preserve line breaks
 */
const formatDefinitionText = (text: string) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (line.trim() === '') {
      // Empty line - add spacing
      elements.push(<View key={`space-${lineIndex}`} style={{ height: 8 }} />);
      return;
    }

    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    // Regex to find **text** patterns
    const boldRegex = /\*\*(.+?)\*\*/g;
    let match;

    while ((match = boldRegex.exec(line)) !== null) {
      // Add text before the bold part
      if (match.index > currentIndex) {
        parts.push(line.substring(currentIndex, match.index));
      }

      // Add bold text
      parts.push(
        <Text key={`bold-${lineIndex}-${match.index}`} style={{ fontFamily: FONTS.bold }}>
          {match[1]}
        </Text>
      );

      currentIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (currentIndex < line.length) {
      parts.push(line.substring(currentIndex));
    }

    // Add the formatted line
    elements.push(
      <Text key={lineIndex} style={styles.definitionLine}>
        {parts.length > 0 ? parts : line}
      </Text>
    );
  });

  return <View>{elements}</View>;
};

export const KeywordDefinitionModal: React.FC<KeywordDefinitionModalProps> = ({
  visible,
  keyword,
  onClose
}) => {
  if (!keyword) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeIcon}>×</Text>
          </TouchableOpacity>

          {/* Keyword term as title */}
          <Text style={styles.term}>{keyword.term}</Text>

          {/* Scrollable definition */}
          <ScrollView
            style={styles.definitionScroll}
            showsVerticalScrollIndicator={false}
          >
            {formatDefinitionText(keyword.definition)}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: width - 40,
    maxWidth: 400,
    maxHeight: height * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeIcon: {
    fontSize: 32,
    color: COLORS.textDark,
    fontWeight: '300',
  },
  term: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    lineHeight: 32,
    color: COLORS.mainPurple,
    marginBottom: 16,
    paddingRight: 32, // Space for close button
  },
  definitionScroll: {
    maxHeight: height * 0.5,
  },
  definition: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
  },
  definitionLine: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
    marginBottom: 8,
  },
});
