/**
 * MarkdownText Component
 * Renders text with basic markdown formatting (bold only)
 * Supports **bold** syntax
 */

import React from 'react';
import { Text, TextStyle } from 'react-native';
import { FONTS } from '../constants/assets';

interface MarkdownTextProps {
  children: string;
  style?: TextStyle;
  boldFontFamily?: string;
}

/**
 * Parse markdown text and return an array of Text components
 * Supports **bold** syntax
 */
export const MarkdownText: React.FC<MarkdownTextProps> = ({
  children,
  style,
  boldFontFamily = FONTS.semiBold
}) => {
  if (!children) return null;

  // Split text by **bold** markers
  // Regular segments are kept as plain strings — only bold spans get a nested
  // <Text>. In React Native, wrapping regular text in nested <Text> nodes causes
  // the parent <Text> to lose its width constraint from the parent View, leading
  // to text overflowing off-screen. Plain string literals avoid this entirely.
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push(children.substring(lastIndex, match.index));
    }
    parts.push(
      <Text key={`bold-${match.index}`} style={[style, { fontFamily: boldFontFamily }]}>
        {match[1]}
      </Text>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < children.length) {
    parts.push(children.substring(lastIndex));
  }

  if (parts.length === 0) {
    return <Text style={style}>{children}</Text>;
  }

  return <Text style={style}>{parts}</Text>;
};
