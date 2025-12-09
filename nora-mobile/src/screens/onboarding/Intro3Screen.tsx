/**
 * Intro 3 Screen
 * "Review" - Introduction to progress tracking and reports
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { ProgressBar } from '../../components/ProgressBar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const Intro3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  const handleNext = () => {
    navigation.navigate('Subscription');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Progress Indicator */}
        <ProgressBar totalSegments={3} currentSegment={3} />



        {/* Content */}
        <View style={styles.textContent}>
        <Text style={styles.subtitle}>
          Review
          </Text>
          <Text style={styles.title}>Get simple, helpful feedback</Text>

          <Text style={styles.description}>
          Our strategies are clinically validated by experts and based on research from Harvard University, University of Florida, and more.
          </Text>
        </View>

        {/* Spacer
        <View style={styles.spacer} /> */}

         {/* Illustration */}
         <View style={styles.illustrationContainer}>
          <View style={styles.illustrationCircle}>
            <Image
              source={require('../../../assets/images/dragon_image.png')}
              style={styles.illustrationImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Next Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Let's go!</Text>
        </TouchableOpacity>

        {/* Skip */}
        {/* <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.navigate('Subscription')}
          activeOpacity={0.8}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity> */}
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
  illustrationContainer: {
    alignItems: 'center',
    marginTop: 40,
    //marginBottom: 200,
  },
  illustrationCircle: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.45,
    borderRadius: (SCREEN_WIDTH * 0.5) / 2,
    backgroundColor: '#A2DFCB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illustrationImage: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
  },
  textContent: {
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#8C49D5',
    textAlign: 'center',
    marginBottom: 24,
    marginTop:40,
    lineHeight: 26,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'left',
    lineHeight: 28,
  },
  spacer: {
    flex: 1,
  },
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
