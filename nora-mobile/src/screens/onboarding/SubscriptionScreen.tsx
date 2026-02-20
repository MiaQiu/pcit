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
  Linking,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuthService } from '../../contexts/AppContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { REVENUECAT_CONFIG } from '../../config/revenuecat';
import { Ellipse } from '../../components/Ellipse';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';
import Purchases from 'react-native-purchases';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TIMELINE_ITEMS = [
  {
    day: 'Month 1',
    description: 'More connection. Building trust & safety foundation. ',
  },
  {
    day: 'Month 2',
    description: "Fewer power struggles. Learning emotional regulation",
  },
  {
    day: 'Month 3',
    description: "Calmer routines. Establishing lasting habits.",
  },
];

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

  const [selectedPlan, setSelectedPlan] = useState<'3month' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState(false);

  // Calculate trial end date (1 month from today)
  const getTrialEndDate = () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);
    return endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Find packages by product ID
  const threeMonthPackage = availablePackages.find(
    p => p.product.identifier === REVENUECAT_CONFIG.products.threeMonth
  );
  const yearlyPackage = availablePackages.find(
    p => p.product.identifier === REVENUECAT_CONFIG.products.oneYear
  );
  const selectedPackage = selectedPlan === 'yearly' ? yearlyPackage : threeMonthPackage;

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
        <Text style={styles.title}>
          Unlock {data.childName ? `${data.childName}'s Potential with Nora` : 'Potential with Nora'}
        </Text>
        <Text style={styles.subtitle}>
          {/* First 30 days free, then ${selectedPlan === 'annual' ? '138.96' : '11.58'}/
          {selectedPlan === 'annual' ? 'year' : 'month'} */}
          Join thousands of parents seeing real growth.
        </Text>

        {/* Pricing Toggle */}
        {/* <View style={styles.pricingToggle}>
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
        </View> */}

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
        {/* <View style={styles.timeline}>
          {TIMELINE_ITEMS.map((item, index) => (
            <View key={index} style={styles.timelineItem}>
            
              <View style={styles.iconContainer}>
                <View style={styles.icon}>
                  <Text style={styles.iconText}>✓</Text>
                </View>
                {index < TIMELINE_ITEMS.length - 1 && <View style={styles.connector} />}
              </View>

       
              <View style={styles.timelineContent}>
                <Text style={styles.timelineDay}>{item.day}</Text>
                <Text style={styles.timelineDescription}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View> */}

        {/* Restore Purchase Link */}
        {/* <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          activeOpacity={0.8}
        >
          <Text style={styles.restoreText}>Restore purchase</Text>
        </TouchableOpacity> */}

        {/* Bottom CTA */}
        {/* 1-Year Growth Partner Box */}
        <TouchableOpacity
          style={[styles.planBox, selectedPlan === 'yearly' && styles.planBoxSelected]}
          onPress={() => setSelectedPlan('yearly')}
          activeOpacity={0.8}
        >
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
          </View>
          <View style={styles.programContent}>
            <View style={styles.programIcon}>
              <Image
                source={require('../../../assets/images/dragon_waving.png')}
                style={styles.iconImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.programDetails}>
              <Text style={styles.programTitle}>1-Year Growth Partner</Text>
              <Text style={styles.programPrice}>S$169.99 (14/month)</Text>
              <Text style={styles.programDescription}>Ongoing parent tips, progress tracking, and support as your child grows.</Text>
              <View style={styles.bonusBadge}>
                <Text style={styles.bonusBadgeText}>🎁 Beta bonus 1 month free</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* 3-Month Kickstart Box */}
        <TouchableOpacity
          style={[styles.planBox, selectedPlan === '3month' && styles.planBoxSelected]}
          onPress={() => setSelectedPlan('3month')}
          activeOpacity={0.8}
        >
          <View style={styles.programContent}>
            <View style={styles.programIcon}>
              <Image
                source={require('../../../assets/images/dragon_waving.png')}
                style={styles.iconImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.programDetails}>
              <Text style={styles.programTitle}>3-Month Kickstart</Text>
              <Text style={styles.programPrice}>S$99.99 (33/month)</Text>
              <Text style={styles.programDescription}>See meaningful changes in routines, cooperation, and emotional skills.</Text>
              <View style={styles.bonusBadge}>
                <Text style={styles.bonusBadgeText}>🎁 Beta bonus 1 month free</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.noChargeText}>
          No charge today  •  <Text style={styles.trialEndsText}>Trial ends {getTrialEndDate()}</Text>
        </Text>
        <TouchableOpacity
          style={[styles.startButton, isLoading && styles.startButtonDisabled]}
          onPress={handleStartTrial}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.startButtonText}>Start free trial</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          After your free trial, your subscription automatically renews at {selectedPlan === '3month' ? 'S$99.99 every 3 months' : 'S$169.99/year'} unless you cancel at least 24 hours before the trial ends. Cancel anytime in Settings. By continuing, you agree to our{' '}
          <Text style={styles.link} onPress={handleOpenTerms}>Terms</Text> and{' '}
          <Text style={styles.link} onPress={handleOpenPrivacy}>Privacy Policy</Text>.
        </Text>

        <TouchableOpacity
          style={styles.restorePurchasesButton}
          onPress={handleRestore}
          activeOpacity={0.8}
        >
          <Text style={styles.restorePurchasesText}>Restore Purchases</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
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
    fontSize: 26,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#8C49D5',
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 32,
    overflow: 'hidden',
  },

  bonusBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#8C49D5',
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
    marginLeft: 14,
    marginBottom: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 0,
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
    paddingBottom: 18,
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
    paddingTop: 0,
    paddingBottom: 32,
    //backgroundColor: '#F3E8FF',
  },
  planBox: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  planBoxSelected: {
    borderWidth: 2,
    borderColor: '#A78BFA',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: '#8C49D5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 12,
  },
  recommendedBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  programContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  programIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    //backgroundColor: '#FEF3C7',
    alignItems: 'flex-start',
    justifyContent: 'center',
    //marginRight: 12,
    overflow: 'hidden',
  },
  iconImage: {
    width: 50,
    height: 50,
  },
  programDetails: {
    flex: 1,
  },
  programTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1F2937',
    marginBottom: 2,
  },
  programPrice: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  programDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 6,
  },
  bonusBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  noChargeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  trialEndsText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
  },
  startButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
  disclaimer: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
    //marginBottom:0,
  },
  link: {
    color: '#8C49D5',
    textDecorationLine: 'underline',
  },
  restorePurchasesButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginTop: 0,
  },
  restorePurchasesText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#8C49D5',
  },
  logoutButton: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
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
    paddingVertical: 12,
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
