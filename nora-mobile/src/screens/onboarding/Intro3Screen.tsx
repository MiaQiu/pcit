/**
 * Intro 3 Screen
 * "What parents notice over time" - Benefits overview
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';
import { DragonCard } from '../../components/DragonCard';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';

const BENEFITS = [
  'Fewer power struggles',
  'Better emotional control',
  'Improved focus',
  'Stronger social skills',
  'More confidence as a parent',
];

export const Intro3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <OnboardingProgressHeader phase={4} step={3} totalSteps={3} />

        <View style={styles.textContent}>
          <Text style={styles.title}>What parents notice over time</Text>

          <View style={styles.bulletList}>
            {BENEFITS.map((benefit) => (
              <Text key={benefit} style={styles.bulletItem}>  •  {benefit}</Text>
            ))}
          </View>
        </View>

        <View style={styles.cardContainer}>
          <DragonCard text="Small daily moments add up to meaningful change" />
        </View>
      </View>
      <View style={styles.footer}>
        <OnboardingButtonRow
          onBack={() => navigation.goBack()}
          onContinue={() => navigation.navigate('Subscription')}
          continueText="Continue  →"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  footer: {
    paddingHorizontal: 20,
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  bulletList: {
    alignItems: 'center',
    marginBottom: 24,
  },
  bulletItem: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 28,
  },
  cardContainer: {
    marginBottom: 40
  },
});
