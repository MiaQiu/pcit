/**
 * Card Component
 * Reusable card container with shadow/elevation
 * Based on Figma lesson card design
 */

import React from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'pressable';
  backgroundColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  backgroundColor = '#E4E4FF',
  onPress,
  style,
}) => {
  const Container = variant === 'pressable' && onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        {
          backgroundColor,
          borderRadius: 24,
          overflow: 'hidden', // Allow ellipses to extend beyond card
        },
        style,
      ]}
    >
      {children}
    </Container>
  );
};
