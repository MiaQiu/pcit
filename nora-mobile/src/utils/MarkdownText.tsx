/**
 * MarkdownText Component
 * Renders text with basic markdown formatting (bold only)
 * Supports **bold** syntax
 */

import React from 'react';
import { Text, TextStyle, View } from 'react-native';
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
      <Text key={`bold-${match.index}`} style={{ fontFamily: boldFontFamily, fontSize: style?.fontSize, color: style?.color, lineHeight: style?.lineHeight }}>
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

  // Wrap in a View so the layout engine constrains the width properly.
  // A <Text> containing nested <Text> nodes (for bold) can lose its width
  // constraint from the parent View, causing text to overflow off-screen.
  // The View gets its width from the parent layout, forcing the inner Text
  // to wrap correctly. Only margin/padding spacing props are passed to the View;
  // text-specific props stay on the inner Text.
  const { margin, marginTop, marginBottom, marginLeft, marginRight,
          marginHorizontal, marginVertical,
          padding, paddingTop, paddingBottom, paddingLeft, paddingRight,
          paddingHorizontal, paddingVertical } = style ?? {};
  return (
    <View style={{ margin, marginTop, marginBottom, marginLeft, marginRight,
                   marginHorizontal, marginVertical,
                   padding, paddingTop, paddingBottom, paddingLeft, paddingRight,
                   paddingHorizontal, paddingVertical }}>
      <Text style={style}>{parts}</Text>
    </View>
  );
};
