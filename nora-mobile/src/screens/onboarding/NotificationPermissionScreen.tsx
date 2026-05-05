/**
 * Notification Permission Screen
 * Prompts user to enable push notifications at the end of onboarding
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaskedDinoImage } from '../../components/MaskedDinoImage';
import { RootStackNavigationProp } from '../../navigation/types';
import { FONTS, COLORS } from '../../constants/assets';
import { requestNotificationPermissions, scheduleDailyLessonReminder } from '../../utils/notifications';
import { useAuthService } from '../../contexts/AppContext';
import { useOnboarding } from '../../contexts/OnboardingContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const NotificationPermissionScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const authService = useAuthService();
  const { data } = useOnboarding();
  const { t } = useTranslation();

  const BENEFITS = [
    { icon: 'time' as const, text: t('notificationPermission.benefitReminders') },
    { icon: 'bulb' as const, text: t('notificationPermission.benefitInsights') },
    { icon: 'bar-chart' as const, text: t('notificationPermission.benefitReports') },
  ];
  const [isRequesting, setIsRequesting] = useState(false);
  const insets = useSafeAreaInsets();

  const handleNotNow = () => {
    navigation.replace('MainTabs');
  };

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const accessToken = authService.getAccessToken();
      const granted = await requestNotificationPermissions(accessToken);
      if (granted) {
        const reminderTime = data.reminderTime || '19:30';
        await scheduleDailyLessonReminder(reminderTime);

        try {
          const prefsStr = await AsyncStorage.getItem('@notification_preferences');
          const prefs = prefsStr ? JSON.parse(prefsStr) : {};
          prefs.dailyLessonReminder = true;
          prefs.dailyLessonTime = reminderTime;
          await AsyncStorage.setItem('@notification_preferences', JSON.stringify(prefs));
        } catch (e) {
          console.error('Error saving reminder preference:', e);
        }
      } else {
        Alert.alert(
          t('notificationPermission.disabledTitle'),
          t('notificationPermission.disabledMessage'),
          [{ text: t('common.ok') }]
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
    <View style={styles.container}>
      {/* Hero — mirrors SubscriptionScreen */}
      <View style={styles.dragonSection}>
        <View style={styles.dragonContainer}>
          <MaskedDinoImage style={styles.dragonImage} />
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('notificationPermission.title')}</Text>
        <Text style={styles.description}>{t('notificationPermission.description')}</Text>

        <View style={styles.benefitsList}>
          {BENEFITS.map((item, index) => (
            <View key={index} style={styles.benefitItem}>
              <View style={styles.iconBadge}>
                <Ionicons name={item.icon} size={20} color={COLORS.mainPurple} />
              </View>
              <Text style={styles.benefitText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom bar — mirrors SubscriptionScreen */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.enableButton}
          onPress={handleEnable}
          disabled={isRequesting}
          activeOpacity={0.8}
        >
          <Text style={styles.enableButtonText}>
            {isRequesting ? t('notificationPermission.enabling') : t('notificationPermission.enable')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNotNow} activeOpacity={0.7}>
          <Text style={styles.notNowText}>{t('notificationPermission.notNow')}</Text>
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

  // Hero — same as SubscriptionScreen
  dragonSection: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    marginTop: -30,
    marginBottom: 38,
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
    paddingTop: 8,
    paddingBottom: 20,
  },

  title: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
  },

  benefitsList: {
    gap: 10,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#1F2937',
    flex: 1,
  },

  // Bottom bar — same pattern as SubscriptionScreen
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'center',
    gap: 12,
  },
  enableButton: {
    backgroundColor: '#8C49D5',
    borderRadius: 32,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enableButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  notNowText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#9CA3AF',
  },
});
