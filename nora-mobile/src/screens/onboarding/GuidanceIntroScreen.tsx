/**
 * Guidance Intro Screen
 * "Guidance in Real Moments" - Feature overview after FocusAreas
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';

interface FeatureCardProps {
  image: ImageSourcePropType;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ image, title, description }) => (
  <View style={styles.card}>
    <View style={styles.cardIconContainer}>
      <Image source={image} style={styles.cardIcon} resizeMode="contain" />
    </View>
    <View style={styles.cardTextContainer}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </View>
  </View>
);

const FEATURES: FeatureCardProps[] = [
  {
    image: require('../../../assets/images/dragon_s1.png'),
    title: '5-min Play Coaching',
    description: 'Nora listens and guides your playtime.',
  },
  {
    image: require('../../../assets/images/dragon_s2.png'),
    title: 'Discipline Support',
    description: 'Set limits calmly and effectively',
  },
  {
    image: require('../../../assets/images/dragon_s3.png'),
    title: 'Bite-Size Learning',
    description: 'Learn one skill at a time, step by step.',
  },
];

export const GuidanceIntroScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <OnboardingProgressHeader phase={3} step={2} totalSteps={3} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Guidance in Real Moments</Text>

          <View style={styles.cardList}>
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </View>

          <Text style={styles.footnote}>
            Our strategies are clinically validated by experts and based on research from UC Davis, University of Florida, and more.
          </Text>
        </ScrollView>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('GrowthIntro')}
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  cardList: {
    gap: 16,
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F4',
    borderRadius: 20,
    padding: 16,
    marginTop:16,
  },
  cardIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0EDED',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 16,
  },
  cardIcon: {
    width: 70,
    height: 70,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1F2937',
    marginBottom: 4,
  },
  cardDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  footnote: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
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
