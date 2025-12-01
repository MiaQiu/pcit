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

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`
        h-16 rounded-full px-11 py-4
        flex-row items-center justify-center
        ${isPrimary ? 'bg-[#8C49D5]' : 'bg-gray-200'}
        ${disabled ? 'opacity-50' : ''}
      `}
      activeOpacity={0.8}
    >
      <View className="flex-row items-center justify-center gap-2">
        {loading ? (
          <ActivityIndicator color={isPrimary ? '#FFFFFF' : '#1E2939'} />
        ) : (
          <>
            <Text
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
              className={`
                text-base text-center
                ${isPrimary ? 'text-white' : 'text-[#1E2939]'}
              `}
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
