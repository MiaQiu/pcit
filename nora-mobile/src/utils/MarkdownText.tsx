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
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(children)) !== null) {
    // Add text before the bold part
    if (match.index > lastIndex) {
      const textBefore = children.substring(lastIndex, match.index);
      parts.push(
        <Text key={`text-${lastIndex}`} style={style}>
          {textBefore}
        </Text>
      );
    }

    // Add bold text with explicit bold font family
    parts.push(
      <Text key={`bold-${match.index}`} style={[style, { fontFamily: boldFontFamily }]}>
        {match[1]}
      </Text>
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last bold part
  if (lastIndex < children.length) {
    const textAfter = children.substring(lastIndex);
    parts.push(
      <Text key={`text-${lastIndex}`} style={style}>
        {textAfter}
      </Text>
    );
  }

  // If no markdown found, return plain text
  if (parts.length === 0) {
    return <Text style={style}>{children}</Text>;
  }

  return <Text style={style}>{parts}</Text>;
};
