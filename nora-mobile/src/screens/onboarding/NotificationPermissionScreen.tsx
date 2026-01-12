/**
 * Notification Permission Screen
 * Prompts user to enable push notifications at the end of onboarding
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackNavigationProp } from '../../navigation/types';
import { FONTS, COLORS } from '../../constants/assets';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';
import { requestNotificationPermissions } from '../../utils/notifications';
import { useAuthService } from '../../contexts/AppContext';

export const NotificationPermissionScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const authService = useAuthService();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleNotNow = () => {
    navigation.replace('MainTabs');
  };

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      // Get access token to register push token with backend
      const accessToken = authService.getAccessToken();
      const granted = await requestNotificationPermissions(accessToken);
      if (granted) {
        console.log('Notification permissions granted and push token registered');
      } else {
        Alert.alert(
          'Notifications Disabled',
          'You can enable notifications later in Settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    } finally {
      setIsRequesting(false);
      navigation.replace('MainTabs');
    }
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
      </View>

      {/* Not Now and Enable Buttons */}
      <View style={styles.footer}>
        <OnboardingButtonRow
          onBack={handleNotNow}
          onContinue={handleEnable}
          backText="Not Now"
          continueText="Enable"
        />
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
  footer: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
});
