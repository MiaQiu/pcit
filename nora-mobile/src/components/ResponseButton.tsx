/**
 * ResponseButton Component
 * Quiz option button with 4 states: default, selected, correct, incorrect
 * Based on Figma design
 */

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../constants/assets';

export interface ResponseButtonProps {
  label: string; // A, B, C, D
  text: string;  // Option text
  isSelected: boolean;
  isSubmitted: boolean;
  isCorrect: boolean;
  onPress: () => void;
}

export const ResponseButton: React.FC<ResponseButtonProps> = ({
  label,
  text,
  isSelected,
  isSubmitted,
  isCorrect,
  onPress,
}) => {
  // Determine button state and styling
  const getStateStyles = () => {
    if (isSubmitted) {
      if (isCorrect) {
        return styles.correct;
      }
      if (isSelected && !isCorrect) {
        return styles.incorrect;
      }
    }
    if (isSelected) {
      return styles.selected;
    }
    return styles.default;
  };

  const stateStyles = getStateStyles();

  return (
    <TouchableOpacity
      style={[styles.container, stateStyles.container]}
      onPress={onPress}
      disabled={isSubmitted}
      activeOpacity={0.7}
    >
      <View style={[styles.labelCircle, stateStyles.labelCircle]}>
        <Text style={[styles.labelText, stateStyles.labelText]}>
          {label}
        </Text>
      </View>

      <Text style={[styles.optionText, stateStyles.optionText]}>
        {text}
      </Text>

      {/* Checkmark for correct answer */}
      {isSubmitted && isCorrect && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    minHeight: 64,
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

  // State: Default (not selected)
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

  // State: Selected (before submission)
  selected: {
    container: {
      backgroundColor: '#F5F0FF',
      borderColor: COLORS.mainPurple,
    },
    labelCircle: {
      backgroundColor: COLORS.mainPurple,
    },
    labelText: {
      color: COLORS.white,
    },
    optionText: {
      color: COLORS.textDark,
    },
  },

  // State: Correct (after submission)
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

  // State: Incorrect (after submission)
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
