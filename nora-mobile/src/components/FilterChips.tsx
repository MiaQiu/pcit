/**
 * FilterChips Component
 * Horizontal scrollable list of filter chip buttons
 */

import React from 'react';
import { FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { FONTS, COLORS } from '../constants/assets';

interface Chip {
  key: string;
  label: string;
}

interface FilterChipsProps {
  chips: Chip[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  chips,
  activeKey,
  onSelect,
}) => {
  return (
    <FlatList
      horizontal
      data={chips}
      keyExtractor={(item) => item.key}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => {
        const isActive = item.key === activeKey;
        return (
          <TouchableOpacity
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onSelect(item.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  chipActive: {
    backgroundColor: COLORS.mainPurple,
  },
  chipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#666666',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
