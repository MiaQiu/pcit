/**
 * Profile Screen
 * Account management, subscription info, and settings
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import { useTranslation } from 'react-i18next';
import { ProfileCircle } from '../components/ProfileCircle';
import { useAuthService } from '../contexts/AppContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { REVENUECAT_CONFIG } from '../config/revenuecat';
import { RootStackNavigationProp } from '../navigation/types';
import { FONTS, COLORS } from '../constants/assets';
import type { SubscriptionPlan, SubscriptionStatus, RelationshipToChild } from '@nora/core';
import amplitudeService from '../services/amplitudeService';
import { changeLanguage } from '../i18n';

interface UserProfile {
  name: string;
  email: string;
  childName: string;
  profileImageUrl?: string;
  relationshipToChild?: RelationshipToChild;
  childBirthYear?: number;
  childBirthday?: Date;
  issue?: string | string[];
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionSource?: 'stripe' | 'revenuecat' | 'admin' | null;
  trialStartDate?: Date;
  trialEndDate?: Date;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
}

export const ProfileScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<RootStackNavigationProp>();
  const authService = useAuthService();
  const { checkSubscriptionStatus } = useSubscription();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // RevenueCat real-time subscription state (source of truth for display)
  const [rcSubscription, setRcSubscription] = useState<{
    isActive: boolean;
    expirationDate: Date | null;
    willRenew: boolean;
    periodType: string | null;
  } | null>(null);

  useEffect(() => {
    amplitudeService.trackScreenView('Profile');
  }, []);

  // Refresh profile when screen gains focus (ensures subscription status is current)
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
      loadRevenueCatStatus();
    }, [])
  );

  // Load real-time subscription status directly from RevenueCat SDK
  const loadRevenueCatStatus = async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[REVENUECAT_CONFIG.entitlements.premium];
      const hasActiveSubscription = customerInfo.activeSubscriptions.length > 0;

      if (entitlement) {
        setRcSubscription({
          isActive: true,
          expirationDate: entitlement.expirationDate ? new Date(entitlement.expirationDate) : null,
          willRenew: entitlement.willRenew,
          periodType: entitlement.periodType,
        });
      } else if (hasActiveSubscription) {
        setRcSubscription({
          isActive: true,
          expirationDate: null,
          willRenew: true,
          periodType: 'NORMAL',
        });
      } else {
        setRcSubscription({
          isActive: false,
          expirationDate: null,
          willRenew: false,
          periodType: null,
        });
      }

      // Also refresh the context
      checkSubscriptionStatus();
    } catch (error) {
      console.error('Failed to load RevenueCat status:', error);
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const user = await authService.getCurrentUser();

      setProfile({
        name: user.name,
        email: user.email,
        childName: user.childName,
        profileImageUrl: user.profileImageUrl,
        relationshipToChild: user.relationshipToChild,
        childBirthYear: user.childBirthYear,
        childBirthday: user.childBirthday,
        issue: user.issue,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionSource: user.subscriptionSource,
        trialStartDate: user.trialStartDate,
        trialEndDate: user.trialEndDate,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert(t('common.error'), t('profile.errorLoadProfile'));
    } finally {
      setLoading(false);
    }
  };


  const handleLogout = () => {
    amplitudeService.trackEvent('Profile Logout Tapped');
    Alert.alert(
      t('profile.logOutConfirmTitle'),
      t('profile.logOutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.logOutConfirmButton'), style: 'destructive', onPress: performLogout },
      ]
    );
  };

  const performLogout = async () => {
    try {
      setLoggingOut(true);

      await authService.logout();
      amplitudeService.trackEvent('User Logged Out');
      amplitudeService.reset();

      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert(t('common.error'), t('profile.errorLogOut'));
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = () => {
    amplitudeService.trackEvent('Profile Delete Account Tapped');
    Alert.alert(
      t('profile.deleteConfirmTitle'),
      t('profile.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.deleteConfirmButton'), style: 'destructive', onPress: performDeleteAccount },
      ]
    );
  };

  const performDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      amplitudeService.trackEvent('User Account Deleted');
      await authService.deleteAccount();

      // Navigate to onboarding after successful deletion
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    } catch (error: any) {
      console.error('Delete account error:', error);
      Alert.alert(t('common.error'), error.message || t('profile.errorDeleteAccount'));
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleManageSubscription = async () => {
    amplitudeService.trackEvent('Profile Manage Subscription Tapped');

    // Web-signup subscribers live entirely in Stripe — there's no App Store/Play Store
    // subscription to show, so route them to Stripe's own Billing Portal instead.
    if (profile?.subscriptionSource === 'stripe') {
      try {
        const { url } = await authService.createBillingPortalSession();
        await Linking.openURL(url);
      } catch (error) {
        console.error('Failed to open Stripe billing portal:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        amplitudeService.trackEvent('Manage Subscription Error', {
          reason: 'stripe_portal_failed',
          platform: Platform.OS,
          error: errorMessage,
        });
        Alert.alert(t('common.error'), t('profile.errorManageSubscriptionRetry'));
      }
      return;
    }

    try {
      if (Platform.OS === 'ios') {
        await Purchases.showManageSubscriptions();
      } else if (Platform.OS === 'android') {
        // Android: Open Google Play subscription management
        const androidPackageName = 'com.chromamind.nora';
        const url = `https://play.google.com/store/account/subscriptions?package=${androidPackageName}`;
        const supported = await Linking.canOpenURL(url);

        if (supported) {
          await Linking.openURL(url);
        } else {
          amplitudeService.trackEvent('Manage Subscription Error', { reason: 'url_not_supported', platform: Platform.OS });
          Alert.alert(t('common.error'), t('profile.errorManageSubscription'));
        }
      }
    } catch (error) {
      console.error('Failed to open subscription management:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      amplitudeService.trackEvent('Manage Subscription Error', {
        reason: 'open_failed',
        platform: Platform.OS,
        error: errorMessage,
      });
      Alert.alert(t('common.error'), t('profile.errorManageSubscriptionRetry'));
    }
  };

  const getChildAge = () => {
    if (!profile) return null;

    if (profile.childBirthday) {
      const today = new Date();
      const birthDate = new Date(profile.childBirthday);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      return age;
    }

    if (profile.childBirthYear) {
      const currentYear = new Date().getFullYear();
      return currentYear - profile.childBirthYear;
    }

    return null;
  };

  const getIssueLabel = (issue?: string | string[]) => {
    const getLabel = (key: string) => t(`profile.issueTags.${key}`, { defaultValue: key });

    if (!issue) return t('profile.issueNotSpecified');

    if (Array.isArray(issue)) {
      return issue.map(i => getLabel(i)).join(', ');
    }

    return getLabel(issue);
  };

  const formatLocalDate = (date: Date): string => {
    const month = t(`months.${date.getMonth()}`);
    return `${month} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const getSubscriptionInfo = () => {
    // Web-signup (Stripe) subscribers have no RevenueCat entitlement — RC will report
    // them as inactive even though they're paying via Stripe. Always trust the backend
    // for these users so we don't show "Free" to an active subscriber.
    // Otherwise, use RevenueCat data as source of truth (instant updates after purchase),
    // falling back to backend data if RevenueCat hasn't loaded yet.
    if (rcSubscription && profile?.subscriptionSource !== 'stripe') {
      const { isActive, expirationDate, willRenew, periodType } = rcSubscription;

      // Determine plan name
      let planName = t('profile.planNames.free');
      if (isActive) {
        planName = periodType === 'TRIAL' ? t('profile.planNames.premiumTrial') : t('profile.planNames.premium');
      }

      // Calculate status
      let status: SubscriptionStatus = 'INACTIVE';
      if (isActive) {
        status = willRenew ? 'ACTIVE' : 'CANCELLED';
      } else if (expirationDate && new Date() > expirationDate) {
        status = 'EXPIRED';
      }

      // Format status text
      let statusText = '';
      const formattedDate = expirationDate ? formatLocalDate(expirationDate) : null;

      if (!isActive) {
        statusText = expirationDate ? t('profile.subscriptionStatus.subscriptionExpired') : t('profile.subscriptionStatus.noActiveSubscription');
      } else if (!willRenew && formattedDate) {
        statusText = periodType === 'TRIAL'
          ? t('profile.subscriptionStatus.trialEnds', { date: formattedDate })
          : t('profile.subscriptionStatus.cancelledEnds', { date: formattedDate });
      } else if (formattedDate) {
        statusText = periodType === 'TRIAL'
          ? t('profile.subscriptionStatus.trialEnds', { date: formattedDate })
          : t('profile.subscriptionStatus.renews', { date: formattedDate });
      } else {
        statusText = t('profile.subscriptionStatus.active');
      }

      return { planName, statusText, daysRemaining: 0, status };
    }

    // Fallback to backend data
    if (!profile) return null;

    const plan = profile.subscriptionPlan || 'FREE';
    const status = profile.subscriptionStatus || 'INACTIVE';

    let endDate: Date | null = null;
    if (profile.subscriptionEndDate) {
      endDate = new Date(profile.subscriptionEndDate);
    }

    const planName = plan === 'TRIAL' ? t('profile.planNames.premiumTrial') : plan === 'PREMIUM' ? t('profile.planNames.premium') : t('profile.planNames.free');
    let statusText = '';
    const formattedDate = endDate && !isNaN(endDate.getTime()) ? formatLocalDate(endDate) : null;

    if (status === 'INACTIVE') {
      statusText = t('profile.subscriptionStatus.noActiveSubscription');
    } else if (status === 'EXPIRED') {
      statusText = t('profile.subscriptionStatus.subscriptionExpired');
    } else if (status === 'CANCELLED') {
      statusText = formattedDate ? t('profile.subscriptionStatus.cancelledEnds', { date: formattedDate }) : t('profile.subscriptionStatus.cancelled');
    } else if (status === 'ACTIVE') {
      if (plan === 'TRIAL' && formattedDate) {
        statusText = t('profile.subscriptionStatus.trialEnds', { date: formattedDate });
      } else if (formattedDate) {
        statusText = t('profile.subscriptionStatus.renews', { date: formattedDate });
      } else {
        statusText = t('profile.subscriptionStatus.active');
      }
    }

    return { planName, statusText, daysRemaining: 0, status };
  };

  const handleLanguagePress = () => {
    amplitudeService.trackEvent('Profile Language Tapped', { currentLanguage: i18n.language });
    const applyLocale = (locale: string) => {
      amplitudeService.trackEvent('Profile Language Changed', { language: locale });
      changeLanguage(locale);
      authService.setPreferredLocale(locale).catch((err) => console.warn('[Lang] setPreferredLocale failed:', err));
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('languagePicker.english'), t('languagePicker.traditionalChinese')],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) applyLocale('en');
          else if (buttonIndex === 2) applyLocale('zh-TW');
        }
      );
    } else {
      Alert.alert(t('languagePicker.title'), undefined, [
        { text: t('languagePicker.english'), onPress: () => applyLocale('en') },
        { text: t('languagePicker.traditionalChinese'), onPress: () => applyLocale('zh-TW') },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  };

  const currentLanguageLabel = i18n.language === 'zh-TW'
    ? t('languagePicker.traditionalChinese')
    : t('languagePicker.english');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8C49D5" />
          <Text style={styles.loadingText}>{t('profile.loadingProfile')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Image and Name */}
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            <ProfileCircle
              size={100}
              imageUrl={profile?.profileImageUrl}
              relationshipToChild={profile?.relationshipToChild}
            />
            {/* <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={20} color="#8C49D5" />
            </View> */}
          </View>
          <Text style={styles.profileName}>{profile?.name}</Text>
          {/* <Text style={styles.profileEmail}>{profile?.email}</Text>
          <Text style={styles.tapToChange}>Tap to change photo</Text> */}
        </View>

        {/* Account Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.account')}</Text>

          <View style={styles.card}>
            {/* <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="person-outline" size={20} color="#8C49D5" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Parent Name</Text>
                <Text style={styles.infoValue}>{profile?.name}</Text>
              </View>
            </View>

            <View style={styles.divider} /> */}

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="mail-outline" size={20} color="#8C49D5" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('profile.emailLabel')}</Text>
                <Text style={styles.infoValue}>{profile?.email}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="happy-outline" size={20} color="#8C49D5" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('profile.childNameLabel')}</Text>
                <Text style={styles.infoValue}>{profile?.childName}</Text>
              </View>
            </View>

            {getChildAge() !== null && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="calendar-outline" size={20} color="#8C49D5" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('profile.childAgeLabel')}</Text>
                    <Text style={styles.infoValue}>{t('profile.childAgeValue', { age: getChildAge() })}</Text>
                  </View>
                </View>
              </>
            )}

            {profile?.issue && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="heart-outline" size={20} color="#8C49D5" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('profile.primaryFocusLabel')}</Text>
                    <Text style={styles.infoValue}>{getIssueLabel(profile.issue)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.subscriptionSection')}</Text>

          <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="diamond-outline" size={20} color="#8C49D5" />
              </View>
              <View style={styles.infoContentFlex}>
                <View>
                  <Text style={styles.infoLabel}>{t('profile.currentPlan')}</Text>
                  <Text style={styles.infoValue}>
                    {getSubscriptionInfo()?.planName || t('profile.planNames.premiumTrial')}
                  </Text>
                  {getSubscriptionInfo()?.statusText && (
                    <Text style={[
                      styles.subscriptionNote,
                      getSubscriptionInfo()?.status === 'INACTIVE' && styles.subscriptionInactive,
                      getSubscriptionInfo()?.status === 'EXPIRED' && styles.subscriptionExpired,
                      getSubscriptionInfo()?.status === 'CANCELLED' && styles.subscriptionCancelled,
                    ]}>
                      {getSubscriptionInfo()?.statusText}
                    </Text>
                  )}
                </View>
                {/* <Ionicons name="chevron-forward" size={20} color="#9CA3AF" /> */}
              </View>
            </View>
          </TouchableOpacity>

          {(() => {
            const hasActiveSub = (rcSubscription && profile?.subscriptionSource !== 'stripe')
              ? rcSubscription.isActive
              : (
                profile?.subscriptionStatus === 'ACTIVE'
                || profile?.subscriptionStatus === 'CANCELLED'
                || profile?.subscriptionStatus === 'TRIAL'
                || profile?.subscriptionStatus === 'PAST_DUE'
              );
            return hasActiveSub ? (
              <TouchableOpacity
                style={styles.linkButton}
                activeOpacity={0.7}
                onPress={handleManageSubscription}
              >
                <Text style={styles.linkButtonText}>{t('profile.manageSubscription')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.linkButton}
                activeOpacity={0.7}
                onPress={() => {
                  amplitudeService.trackEvent('Profile Subscribe Tapped');
                  navigation.navigate('Onboarding', { initialStep: 'Subscription' });
                }}
              >
                <Text style={styles.linkButtonText}>{t('subscription.subscribeNow')}</Text>
              </TouchableOpacity>
            );
          })()}
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => { amplitudeService.trackEvent('Profile Refer Friend Tapped'); navigation.navigate('Referral'); }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="gift-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>{t('profile.referFriend')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => { amplitudeService.trackEvent('Profile Notifications Tapped'); navigation.navigate('NotificationSettings'); }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="notifications-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>{t('profile.notifications')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={handleLanguagePress}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="language-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>{t('profile.language')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 14, color: '#9CA3AF' }}>{currentLanguageLabel}</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => { amplitudeService.trackEvent('Profile Support Tapped'); navigation.navigate('Support'); }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="help-circle-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>{t('profile.support')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => { amplitudeService.trackEvent('Profile Terms Tapped'); Linking.openURL('https://hinora.co/terms'); }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="document-text-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>{t('profile.termsAndConditions')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => { amplitudeService.trackEvent('Profile Privacy Policy Tapped'); Linking.openURL('https://hinora.co/privacy'); }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>{t('profile.privacyPolicy')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loggingOut || deletingAccount}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.logoutText}>{t('profile.logOut')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={handleDeleteAccount}
          disabled={loggingOut || deletingAccount}
          activeOpacity={0.8}
        >
          {deletingAccount ? (
            <ActivityIndicator color="#9CA3AF" />
          ) : (
            <Text style={styles.deleteAccountText}>{t('profile.deleteAccount')}</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  profileImageContainer: {
    position: 'relative',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F3E8FF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileName: {
    marginTop: 16,
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: '#1F2937',
  },
  profileEmail: {
    marginTop: 4,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
  },
  tapToChange: {
    marginTop: 8,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#8C49D5',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#1F2937',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoContentFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#1F2937',
  },
  subscriptionNote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#8C49D5',
    marginTop: 2,
  },
  subscriptionExpired: {
    color: '#EF4444',
  },
  subscriptionCancelled: {
    color: '#F59E0B',
  },
  subscriptionInactive: {
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: 56,
  },
  linkButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  linkButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#8C49D5',
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#1F2937',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#EF4444',
  },
  deleteAccountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 16,
  },
  deleteAccountText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },

});
