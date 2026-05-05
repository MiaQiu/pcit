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
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { MaskedDinoImage } from '../../components/MaskedDinoImage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuthService } from '../../contexts/AppContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { REVENUECAT_CONFIG } from '../../config/revenuecat';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();
  const { data, completeOnboarding } = useOnboarding();
  const authService = useAuthService();
  const {
    availablePackages,
    isLoading: subscriptionLoading,
    purchasePackage,
    restorePurchases,
    refreshOfferings,
    error: subscriptionError
  } = useSubscription();

  const [selectedPlan] = useState<'1month'>('1month');
  const [isLoading, setIsLoading] = useState(false);

  const isReturningUser = !(data.name && data.name.trim() !== '');

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

  console.log('[Subscription] Available packages:', availablePackages.map(p => p.product.identifier));
  console.log('[Subscription] Selected package:', selectedPackage?.product.identifier ?? 'NOT FOUND');

  const handleBack = () => navigation.goBack();

  const handleStartTrial = async () => {
    setIsLoading(true);

    try {
      // If offerings haven't loaded yet, fetch them now before proceeding
      let packageToUse = selectedPackage;
      if (!packageToUse) {
        const packages = await refreshOfferings();
        packageToUse = packages.find(
          p => p.product.identifier === REVENUECAT_CONFIG.products.oneMonth
        );
      }

      if (!packageToUse) {
        Alert.alert(t('subscription.notAvailableTitle'), t('subscription.notAvailableMessage'));
        setIsLoading(false);
        return;
      }

      // User was already identified to RevenueCat in CreateAccountScreen
      // Proceed directly with purchase - webhook will have the correct user ID
      const result = await purchasePackage(packageToUse);

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
          t('subscription.purchaseFailedTitle'),
          t('subscription.purchaseFailedMessage'),
          [
            { text: t('subscription.restorePurchaseButton'), onPress: handleRestore },
            { text: t('subscription.tryAgain'), onPress: handleStartTrial },
            { text: t('common.cancel'), style: 'cancel' },
          ]
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
          t('subscription.restoreSuccessTitle'),
          t('subscription.restoreSuccessMessage'),
          [{
            text: t('common.ok'),
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
          t('subscription.noPurchasesTitle'),
          t('subscription.noPurchasesMessage'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      Alert.alert(
        t('subscription.restoreFailedTitle'),
        t('subscription.restoreFailedMessage'),
        [{ text: t('common.ok') }]
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
        t('common.error'),
        t('subscription.errorSetup'),
        [
          { text: t('common.retry'), onPress: handleSkip },
          { text: t('common.cancel'), style: 'cancel' },
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
      Alert.alert(t('common.error'), t('subscription.logoutError'));
    }
  };

  return (
    <View style={styles.container}>
      {/* Hero Section — same layout as StartScreen */}
      <View style={styles.dragonSection}>
        <View style={styles.dragonContainer}>
          <MaskedDinoImage style={styles.dragonImage} />
        </View>
      </View>

      {/* Early User Benefits badge — only for new users */}
      {!isReturningUser && (
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('subscription.earlyUserBenefits')}</Text>
          </View>
        </View>
      )}

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {isReturningUser ? t('subscription.subscribeToContinue') : t('subscription.howTrialWorks')}
        </Text>
        <Text style={styles.subtitle}>
          {isReturningUser ? t('subscription.priceMonthly') : t('subscription.priceFreeTrialThenMonthly')}
        </Text>
        {!isReturningUser && (
          <Text style={styles.regularPrice}>{t('subscription.regularPrice')}</Text>
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
              <Text style={styles.timelineTitleDone}>{t('subscription.stepProfileTitle')}</Text>
              <Text style={styles.timelineDesc}>{t('subscription.stepProfileDesc')}</Text>
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
              <Text style={styles.timelineTitle}>{t('subscription.stepTodayTitle')}</Text>
              <Text style={styles.timelineDesc}>{t('subscription.stepTodayDesc')}</Text>
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
              <Text style={styles.timelineTitle}>
                {isReturningUser ? t('subscription.stepTodayTitle') : t('subscription.step30DaysTitle')}
              </Text>
              <Text style={styles.timelineDesc}>
                {isReturningUser ? t('subscription.stepChargedDescReturning') : t('subscription.stepChargedDesc')}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} activeOpacity={0.8}>
          <Text style={styles.restoreText}>{t('subscription.restorePurchase')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>{t('subscription.logOut')}</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          {isReturningUser ? t('subscription.disclaimerReturning') : t('subscription.disclaimerNew')}
          <Text style={styles.link} onPress={handleOpenTerms}>{t('subscription.terms')}</Text>{' '}and{' '}
          <Text style={styles.link} onPress={handleOpenPrivacy}>{t('subscription.privacyPolicy')}</Text>.
        </Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.startButton, (isLoading || subscriptionLoading) && styles.startButtonDisabled]}
          onPress={handleStartTrial}
          disabled={isLoading || subscriptionLoading}
          activeOpacity={0.8}
        >
          {isLoading || subscriptionLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.startButtonText}>
              {isReturningUser ? t('subscription.subscribeNow') : t('subscription.startTrial')}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.betaPricing}>{t('subscription.betaPricing')}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Hero — mirrors StartScreen exactly
  dragonSection: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    marginTop: -20,
    marginBottom: 8,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragonContainer: {
    position: 'absolute',
    width: '125%',
    height: '125%',
    alignItems: 'center',
  },
  dragonImage: {
    width: '100%',
    height: '100%',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 15,
    paddingBottom: 20,
  },

  // Badge
  badgeContainer: {
    alignItems: 'center',
    marginTop: -20,
    //marginBottom: 14,
  },
  badge: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#374151',
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
    marginBottom: 4,
  },
  regularPrice: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    textDecorationLine: 'line-through',
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
    alignItems: 'center',
  },
  betaPricing: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  startButton: {
    backgroundColor: '#8C49D5',
    borderRadius: 32,
    height: 56,
    width: '100%',
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
