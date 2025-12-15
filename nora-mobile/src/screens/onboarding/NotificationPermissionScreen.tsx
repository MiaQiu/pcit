/**
 * Notification Permission Screen
 * Prompts user to enable push notifications at the end of onboarding
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { RootStackNavigationProp } from '../../navigation/types';
import { FONTS, COLORS } from '../../constants/assets';

export const NotificationPermissionScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);

  const requestNotificationPermission = async () => {
    setIsLoading(true);

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // If permission not granted, request it
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        console.log('Notification permission granted');
        // Navigate to main app
        navigation.replace('MainTabs');
      } else {
        // Permission denied, but still continue to app
        Alert.alert(
          'Notifications Disabled',
          'You can enable notifications later in Settings.',
          [
            {
              text: 'OK',
              onPress: () => navigation.replace('MainTabs'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      // Continue to app even if there's an error
      navigation.replace('MainTabs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.replace('MainTabs');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="notifications" size={64} color={COLORS.mainPurple} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Stay on Track</Text>

        {/* Description */}
        <Text style={styles.description}>
          Get gentle reminders to practice what you've learned and track your progress.
        </Text>

        {/* Benefits List */}
        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.mainPurple} />
            <Text style={styles.benefitText}>Daily lesson reminders</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.mainPurple} />
            <Text style={styles.benefitText}>Encouragement messages</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.mainPurple} />
            <Text style={styles.benefitText}>Progress milestones</Text>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.enableButton, isLoading && styles.enableButtonDisabled]}
          onPress={requestNotificationPermission}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.enableButtonText}>
            {isLoading ? 'Enabling...' : 'Enable Notifications'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.skipButtonText}>Not Now</Text>
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 18,
    lineHeight: 28,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  benefitsList: {
    gap: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  benefitText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
    flex: 1,
  },
  enableButton: {
    width: '100%',
    height: 56,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.mainPurple,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  enableButtonDisabled: {
    backgroundColor: '#C4B5FD',
    shadowOpacity: 0.1,
  },
  enableButtonText: {
    fontFamily: FONTS.semiBold,
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
  },
  skipButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#6B7280',
  },
});
