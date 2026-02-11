/**
 * FeaturedCard Component
 * "Pick what you need today" card with quick-link topic bubbles
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, COLORS } from '../constants/assets';

interface QuickLink {
  label: string;
  moduleKey: string;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'Tantrums', moduleKey: 'EMOTIONS' },
  { label: 'Siblings', moduleKey: 'SIBLINGS' },
  { label: 'Defiance', moduleKey: 'DEFIANCE' },
  { label: 'Screens', moduleKey: 'SCREENS' },
];

interface FeaturedCardProps {
  onModulePress: (moduleKey: string) => void;
  onBrowseAll: () => void;
}

export const FeaturedCard: React.FC<FeaturedCardProps> = ({
  onModulePress,
  onBrowseAll,
}) => {
  return (
    // <View style={styles.container}>
    //   <TouchableOpacity
    //     style={styles.browseButton}
    //     onPress={onBrowseAll}
    //     activeOpacity={0.7}
    //   >
    //     <Text style={styles.browseButtonText}>Browse all lessons</Text>
    //   </TouchableOpacity>
    // </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F0FF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  bubblesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  bubble: {
    alignItems: 'center',
    gap: 4,
  },
  bubbleLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textDark,
  },
  browseButton: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  browseButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
