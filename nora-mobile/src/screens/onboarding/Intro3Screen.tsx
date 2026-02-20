/**
 * Intro 3 Screen
 * "What parents notice over time" - Benefits overview
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';
import { DragonCard } from '../../components/DragonCard';

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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
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

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Subscription')}
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    marginBottom: 4,
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
