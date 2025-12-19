/**
 * OnboardingDragonHeader
 * Shared dragon header with text box for onboarding screens
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface OnboardingDragonHeaderProps {
  text: string;
}

export const OnboardingDragonHeader: React.FC<OnboardingDragonHeaderProps> = ({ text }) => {
  return (
    <View style={styles.headerSection}>
      <View style={styles.dragonIconContainer}>
        <Image
          source={require('../../assets/images/dragon_image.png')}
          style={styles.dragonIcon}
          resizeMode="contain"
        />
      </View>
      <View style={styles.headerTextBox}>
        <Text style={styles.headerText}>{text}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerSection: {
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragonIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
  },
  dragonIcon: {
    width: 90,
    height: 90,
    marginLeft: 25,
  },
  headerTextBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#364153',
    lineHeight: 24,
  },
});
