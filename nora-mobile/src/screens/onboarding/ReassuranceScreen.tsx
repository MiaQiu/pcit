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

  // Typewriter effect
  const fullText = "You are at the right place.";
  const [displayedText, setDisplayedText] = React.useState('');

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
    ]).start();

    // Start typewriter effect after bubble appears
    const typewriterDelay = setTimeout(() => {
      let index = 0;
      const typewriterInterval = setInterval(() => {
        if (index <= fullText.length) {
          setDisplayedText(fullText.slice(0, index));
          index++;
        } else {
          clearInterval(typewriterInterval);
        }
      }, 50); // 50ms per character

      return () => clearInterval(typewriterInterval);
    }, 1200); // Start after bubble animation

    // Navigate to DepressionSurvey screen after all animations complete
    const navigationTimer = setTimeout(() => {
      navigation.replace('DepressionSurvey');
    }, 4500); // Increased to allow time for typewriter effect

    return () => {
      clearTimeout(typewriterDelay);
      clearTimeout(navigationTimer);
    };
  }, [navigation, fadeAnim, scaleAnim, bubbleAnim]);

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

        {/* Speech Bubble */}
        <Animated.View
          style={[
            styles.speechBubbleContainer,
            {
              opacity: bubbleAnim,
              transform: [{ scale: bubbleAnim }],
            },
          ]}
        >
          <View style={styles.speechBubble}>
            <Text style={styles.bubbleText}>
              {displayedText}
              {displayedText.length < fullText.length && (
                <Text style={styles.cursor}>|</Text>
              )}
            </Text>
            <View style={styles.bubbleTail} />
          </View>
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
  speechBubbleContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 20,
    maxWidth: SCREEN_WIDTH * 0.8,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  bubbleText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 20,
    color: '#1E2939',
    textAlign: 'center',
    lineHeight: 28,
    minHeight: 28, // Prevent layout shift during typing
  },
  cursor: {
    opacity: 0.7,
    color: '#8C49D5',
  },
  bubbleTail: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
});
