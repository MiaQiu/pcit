/**
 * DragonCard Component
 * Gradient-bordered card with dragon avatar and bold text.
 * Used in onboarding intro screens and report screen.
 */

import React from 'react';
import { View, Text, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS, COLORS, DRAGON_PURPLE } from '../constants/assets';

interface DragonCardProps {
  text: string;
  label?: string;
  image?: ImageSourcePropType;
}

export const DragonCard: React.FC<DragonCardProps> = ({
  text,
  label,
  image = DRAGON_PURPLE,
}) => {
  return (
    <LinearGradient
      colors={['#C7D2FE', '#DDD6FE', '#E0E7FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBorder}
    >
      <View style={styles.inner}>
        <View style={styles.dragonContainer}>
          <Image
            source={image}
            style={styles.dragonImage}
            resizeMode="contain"
          />
        </View>
        {label ? (
          <View style={styles.labelRow}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
        ) : null}
        <Text style={styles.text}>{text}</Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBorder: {
    borderRadius: 24,
    padding: 10,
  },
  inner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  dragonContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  dragonImage: {
    width: 140,
    height: 140,
    marginLeft: 30,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#6750A4',
  },
  text: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 30,
  },
});
