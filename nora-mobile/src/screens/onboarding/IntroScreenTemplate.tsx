/**
 * IntroScreenTemplate
 * Reusable template for onboarding intro screens (Intro1, Intro2, Intro3)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ImageSourcePropType,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface IntroScreenTemplateProps {
  subtitle: string;
  title: string;
  description?: React.ReactNode;
  buttonText: string;
  image?: ImageSourcePropType;
  onNext: () => void;
  onBack?: () => void;
  header?: React.ReactNode;
}

export const IntroScreenTemplate: React.FC<IntroScreenTemplateProps> = ({
  subtitle,
  title,
  description,
  buttonText,
  image = require('../../../assets/images/dragon_image.png'),
  onNext,
  onBack,
  header,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
        )}
        {header}
        {/* Content */}
        <View style={styles.textContent}>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.title}>{title}</Text>
          {description ? (
            typeof description === 'string' ? (
              <Text style={styles.description}>{description}</Text>
            ) : (
              description
            )
          ) : null}
        </View>

        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          <View style={styles.illustrationCircle}>
            <Image
              source={image}
              style={styles.illustrationImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Next Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={onNext}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{buttonText}</Text>
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
    paddingBottom: 120,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    marginBottom: 4,
  },
  illustrationContainer: {
    alignItems: 'center',
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#8C49D5',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 40,
    lineHeight: 26,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#1E2939',
    textAlign: 'center',
    lineHeight: 24,
    marginRight:12,
    marginLeft:12,
    marginTop:24
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
