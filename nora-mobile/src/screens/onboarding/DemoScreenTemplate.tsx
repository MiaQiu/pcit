/**
 * DemoScreenTemplate
 * Layout: subtitle at top, large image in the middle, title at the bottom.
 * Used by Demo1–Demo6 onboarding screens.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  ImageSourcePropType,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DemoScreenTemplateProps {
  subtitle: string;
  title: string;
  image: ImageSourcePropType;
  onNext: () => void;
  onBack: () => void;
}

export const DemoScreenTemplate: React.FC<DemoScreenTemplateProps> = ({
  subtitle,
  title,
  image,
  onNext,
  onBack,
}) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  useEffect(() => {
    const timer = setTimeout(onNext, 2000);
    return () => clearTimeout(timer);
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Spinner + Subtitle at top */}
      <View style={styles.subtitleContainer}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {/* Image in the middle */}
      <View style={styles.imageContainer}>
        <Image source={image} style={styles.image} resizeMode="contain" />
      </View>

      {/* Title + button at the bottom */}
      <View style={styles.bottomContainer}>
        <Text style={styles.title}>{title}</Text>
        <OnboardingButtonRow onBack={onBack} onContinue={onNext} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  subtitleContainer: {
    paddingHorizontal: 52,
    paddingTop: 68,
    paddingBottom: 4,
    alignItems: 'center',
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#E9D8FF',
    borderTopColor: '#8C49D5',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  image: {
    width: SCREEN_WIDTH - 48,
    height: SCREEN_HEIGHT * 0.4,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 98,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 24,
  },
});
