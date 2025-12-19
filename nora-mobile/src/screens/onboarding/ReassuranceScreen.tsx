/**
 * Reassurance Screen
 * Shows dragon with encouraging message after survey
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ReassuranceScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const childName = data.childName || 'your child';
  const fullText = `Your wellbeing matters too!`;
  const subtitle = "Parenting takes a lot of energy. Before we dive into the program, we want to check in on how you have been feeling";

  const handleContinue = () => {
    navigation.navigate('DepressionQuestion1');
  };

  useEffect(() => {
    // Set dragon and button to visible immediately
    fadeAnim.setValue(1);
    scaleAnim.setValue(1);
    buttonOpacity.setValue(1);

    // Start text animations
    Animated.sequence([
      // Animate bubble
      Animated.spring(bubbleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
        delay: 200,
      }),
      // Then fade in text over 1 second
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        delay: 200,
      }),
      // Then fade in subtitle
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        delay: 300,
      }),
    ]).start();

    // TEMPORARY: Navigation disabled for layout adjustments
    // const navigationTimer = setTimeout(() => {
    //   navigation.replace('DepressionSurvey');
    // }, 4000);

    // return () => {
    //   clearTimeout(navigationTimer);
    // };
  }, [navigation, fadeAnim, scaleAnim, bubbleAnim, textOpacity, subtitleOpacity, buttonOpacity]);

  return (
    <LinearGradient
      colors={['#9CD8D6', '#96D0E0']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Dragon Image */}
          <Image
            source={require('../../../assets/images/dragon_waving.png')}
            style={styles.dragon}
            resizeMode="contain"
          />

          {/* Message Text */}
          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: bubbleAnim,
                transform: [{ scale: bubbleAnim }],
              },
            ]}
          >
            <Animated.Text style={[styles.messageText, { opacity: textOpacity }]}>
              {fullText}
            </Animated.Text>
            {subtitle && (
              <Animated.Text style={[styles.subtitleText, { opacity: subtitleOpacity }]}>
                {subtitle}
              </Animated.Text>
            )}
          </Animated.View>
        </Animated.View>

        {/* Button */}
        <Animated.View style={[styles.buttonContainer, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Let's go</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragon: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    marginBottom: 20,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 32,
  },
  messageText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 24,
  },
  subtitleText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
  },
  buttonContainer: {
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  button: {
    width: '100%',
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
