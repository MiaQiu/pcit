/**
 * Badge Component
 * Small pill-shaped label for phase tags
 * Based on Figma "Highlight" component
 */

import React from 'react';
import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  subtitle: string;
  variant?: 'default' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  subtitle,
  variant = 'default',
}) => {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 100,
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_700Bold',
          fontSize: 10,
          lineHeight: 13,
          letterSpacing: -0.1,
          color: '#8C49D5',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_600SemiBold',
          fontSize: 14,
          lineHeight: 18,
          letterSpacing: -0.1,
          color: '#1E2939',
          textAlign: 'center',
          marginTop: 2,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
};

// /* PHASE */

// width: 40px;
// height: 11px;

// font-family: 'Plus Jakarta Sans';
// font-style: normal;
// font-weight: 600;
// font-size: 10px;
// line-height: 34px;
// /* or 340% */
// display: flex;
// align-items: center;
// text-align: center;
// letter-spacing: -0.1px;

// /* Main Purple */
// color: #8C49D5;


// /* Inside auto layout */
// flex: none;
// order: 0;
// flex-grow: 0;
