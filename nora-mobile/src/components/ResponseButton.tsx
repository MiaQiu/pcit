/**
 * ResponseButton Component
 * Quiz option button with 4 states: default, selected-correct, selected-wrong, unselected
 */

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../constants/assets';

export interface ResponseButtonProps {
  label: string;
  text: string;
  isSelected: boolean;
  isCorrect: boolean;
  onPress: () => void;
}

export const ResponseButton: React.FC<ResponseButtonProps> = ({
  label,
  text,
  isSelected,
  isCorrect,
  onPress,
}) => {
  const getStateStyles = () => {
    if (isSelected && isCorrect) return styles.correct;
    if (isSelected && !isCorrect) return styles.incorrect;
    return styles.default;
  };

  const stateStyles = getStateStyles();

  return (
    <TouchableOpacity
      style={[styles.container, stateStyles.container]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {!isSelected && (
        <View style={[styles.labelCircle, stateStyles.labelCircle]}>
          <Text style={[styles.labelText, stateStyles.labelText]}>
            {label}
          </Text>
        </View>
      )}

      <Text style={[styles.optionText, stateStyles.optionText, isSelected && { marginLeft: 0 }]}>
        {text}
      </Text>

      {isSelected && isCorrect && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 28,
    marginBottom: 12,
    borderWidth: 2,
    minHeight: 56,
  },
  labelCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  labelText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
  },
  optionText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },

  default: {
    container: {
      backgroundColor: COLORS.white,
      borderColor: '#E0E0E0',
    },
    labelCircle: {
      backgroundColor: '#F5F5F5',
    },
    labelText: {
      color: '#666666',
    },
    optionText: {
      color: COLORS.textDark,
    },
  },

  correct: {
    container: {
      backgroundColor: '#F0FFF4',
      borderColor: '#48BB78',
    },
    labelCircle: {
      backgroundColor: '#48BB78',
    },
    labelText: {
      color: COLORS.white,
    },
    optionText: {
      color: COLORS.textDark,
    },
  },

  incorrect: {
    container: {
      backgroundColor: '#FFF5F5',
      borderColor: '#F56565',
    },
    labelCircle: {
      backgroundColor: '#F56565',
    },
    labelText: {
      color: COLORS.white,
    },
    optionText: {
      color: COLORS.textDark,
    },
  },
});
