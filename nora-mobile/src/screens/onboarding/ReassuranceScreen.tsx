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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ReassuranceScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const fullText = "You are at the right place.";

  useEffect(() => {
    // Start animations
    Animated.sequence([
      // First animate dragon
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      // Then animate bubble
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
    ]).start();

    // Navigate to DepressionSurvey screen after all animations complete
    const navigationTimer = setTimeout(() => {
      navigation.replace('DepressionSurvey');
    }, 4000);

    return () => {
      clearTimeout(navigationTimer);
    };
  }, [navigation, fadeAnim, scaleAnim, bubbleAnim, textOpacity]);

  return (
    <LinearGradient
      colors={['#A2DFCB', '#96D0E0']}
      style={styles.container}
    >
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
        </Animated.View>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragon: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    marginBottom: 20,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  messageText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
  },
});
