/**
 * Reminder Time Screen
 * "When is your 5 mins?" - Time picker for play session scheduling.
 * Shown between OBIntro1 and OBIntro2.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuthService } from '../../contexts/AppContext';
import * as userStorage from '../../lib/userStorage';
import { requestNotificationPermissions, scheduleDailyLessonReminder } from '../../utils/notifications';
import amplitudeService from '../../services/amplitudeService';

export const ReminderTimeScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const authService = useAuthService();
  const { data, updateData } = useOnboarding();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userName = data.name || '';

  const defaultDate = new Date();
  defaultDate.setHours(19, 30, 0, 0);
  const [selectedTime, setSelectedTime] = useState(defaultDate);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => { amplitudeService.trackOnboardingScreen('reminder_time', 26); }, []);

  const onTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setSelectedTime(date);
    }
  };

  const handleSkip = () => {
    amplitudeService.trackOnboardingStepCompleted('reminder_time_skipped', 26);
    navigation.navigate('OBIntro2');
  };

  const handleEnable = async () => {
    setIsRequesting(true);
    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    const reminderTime = `${hours}:${minutes}`;
    updateData({ reminderTime });

    try {
      const accessToken = authService.getAccessToken();
      const granted = await requestNotificationPermissions(accessToken ?? undefined);
      amplitudeService.trackNotificationPermission(granted);
      amplitudeService.trackOnboardingStepCompleted('reminder_time', 26);
      if (granted) {
        await scheduleDailyLessonReminder(reminderTime);

        try {
          const prefsStr = await userStorage.getItem('@notification_preferences');
          const prefs = prefsStr ? JSON.parse(prefsStr) : {};
          prefs.dailyLessonReminder = true;
          prefs.dailyLessonTime = reminderTime;
          await userStorage.setItem('@notification_preferences', JSON.stringify(prefs));
        } catch (e) {
          console.error('Error saving reminder preference:', e);
        }
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    } finally {
      setIsRequesting(false);
      navigation.navigate('OBIntro2');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {t('onboarding.reminderTime.title', { name: userName })}
        </Text>
        <Text style={styles.description}>{t('onboarding.reminderTime.description')}</Text>

        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
            minuteInterval={15}
            textColor="#1F2937"
            themeVariant="light"
            style={styles.timePicker}
          />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleEnable}
          disabled={isRequesting}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {isRequesting ? t('notificationPermission.enabling') : t('onboarding.reminderTime.enableButton')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>{t('onboarding.reminderTime.skip')}</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    textAlign: 'center',
  },
  description: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  pickerContainer: {
    alignItems: 'center',
    marginVertical: 16,
    height: 100,
    overflow: 'hidden',
  },
  timePicker: {
    height: 100,
    width: 300,
    marginTop: -60,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
    gap: 12,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  skipText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#9CA3AF',
  },
});
