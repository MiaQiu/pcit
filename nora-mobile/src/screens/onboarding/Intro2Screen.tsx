/**
 * Intro 2 Screen
 * "Play" - Introduction to practice sessions
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

export const Intro2Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  const handleNext = () => {
    navigation.navigate('Intro3');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Progress Indicator */}
        <ProgressBar totalSegments={3} currentSegment={2} />



        {/* Content */}
        <View style={styles.textContent}>
        <Text style={styles.subtitle}>
          Play
          </Text>
          <Text style={styles.title}>Recrod a 5-min play session</Text>

          {/* <Text style={styles.description}>
            • Practice what you've learned{'\n'}
            • Record audio during play{'\n'}
            • Get AI-powered coaching in real-time
          </Text> */}
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
          <Text style={styles.buttonText}>Continue</Text>
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
    textAlign: 'center',
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
