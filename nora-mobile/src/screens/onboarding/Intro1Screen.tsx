/**
 * Intro 1 Screen
 * "What to play with?" - Toy suggestions for play sessions
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { ProgressBar } from '../../components/ProgressBar';
import { DragonCard } from '../../components/DragonCard';

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
        <ProgressBar totalSegments={3} currentSegment={1} />

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

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Intro2')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Continue  →</Text>
        </TouchableOpacity>
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
    paddingBottom: 112,
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
  cardContainer: {},
  button: {
    position: 'absolute',
    bottom: 16,
    left: 32,
    right: 32,
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});
