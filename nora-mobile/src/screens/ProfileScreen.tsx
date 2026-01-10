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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Purchases from 'react-native-purchases';
import { ProfileCircle } from '../components/ProfileCircle';
import { useAuthService } from '../contexts/AppContext';
import { RootStackNavigationProp } from '../navigation/types';
import { FONTS, COLORS } from '../constants/assets';
import type { SubscriptionPlan, SubscriptionStatus, RelationshipToChild } from '@nora/core';

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
  trialStartDate?: Date;
  trialEndDate?: Date;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
}

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const authService = useAuthService();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

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
        trialStartDate: user.trialStartDate,
        trialEndDate: user.trialEndDate,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert('Error', 'Failed to load profile information');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileImagePress = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos to change your profile picture.'
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadProfileImage = async (imageUri: string) => {
    const uploadWithRetry = async (isRetry: boolean = false): Promise<any> => {
      // Refresh token before upload if not a retry
      if (!isRetry) {
        await authService.refreshAccessToken();
      }

      // Create FormData
      const formData = new FormData();

      // Get file extension
      const uriParts = imageUri.split('.');
      const fileType = uriParts[uriParts.length - 1];

      // Create file object for upload
      const file: any = {
        uri: imageUri,
        name: `profile.${fileType}`,
        type: `image/${fileType}`,
      };

      formData.append('image', file);

      // Upload to server
      const token = authService.getAccessToken();
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

      const response = await fetch(`${apiUrl}/api/auth/upload-profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      // Handle 401 - token expired
      if (response.status === 401 && !isRetry) {
        console.log('[ProfileScreen] Token expired, refreshing and retrying...');
        const refreshed = await authService.refreshAccessToken();
        if (refreshed) {
          return uploadWithRetry(true);
        } else {
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return await response.json();
    };

    try {
      setUploadingImage(true);

      const data = await uploadWithRetry();

      // Update local profile state
      setProfile(prev => prev ? {
        ...prev,
        profileImageUrl: data.user.profileImageUrl
      } : null);

      Alert.alert('Success', 'Profile image updated successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const performLogout = async () => {
    try {
      setLoggingOut(true);

      // Call logout API (clears auth tokens)
      await authService.logout();

      // Navigate to onboarding
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      if (Platform.OS === 'ios') {
        // iOS: Use RevenueCat's built-in method to show subscription management
        await Purchases.showManageSubscriptions();
      } else if (Platform.OS === 'android') {
        // Android: Open Google Play subscription management
        const androidPackageName = 'com.chromamind.nora';
        const url = `https://play.google.com/store/account/subscriptions?package=${androidPackageName}`;
        const supported = await Linking.canOpenURL(url);

        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Could not open subscription management');
        }
      }
    } catch (error) {
      console.error('Failed to open subscription management:', error);
      Alert.alert('Error', 'Could not open subscription management. Please try again.');
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
    const issueLabels: Record<string, string> = {
      tantrums: 'Tantrums or managing big feelings',
      'not-listening': 'Not listening',
      arguing: 'Arguing',
      social: 'Social-emotional skills',
      new_baby_in_the_house: 'New baby in the home',
      frustration_tolerance: 'Low frustration tolerance',
      Navigating_change: 'Navigating a big change',
      defiance: 'Defiance',
      aggression: 'Aggression',
      emotional: 'Emotional Regulation',
      routine: 'Routine & Structure',
      general: 'General Behavior',
    };

    if (!issue) return 'Not specified';

    if (Array.isArray(issue)) {
      // Return comma-separated list of labels
      return issue.map(i => issueLabels[i] || i).join(', ');
    }

    return issueLabels[issue] || issue;
  };

  const getSubscriptionInfo = () => {
    if (!profile) return null;

    const plan = profile.subscriptionPlan || 'TRIAL';
    const status = profile.subscriptionStatus || 'ACTIVE';

    // Calculate days remaining
    let daysRemaining = 0;
    let endDate: Date | null = null;

    // Parse date strings to Date objects
    if (plan === 'TRIAL' && profile.trialEndDate) {
      endDate = new Date(profile.trialEndDate);
      //console.log('Trial end date:', profile.trialEndDate, 'Parsed:', endDate);
    } else if (profile.subscriptionEndDate) {
      endDate = new Date(profile.subscriptionEndDate);
      //console.log('Subscription end date:', profile.subscriptionEndDate, 'Parsed:', endDate);
    }

    if (endDate && !isNaN(endDate.getTime())) {
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      //console.log('Days remaining:', daysRemaining);
    }

    // Get plan display name
    const planName = plan === 'TRIAL' ? 'Premium Trial' : plan === 'PREMIUM' ? 'Premium' : 'Free';

    // Get status text
    let statusText = '';
    if (status === 'EXPIRED') {
      statusText = 'Expired';
    } else if (status === 'CANCELLED') {
      statusText = 'Cancelled';
    } else if (endDate && !isNaN(endDate.getTime())) {
      // Format end date
      const formattedDate = endDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      statusText = `Ends ${formattedDate}`;

      // Optionally add days remaining
      if (daysRemaining > 0) {
        statusText += ` (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining)`;
      }
    } else {
      statusText = 'Active';
    }

    return {
      planName,
      statusText,
      daysRemaining,
      status,
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8C49D5" />
          <Text style={styles.loadingText}>Loading profile...</Text>
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
        <Text style={styles.headerTitle}>Profile</Text>
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
              onPress={handleProfileImagePress}
            />
            {uploadingImage && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFFFFF" size="large" />
              </View>
            )}
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
          <Text style={styles.sectionTitle}>Account</Text>

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
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{profile?.email}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="happy-outline" size={20} color="#8C49D5" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Child's Name</Text>
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
                    <Text style={styles.infoLabel}>Child's Age</Text>
                    <Text style={styles.infoValue}>{getChildAge()} years old</Text>
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
                    <Text style={styles.infoLabel}>Primary Focus Area</Text>
                    <Text style={styles.infoValue}>{getIssueLabel(profile.issue)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>

          <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="diamond-outline" size={20} color="#8C49D5" />
              </View>
              <View style={styles.infoContentFlex}>
                <View>
                  <Text style={styles.infoLabel}>Current Plan</Text>
                  <Text style={styles.infoValue}>
                    {getSubscriptionInfo()?.planName || 'Premium Trial'}
                  </Text>
                  {getSubscriptionInfo()?.statusText && (
                    <Text style={[
                      styles.subscriptionNote,
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

          <TouchableOpacity
            style={styles.linkButton}
            activeOpacity={0.7}
            onPress={handleManageSubscription}
          >
            <Text style={styles.linkButtonText}>Manage Subscription</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('NotificationSettings')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="notifications-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>Notifications</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('PrivacySecurity')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="lock-closed-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>Privacy & Security</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} /> */}

            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Support')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="help-circle-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('TermsAndConditions')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="document-text-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>Terms and Conditions</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#1F2937" />
                <Text style={styles.settingText}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.logoutText}>Log Out</Text>
            </>
          )}
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>Version 1.0.0</Text>
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
  versionText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
});
