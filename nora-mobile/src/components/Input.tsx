/**
 * Input Component
 * Styled text input for forms with multiple variants and states
 */

import React, { useState } from 'react';
import { TextInput, View, Text, TouchableOpacity, TextInputProps, KeyboardTypeOptions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

interface InputProps extends Omit<TextInputProps, 'keyboardType'> {
  label?: string;
  error?: string;
  variant?: 'text' | 'email' | 'password' | 'numeric';
  disabled?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  variant = 'text',
  disabled = false,
  leftIcon,
  rightIcon,
  onRightIconPress,
  value,
  onChangeText,
  placeholder,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Determine keyboard type based on variant
  const getKeyboardType = (): KeyboardTypeOptions => {
    switch (variant) {
      case 'email':
        return 'email-address';
      case 'numeric':
        return 'numeric';
      default:
        return 'default';
    }
  };

  // Determine auto-capitalize behavior
  const getAutoCapitalize = (): 'none' | 'sentences' | 'words' | 'characters' => {
    if (variant === 'email') return 'none';
    if (variant === 'password') return 'none';
    return 'sentences';
  };

  // For password fields, add show/hide toggle
  const isPasswordField = variant === 'password';
  const effectiveRightIcon = isPasswordField
    ? (showPassword ? 'eye-off-outline' : 'eye-outline')
    : rightIcon;
  const effectiveRightIconPress = isPasswordField
    ? () => setShowPassword(!showPassword)
    : onRightIconPress;

  const borderColor = error
    ? '#EF4444' // red-500
    : isFocused
      ? colors.primary
      : '#E5E7EB'; // gray-200

  return (
    <View className="w-full mb-4">
      {/* Label */}
      {label && (
        <Text
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          className="text-sm text-[#1E2939] mb-2"
        >
          {label}
        </Text>
      )}

      {/* Input Container */}
      <View
        style={{ borderColor }}
        className={`
          flex-row items-center
          border-2 rounded-2xl px-4
          bg-white
          ${disabled ? 'opacity-50 bg-gray-50' : ''}
        `}
      >
        {/* Left Icon */}
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color="#9CA3AF"
            style={{ marginRight: 12 }}
          />
        )}

        {/* Text Input */}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType={getKeyboardType()}
          autoCapitalize={getAutoCapitalize()}
          autoCorrect={variant !== 'email' && variant !== 'password'}
          secureTextEntry={isPasswordField && !showPassword}
          className="flex-1 h-14 text-base text-[#1E2939]"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          {...textInputProps}
        />

        {/* Right Icon */}
        {effectiveRightIcon && (
          <TouchableOpacity
            onPress={effectiveRightIconPress}
            disabled={!effectiveRightIconPress}
            className="ml-2"
          >
            <Ionicons
              name={effectiveRightIcon}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <Text className="text-sm text-red-500 mt-1 ml-1">
          {error}
        </Text>
      )}
    </View>
  );
};
