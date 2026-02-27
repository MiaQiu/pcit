/**
 * Intro 1 Screen
 * "What to play with?" - Toy suggestions for play sessions
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

const TOYS = [
  'Blocks or building toys',
  'Cars, figures, or pretend play',
  'Drawing or open-ended toys',
  'Puzzles',
];

export const Intro1Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <OnboardingProgressHeader phase={4} step={1} totalSteps={3} />

        <View style={styles.textContent}>
          <Text style={styles.title}>What to play with?</Text>
          <Text style={styles.subtitle}>Simple, familiar toys work best</Text>

          <View style={styles.bulletList}>
            {TOYS.map((toy) => (
              <Text key={toy} style={styles.bulletItem}>  •  {toy}</Text>
            ))}
          </View>
        </View>

        <View style={styles.cardContainer}>
          <DragonCard text="let your child lead the play" />
        </View>
      </View>
      <View style={styles.footer}>
        <OnboardingButtonRow
          onBack={() => navigation.goBack()}
          onContinue={() => navigation.navigate('Intro2')}
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
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
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
    marginBottom: 40,
  },
});
