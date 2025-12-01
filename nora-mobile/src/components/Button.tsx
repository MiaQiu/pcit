/**
 * Button Component
 * Based on Figma design - CTA component
 */

import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { colors } from '../theme';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
}) => {
  const isPrimary = variant === 'primary';
  const bgColor = disabled
    ? 'rgba(30, 41, 57, 0.6)'
    : isPrimary
    ? '#1E2939'
    : '#F3F4F6';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        backgroundColor: bgColor,
        height: 64,
        borderRadius: 112,
        paddingHorizontal: 42,
        paddingVertical: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      activeOpacity={0.8}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? (
          <ActivityIndicator color={isPrimary ? '#FFFFFF' : '#1E2939'} />
        ) : (
          <>
            <Text
              style={{
                fontFamily: 'PlusJakartaSans_700Bold',
                fontSize: 16,
                color: isPrimary || disabled ? '#FFFFFF' : '#1E2939',
                textAlign: 'center',
                letterSpacing: -0.15,
              }}
            >
              {children}
            </Text>
            {icon && icon}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};
