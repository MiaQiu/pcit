import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const Demo1Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subtitle */}
        <Text style={styles.subtitle}>Parenting is hard</Text>

        {/* Title */}
        <Text style={styles.title}>But you don't have to do it alone.</Text>

        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/images/demo1.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* Meet Nora */}
        <Text style={styles.meetTitle}>Meet Nora</Text>
        <Text style={styles.description}>
          Your guide to raising confident, happy kids.{'\n'}Science-backed.{'\n'}Personalized for your child (ages 1–7)
        </Text>
      </ScrollView>

      {/* Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Demo1B')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Let's go!  →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 16,
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#8C49D5',
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 28,
  },
  imageContainer: {
    width: SCREEN_WIDTH - 48,
    aspectRatio: 1.2,
    marginBottom: 24,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  meetTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 26,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
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
