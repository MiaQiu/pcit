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
    checkSubscriptionStatus,
    error: subscriptionError
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingFreeAccount, setCheckingFreeAccount] = useState(true);

  const isReturningUser = !(data.name && data.name.trim() !== '');

  const monthlyPackage = availablePackages.find(
    p => p.packageType === 'MONTHLY' || p.product.identifier.includes('1m')
  ) ?? null;
  const yearlyPackage = availablePackages.find(
    p => p.packageType === 'ANNUAL' || p.product.identifier.includes('1year')
  ) ?? null;

  const selectedPackage = selectedPlan === 'yearly'
    ? (yearlyPackage ?? monthlyPackage)
    : (monthlyPackage ?? yearlyPackage);

  const monthlyPriceString = monthlyPackage?.product.priceString ?? '...';
  const yearlyPriceString = yearlyPackage?.product.priceString ?? '...';

  const savingsPercent = (() => {
    const monthly = monthlyPackage?.product.price ?? 0;
    const yearly = yearlyPackage?.product.price ?? 0;
    if (!monthly || !yearly) return 0;
    return Math.round((1 - yearly / (monthly * 12)) * 100);
  })();

  const yearlyPerMonthString = (() => {
    if (!yearlyPackage) return '...';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: yearlyPackage.product.currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(yearlyPackage.product.price / 12);
    } catch {
      return '...';
    }
  })();

  // Bypass paywall for free-account users — render nothing until check completes to avoid flash
  useEffect(() => {
    authService.getCurrentUser(true).then(async user => {
      if (user?.isFreeAccount) {
        // Update SubscriptionContext so Record tab won't redirect again after this
        await checkSubscriptionStatus();
        await completeOnboarding();
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' as any }] }));
      } else {
        setCheckingFreeAccount(false);
      }
    }).catch(() => setCheckingFreeAccount(false));
  }, []);

  useEffect(() => {
    if (!checkingFreeAccount) amplitudeService.trackOnboardingScreen('subscription', 35);
  }, [checkingFreeAccount]);

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

  if (checkingFreeAccount) return null;

  const handleBack = () => navigation.goBack();

  const handleStartTrial = async () => {
    setIsLoading(true);

    try {
      // If offerings haven't loaded yet, fetch them now before proceeding
      let packageToUse = selectedPackage;
      if (!packageToUse) {
        const packages = await refreshOfferings();
        const type = selectedPlan === 'yearly' ? 'ANNUAL' : 'MONTHLY';
        packageToUse = packages.find(p => p.packageType === type) ?? packages[0] ?? null;
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
        amplitudeService.trackEvent('Subscription Trial Started', { plan: selectedPlan, isReturningUser });
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
          await completeOnboarding();
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'MainTabs' as any }],
            })
          );
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
        await completeOnboarding();
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'MainTabs' as any }],
          })
        );
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
        Alert.alert(
          t('subscription.restoreSuccessTitle'),
          t('subscription.restoreSuccessMessage'),
          [{
            text: t('common.ok'),
            onPress: async () => {
              await completeOnboarding();
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'MainTabs' as any }],
                })
              );
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

    if (isReturningUser) {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' as any }] })
      );
      return;
    }

    setIsLoading(true);
    try {
      await authService.completeOnboarding({
        name: data.name,
        relationshipToChild: data.relationshipToChild || undefined,
        childName: data.childName,
        childGender: data.childGender || undefined,
        childBirthday: data.childBirthday || undefined,
        issue: data.issue || undefined,
      });

      prefetchLessons(lessonService, i18n.language);
      await completeOnboarding();
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' as any }] })
      );
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

        <View style={styles.card}>
          <Text style={styles.title}>{t('subscription.unlockPremium', { defaultValue: 'Unlock Premium' })}</Text>

          {/* Plan selector */}
          <View style={styles.planSelector}>
            {/* Monthly */}
            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
              onPress={() => setSelectedPlan('monthly')}
              activeOpacity={0.8}
            >
              <View style={styles.planCardLeft}>
                <Text style={[styles.planLabel, selectedPlan === 'monthly' && styles.planLabelSelected]}>
                  {t('subscription.planMonthly', { defaultValue: 'Monthly' })}
                </Text>
              </View>
              <View style={styles.planCardRight}>
                <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}>
                  {monthlyPriceString}
                </Text>
                <Text style={[styles.planPeriod, selectedPlan === 'monthly' && styles.planPeriodSelected]}>
                  {t('subscription.perMonth', { defaultValue: '/month' })}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Yearly */}
            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardSelected]}
              onPress={() => setSelectedPlan('yearly')}
              activeOpacity={0.8}
            >
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>
                  {t('subscription.popular', { defaultValue: 'Popular' })}
                </Text>
              </View>
              <View style={styles.planCardLeft}>
                <Text style={[styles.planLabel, selectedPlan === 'yearly' && styles.planLabelSelected]}>
                  {t('subscription.planYearly', { defaultValue: 'Yearly' })}
                </Text>
                {savingsPercent > 0 && (
                  <Text style={[styles.planSavings, selectedPlan === 'yearly' && styles.planSavingsSelected]}>
                    {t('subscription.savedPercent', { percent: savingsPercent, defaultValue: `(SAVED ${savingsPercent}%)` })}
                  </Text>
                )}
              </View>
              <View style={styles.planCardRight}>
                <Text style={[styles.planPrice, selectedPlan === 'yearly' && styles.planPriceSelected]}>
                  {yearlyPerMonthString}
                </Text>
                <Text style={[styles.planPeriod, selectedPlan === 'yearly' && styles.planPeriodSelected]}>
                  {t('subscription.perMonth', { defaultValue: '/month' })}
                </Text>
                <Text style={[styles.planBilledAnnually, selectedPlan === 'yearly' && styles.planBilledAnnuallySelected]}>
                  {t('subscription.billedAnnuallyAt', { price: yearlyPriceString, defaultValue: `billed annually at ${yearlyPriceString}` })}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.featureList}>
            {[
              t('subscription.featureUnlimitedSessions', { defaultValue: 'Unlimited recording sessions' }),
              t('subscription.featureAiReports', { defaultValue: 'AI coaching report after each session' }),
              t('subscription.featureWeeklyInsights', { defaultValue: 'Weekly progress insights' }),
              //t('subscription.featureCoachChat', { defaultValue: 'Coach chat support' }),
            ].map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.disclaimer}>
          {selectedPlan === 'yearly'
            ? t('subscription.disclaimerYearly', { price: yearlyPriceString, defaultValue: `Renews at ${yearlyPriceString}/year. Cancel anytime in Settings. By continuing, you agree to our ` })
            : t('subscription.disclaimer', { price: monthlyPriceString, defaultValue: `Renews at ${monthlyPriceString}/month. Cancel anytime in Settings. By continuing, you agree to our ` })}
          <Text style={styles.link} onPress={handleOpenTerms}>{t('subscription.terms')}</Text>{' '}{t('common.and', { defaultValue: 'and' })}{' '}
          <Text style={styles.link} onPress={handleOpenPrivacy}>{t('subscription.privacyPolicy')}</Text>.
        </Text>

        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} activeOpacity={0.8}>
          <Text style={styles.restoreText}>{t('subscription.restorePurchase')}</Text>
        </TouchableOpacity>

        <View style={{ height: 140 }} />
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
              {t('subscription.subscribeNow')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.8}>
          <Text style={styles.skipText}>{t('subscription.skipForNow', { defaultValue: 'Continue with free version' })}</Text>
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

  // Hero — mirrors StartScreen exactly (UNCHANGED)
  dragonSection: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    marginTop: -30,
    marginBottom: 8,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragonContainer: {
    position: 'absolute',
    width: '125%',
    height: '100%',
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
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 24,
    marginTop:-10,
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
  planSelector: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 16,
    marginBottom: 4,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'visible',
  },
  planCardSelected: {
    borderColor: '#8C49D5',
    backgroundColor: '#FAF5FF',
  },
  planCardLeft: {
    flex: 1,
  },
  planCardRight: {
    alignItems: 'flex-end',
  },
  planLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planLabelSelected: {
    color: '#8C49D5',
  },
  planPrice: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: '#1F2937',
    textAlign: 'right',
  },
  planPriceSelected: {
    color: '#111827',
  },
  planPeriod: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  planPeriodSelected: {
    color: '#8C49D5',
  },
  planSavings: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 18,
    color: '#9CA3AF',
    marginTop: 3,
  },
  planSavingsSelected: {
    color: '#7C3AED',
  },
  planBilledAnnually: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'right',
  },
  planBilledAnnuallySelected: {
    color: '#8C49D5',
  },
  popularBadge: {
    position: 'absolute',
    top: -11,
    backgroundColor: '#8C49D5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  popularBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  savingsBadge: {
    position: 'absolute',
    top: -11,
    backgroundColor: '#8C49D5',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savingsBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  featureList: {
    marginTop: 20,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureCheck: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#8C49D5',
    width: 20,
  },
  featureText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: '#1F2937',
    flex: 1,
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
  skipButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginTop: 0,
    marginBottom: 4,
  },
  skipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#6B7280',
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
    paddingBottom: 10,
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
