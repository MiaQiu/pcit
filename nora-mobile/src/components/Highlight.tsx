/**
 * Highlight Component
 * Based on Figma design - Purple highlight text label
 */

import React from 'react';
import { Text } from 'react-native';

interface HighlightProps {
  children: React.ReactNode;
}

export const Highlight: React.FC<HighlightProps> = ({ children }) => {
  return (
    <Text
      style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
      className="text-base text-[#8C49D5] text-center"
    >
      {children}
    </Text>
  );
};
