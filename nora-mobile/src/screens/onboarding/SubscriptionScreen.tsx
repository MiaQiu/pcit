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
  Platform,
} from 'react-native';
import { MaskedDinoImage } from '../../components/MaskedDinoImage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuthService, useLessonService } from '../../contexts/AppContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { prefetchLessons } from '../../services/lessonDataCache';
import { REVENUECAT_CONFIG } from '../../config/revenuecat';
import amplitudeService from '../../services/amplitudeService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t, i18n } = useTranslation();
  const { data, completeOnboarding } = useOnboarding();
  const authService = useAuthService();
  const lessonService = useLessonService();
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

  useEffect(() => {
    amplitudeService.trackOnboardingScreen('subscription', 35);
  }, []);

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

  // Only one product offered — take the first available package
  const selectedPackage = availablePackages[0] ?? null;

  // Use the App Store price string for the user's storefront locale.
  // Falls back to '...' while offerings are still loading.
  const priceString = selectedPackage?.product.priceString ?? '...';

  // Trial end date = 30 days from today; shown in the reminder card.
  const chargeDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  })();

  const zeroCurrency = selectedPackage?.product.currencyCode
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: selectedPackage.product.currencyCode,
        maximumFractionDigits: 0,
      }).format(0)
    : '$0';

  console.log('[Subscription] Available packages:', availablePackages.map(p =>
    `${p.product.identifier} → ${p.product.priceString} (${p.product.currencyCode})`
  ));
  console.log('[Subscription] Selected package:', selectedPackage
    ? `${selectedPackage.product.identifier} → ${selectedPackage.product.priceString} (${selectedPackage.product.currencyCode})`
    : 'NOT FOUND'
  );

  const handleBack = () => navigation.goBack();

  const handleStartTrial = async () => {
    setIsLoading(true);

    try {
      // If offerings haven't loaded yet, fetch them now before proceeding
      let packageToUse = selectedPackage;
      if (!packageToUse) {
        const packages = await refreshOfferings();
        packageToUse = packages[0] ?? null;
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
        amplitudeService.trackEvent('Subscription Trial Started', { plan: '1month', isReturningUser });
        prefetchLessons(lessonService, i18n.language);

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
          await completeOnboarding();
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

      // Already owned — navigate directly since purchase is confirmed
      if (error.userInfo?.readableErrorCode === 'ProductAlreadyPurchasedError' ||
          error.userInfo?.code === 6) {
        const isInitialOnboarding = data.name && data.name.trim() !== '';
        if (isInitialOnboarding) {
          navigation.navigate('NotificationPermission');
        } else {
          await completeOnboarding();
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'MainTabs' as any }],
            })
          );
        }
        return;
      }

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
        amplitudeService.trackEvent('Subscription Restored', { isReturningUser });
        const isInitialOnboarding = data.name && data.name.trim() !== '';
        Alert.alert(
          t('subscription.restoreSuccessTitle'),
          t('subscription.restoreSuccessMessage'),
          [{
            text: t('common.ok'),
            onPress: async () => {
              if (isInitialOnboarding) {
                navigation.navigate('NotificationPermission');
              } else {
                // Returning user - go directly to main app
                await completeOnboarding();
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
    amplitudeService.trackEvent('Subscription Skipped', { isReturningUser });
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

      prefetchLessons(lessonService, i18n.language);
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
      {/* {!isReturningUser && (
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('subscription.earlyUserBenefits')}</Text>
          </View>
        </View>
      )} */}

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {subscriptionError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{subscriptionError}</Text>
          </View>
        )}

        {/* Main card — white, with cute illustration + bold "Due Today" hero + reminder pill */}
        <View style={styles.card}>
          {/* Smaller illustration inside the card */}
          {/* <View style={styles.cardIllustration}>
            <MaskedDinoImage style={styles.cardIllustrationImage} />
          </View> */}

          <Text style={styles.title}>
            {isReturningUser ? t('subscription.subscribeToContinue') : t('subscription.howTrialWorks', { zeroCurrency })}
          </Text>
          <Text style={styles.priceAfterTrial}>
            {isReturningUser
              ? t('subscription.priceMonthly', { price: priceString })
              : t('subscription.priceAfterTrial', { price: priceString })}
          </Text>
          {!isReturningUser && (
            <Text style={styles.subtitle}>{t('subscription.priceFreeTrialThenMonthly', { price: priceString })}</Text>
          )}

          {/* Reminder — new users only */}
          {!isReturningUser && (
            <View style={styles.reminderCard}>
              <Text style={styles.reminderIcon}>🔔</Text>
              <Text style={styles.reminderText}>
                <Text style={styles.reminderTextBold}>
                  {t('subscription.reminderLabel', { defaultValue: 'Gentle reminder: ' })}
                </Text>
                {t('subscription.step28DaysDesc', { chargeDate })}
              </Text>
            </View>
          )}
        </View>

    

        <Text style={styles.disclaimer}>
          {isReturningUser ? t('subscription.disclaimerReturning', { price: priceString }) : t('subscription.disclaimerNew', { price: priceString })}
          <Text style={styles.link} onPress={handleOpenTerms}>{t('subscription.terms')}</Text>{' '}and{' '}
          <Text style={styles.link} onPress={handleOpenPrivacy}>{t('subscription.privacyPolicy')}</Text>.
        </Text>

        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} activeOpacity={0.8}>
          <Text style={styles.restoreText}>{t('subscription.restorePurchase')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>{t('subscription.logOut')}</Text>
        </TouchableOpacity>

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
        {/* <Text style={styles.betaPricing}>{t('subscription.betaPricing')}</Text> */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Hero — mirrors StartScreen exactly (UNCHANGED)
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

  // Main card — white background to match the new design
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 24,
    marginTop:34,
    borderWidth: 1,
    borderColor: 'rgba(140,107,194,0.10)',
    // shadow
    shadowColor: '#8C6BC2',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 5,
  },

  // Cute illustration inside the card
  cardIllustration: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardIllustrationImage: {
    width: '70%',
    height: '100%',
  },

  // Header (inside card)
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 30,
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 8,
  },
  priceAfterTrial: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15.5,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 23,
    marginHorizontal: 4,
    marginBottom: 18,
  },
  regularPrice: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    textDecorationLine: 'line-through',
    marginBottom: 32,
  },

  // Reminder pill (inside card, at the bottom)
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1E5FF',
    borderWidth: 1,
    borderColor: 'rgba(140,73,213,0.14)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  reminderIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  reminderText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: '#5B21B6',
    lineHeight: 19,
  },
  reminderTextBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#5B21B6',
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
    marginTop:44,
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

  // Bottom bar (UNCHANGED)
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
