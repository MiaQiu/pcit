/**
 * Subscription Screen
 * Trial information and pricing options
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuthService } from '../../contexts/AppContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { REVENUECAT_CONFIG } from '../../config/revenuecat';

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, completeOnboarding } = useOnboarding();
  const authService = useAuthService();
  const {
    availablePackages,
    isLoading: subscriptionLoading,
    purchasePackage,
    restorePurchases,
    error: subscriptionError
  } = useSubscription();

  const [selectedPlan] = useState<'1month'>('1month');
  const [isLoading, setIsLoading] = useState(false);

  // Save all onboarding data to backend as soon as the subscription screen loads.
  // This ensures data is persisted even if the user exits without subscribing.
  useEffect(() => {
    const isInitialOnboarding = data.name && data.name.trim() !== '';
    if (isInitialOnboarding) {
      authService.completeOnboarding({
        name: data.name,
        relationshipToChild: data.relationshipToChild || undefined,
        childName: data.childName,
        childGender: data.childGender || undefined,
        childBirthday: data.childBirthday || undefined,
        issue: data.issue || undefined,
      }).catch(err => {
        console.error('Failed to pre-save onboarding data:', err);
      });
    }
  }, []);

  // Calculate trial end date (1 month from today)
  const getTrialEndDate = () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);
    return endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Find packages by product ID
  const selectedPackage = availablePackages.find(
    p => p.product.identifier === REVENUECAT_CONFIG.products.oneMonth
  );

  const handleBack = () => navigation.goBack();

  const handleStartTrial = async () => {
    setIsLoading(true);

    try {
      // User was already identified to RevenueCat in CreateAccountScreen
      // Proceed directly with purchase - webhook will have the correct user ID
      const result = await purchasePackage(selectedPackage || undefined);

      if (result.success) {
        // CRITICAL: Trust the webhook as source of truth for subscription status
        // If completeOnboarding fails (app crash, network error, battery dies),
        // the RevenueCat webhook will still update subscriptionStatus in backend.
        // This prevents "zombie purchases" where user pays but stays in onboarding.

        // Only call completeOnboarding if user is going through initial onboarding
        // (has onboarding data). Skip for returning users who just need to subscribe.
        const isInitialOnboarding = data.name && data.name.trim() !== '';

        if (isInitialOnboarding) {
          // Fire-and-forget onboarding completion (don't block navigation)
          authService.completeOnboarding({
            name: data.name,
            relationshipToChild: data.relationshipToChild || undefined,
            childName: data.childName,
            childGender: data.childGender || undefined,
            childBirthday: data.childBirthday || undefined,
            issue: data.issue || undefined,
          }).catch(err => {
            // Log but don't block - webhook will handle subscription status
            console.error('Onboarding completion failed (non-critical):', err);
          });
          // Navigate to notification permission for new users
          navigation.navigate('NotificationPermission');
        } else {
          // Returning user - go directly to main app
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'MainTabs' as any }],
            })
          );
        }
      }
    } catch (error: any) {
      console.error('Purchase error:', error);

      // Only show error if user didn't cancel
      if (!error.userCancelled) {
        Alert.alert(
          'Purchase Failed',
          'Unable to start trial. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);

    try {
      const result = await restorePurchases();

      if (result.restored) {
        const isInitialOnboarding = data.name && data.name.trim() !== '';
        Alert.alert(
          'Success',
          'Your subscription has been restored!',
          [{
            text: 'OK',
            onPress: () => {
              if (isInitialOnboarding) {
                navigation.navigate('NotificationPermission');
              } else {
                // Returning user - go directly to main app
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'MainTabs' as any }],
                  })
                );
              }
            }
          }]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases to restore.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenTerms = () => {
    Linking.openURL('https://hinora.co/terms');
  };

  const handleOpenPrivacy = () => {
    Linking.openURL('https://hinora.co/privacy');
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

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        })
      );
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Image
          source={require('../../../assets/images/dragon_waving.png')}
          style={styles.dragonImage}
          resizeMode="contain"
        />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>How your trial works</Text>
        <Text style={styles.subtitle}>First 30 days free, then S$9.99/month</Text>

        {/* Loading/Error States */}
        {subscriptionLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#8C49D5" />
            <Text style={styles.loadingText}>Loading subscription options...</Text>
          </View>
        )}
        {subscriptionError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{subscriptionError}</Text>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timeline}>
          {/* Step 1 */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineCircle, styles.timelineCircleDone]}>
                <Text style={styles.timelineCircleText}>✓</Text>
              </View>
              <View style={styles.timelineConnector} />
            </View>
            <View style={styles.timelineBody}>
              <Text style={styles.timelineTitleDone}>Share your goals</Text>
              <Text style={styles.timelineDesc}>We've set up your profile based on your answers.</Text>
            </View>
          </View>

          {/* Step 2 */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineCircle, styles.timelineCircleActive]}>
                <Text style={styles.timelineCircleText}>🔓</Text>
              </View>
              <View style={styles.timelineConnector} />
            </View>
            <View style={styles.timelineBody}>
              <Text style={styles.timelineTitle}>Today</Text>
              <Text style={styles.timelineDesc}>Unlock access to personalized PCIT coaching sessions and tools.</Text>
            </View>
          </View>

          {/* Step 3 */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineCircle, styles.timelineCircleActive]}>
                <Text style={styles.timelineCircleText}>★</Text>
              </View>
            </View>
            <View style={styles.timelineBody}>
              <Text style={styles.timelineTitle}>In 30 days</Text>
              <Text style={styles.timelineDesc}>You'll be charged S$9.99. Cancel anytime before.</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} activeOpacity={0.8}>
          <Text style={styles.restoreText}>Restore purchase</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          After your free trial, your subscription automatically renews at S$9.99/month unless you cancel at least 24 hours before the trial ends. Cancel anytime in Settings. By continuing, you agree to our{' '}
          <Text style={styles.link} onPress={handleOpenTerms}>Terms</Text> and{' '}
          <Text style={styles.link} onPress={handleOpenPrivacy}>Privacy Policy</Text>.
        </Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.startButton, isLoading && styles.startButtonDisabled]}
          onPress={handleStartTrial}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.startButtonText}>Start my free trial</Text>
          )}
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

  // Hero
  heroSection: {
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 220,
  },
  dragonImage: {
    width: 180,
    height: 200,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 20,
  },

  // Header
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },

  // Timeline
  timeline: {
    marginBottom: 24,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineLeft: {
    alignItems: 'center',
    width: 44,
    marginRight: 16,
  },
  timelineCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCircleDone: {
    backgroundColor: '#8C49D5',
  },
  timelineCircleActive: {
    backgroundColor: '#8C49D5',
  },
  timelineCircleText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  timelineConnector: {
    width: 3,
    height: 56,
    backgroundColor: '#E9D5FF',
    borderRadius: 2,
  },
  timelineBody: {
    flex: 1,
    paddingTop: 6,
    paddingBottom: 32,
  },
  timelineTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#1F2937',
    marginBottom: 4,
  },
  timelineTitleDone: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  timelineDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },

  // Restore / Logout
  restoreButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  restoreText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#8C49D5',
    textDecorationLine: 'underline',
  },
  logoutButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  logoutText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#9CA3AF',
  },

  disclaimer: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
  link: {
    color: '#8C49D5',
    textDecorationLine: 'underline',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  startButton: {
    backgroundColor: '#8C49D5',
    borderRadius: 32,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#C4B5FD',
  },
  startButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },

  // Loading / error
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    marginBottom: 16,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#8C49D5',
    marginLeft: 8,
  },
  errorContainer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
  },
});
