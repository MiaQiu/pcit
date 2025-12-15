/**
 * Subscription Screen
 * Trial information and pricing options
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { RootStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuthService } from '../../contexts/AppContext';
import { Ellipse } from '../../components/Ellipse';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TIMELINE_ITEMS = [
  {
    day: 'Today',
    description: 'Unlock our library of meditations, sleep sounds, and more.',
  },
  {
    day: 'In 12 days',
    description: "We'll send you a reminder that your trial is ending soon.",
  },
  {
    day: 'In 14 days',
    description: "You'll be charged, cancel anytime before.",
  },
];

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { data, completeOnboarding } = useOnboarding();
  const authService = useAuthService();
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartTrial = async () => {
    setIsLoading(true);

    try {
      // Send onboarding data to backend
      await authService.completeOnboarding({
        name: data.name,
        relationshipToChild: data.relationshipToChild || undefined,
        childName: data.childName,
        childGender: data.childGender || undefined,
        childBirthday: data.childBirthday || undefined,
        issue: data.issue || undefined,
      });

      // TODO: Implement subscription/in-app purchase logic

      // Navigate to NotificationPermission screen
      navigation.navigate('NotificationPermission');
    } catch (error: any) {
      console.error('Complete onboarding error:', error);
      Alert.alert(
        'Error',
        'Failed to complete setup. Please try again.',
        [
          {
            text: 'Retry',
            onPress: handleStartTrial,
          },
          {
            text: 'Skip for Now',
            onPress: async () => {
              // Continue to notification permission
              navigation.navigate('NotificationPermission');
            },
            style: 'cancel',
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = () => {
    // TODO: Implement restore purchases
    console.log('Restore purchases');
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      // Send onboarding data to backend without subscription
      await authService.completeOnboarding({
        name: data.name,
        relationshipToChild: data.relationshipToChild || undefined,
        childName: data.childName,
        childGender: data.childGender || undefined,
        childBirthday: data.childBirthday || undefined,
        issue: data.issue || undefined,
      });

      // Navigate to NotificationPermission screen
      navigation.navigate('NotificationPermission');
    } catch (error: any) {
      console.error('Complete onboarding error:', error);
      Alert.alert(
        'Error',
        'Failed to complete setup. Please try again.',
        [
          {
            text: 'Retry',
            onPress: handleSkip,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dragon Image Section with Ellipse Backgrounds */}
        {/* <View style={styles.heroContainer}> */}
          {/* Ellipse 78 - Top decorative background - #A6E0CB */}
          {/* <Ellipse color="#A6E0CB" style={styles.ellipse78} /> */}

          {/* Ellipse 77 - Bottom decorative background */}
          {/* <Ellipse color="#9BD4DF" style={styles.ellipse77} /> */}

          {/* Dragon Image */}
          {/* <View style={styles.dragonContainer}>
            <Image
              source={require('../../../assets/images/dragon_image.png')}
              style={styles.dragon}
              resizeMode="contain"
            />
          </View>
        </View> */}

        {/* Title */}
        <Text style={styles.title}>How your trial works</Text>
        <Text style={styles.subtitle}>
          First 14 days free, then ${selectedPlan === 'annual' ? '138.96' : '11.58'}/
          {selectedPlan === 'annual' ? 'year' : 'month'}
        </Text>

        {/* Pricing Toggle */}
        <View style={styles.pricingToggle}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              selectedPlan === 'annual' && styles.toggleButtonActive,
            ]}
            onPress={() => setSelectedPlan('annual')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toggleText,
                selectedPlan === 'annual' && styles.toggleTextActive,
              ]}
            >
              Annual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              selectedPlan === 'monthly' && styles.toggleButtonActive,
            ]}
            onPress={() => setSelectedPlan('monthly')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toggleText,
                selectedPlan === 'monthly' && styles.toggleTextActive,
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          {TIMELINE_ITEMS.map((item, index) => (
            <View key={index} style={styles.timelineItem}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <View style={styles.icon}>
                  <Text style={styles.iconText}>✓</Text>
                </View>
                {index < TIMELINE_ITEMS.length - 1 && <View style={styles.connector} />}
              </View>

              {/* Content */}
              <View style={styles.timelineContent}>
                <Text style={styles.timelineDay}>{item.day}</Text>
                <Text style={styles.timelineDescription}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Restore Purchase Link */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          activeOpacity={0.8}
        >
          <Text style={styles.restoreText}>Restore purchase</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.startButton, isLoading && styles.startButtonDisabled]}
          onPress={handleStartTrial}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.startButtonText}>Try for $0.00</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.skipButtonText}>Skip Now</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Cancel anytime. By continuing, you agree to our{' '}
          <Text style={styles.link}>Terms</Text> and{' '}
          <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    //backgroundColor: '#F3E8FF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heroContainer: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    //marginBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  ellipse78: {
    position: 'absolute',
    left: -130,
    top: -40,
    width: 573,
    height: 150,
  },
  ellipse77: {
    position: 'absolute',
    left: -80,
    top: 50,
    width: 473,
    height: 120,
  },
  dragonContainer: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    alignItems: 'center',
    marginBottom: 120,
  },
  dragon: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 70,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  pricingToggle: {
    flexDirection: 'row',
    backgroundColor: '#E9D5FF',
    borderRadius: 20,
    padding: 4,
    marginBottom: 32,
  },
  toggleButton: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  toggleButtonActive: {
    backgroundColor: '#8C49D5',
  },
  toggleText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  timeline: {
    marginBottom: 24,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8C49D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: '#C4B5FD',
    marginTop: 4,
    marginBottom: 4,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 20,
  },
  timelineDay: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
  },
  timelineDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  restoreButton: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  restoreText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#8C49D5',
  },
  bottomContainer: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 32,
    //backgroundColor: '#F3E8FF',
  },
  startButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#8C49D5',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonDisabled: {
    backgroundColor: '#C4B5FD',
    shadowOpacity: 0.1,
  },
  startButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  skipButton: {
    width: '100%',
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  skipButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#6B7280',
  },
  disclaimer: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  link: {
    color: '#8C49D5',
    textDecorationLine: 'underline',
  },
});
