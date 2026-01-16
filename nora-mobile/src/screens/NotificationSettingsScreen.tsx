/**
 * Notification Settings Screen
 * Manage notification preferences
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Audio } from 'expo-av';
import { FONTS, COLORS, SOUNDS } from '../constants/assets';
import {
  requestNotificationPermissions as requestPermissions,
  scheduleDailyLessonReminder,
  cancelDailyLessonReminder,
} from '../utils/notifications';
import { useAuthService } from '../contexts/AppContext';

interface NotificationPreferences {
  dailyLessonReminder: boolean;
  dailyLessonTime: string; // HH:mm format
  practiceReminders: boolean;
  progressUpdates: boolean;
  weeklySummary: boolean;
  newContentAlerts: boolean;
  newReportNotification: boolean; // Notify when session report is ready
  cdiCompleteSound: string; // Sound effect when 5 min CDI recording is done
  pdiTransitionSound: string; // Sound effect when transitioning from CDI to PDI
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  dailyLessonReminder: true,
  dailyLessonTime: '18:30',
  practiceReminders: true,
  progressUpdates: true,
  weeklySummary: true,
  newContentAlerts: true,
  newReportNotification: true,
  cdiCompleteSound: 'Win',
  pdiTransitionSound: 'Win',
};

// Available sound effects for Connect Phase (CDI Complete)
const CONNECT_PHASE_SOUNDS = [
  { id: 'Win', label: 'Win Chime'},
  { id: 'Bell', label: 'Gentle Bell' },
  // { id: 'voice-reminder', label: 'Voice Reminder'},
];

// Available sound effects for Discipline Phase (PDI Transition)
const DISCIPLINE_PHASE_SOUNDS = [
  { id: 'Bell', label: 'Gentle Bell' },
  { id: 'Win', label: 'Win Chime'},
  { id: 'voice-reminder', label: 'Voice Reminder'},
];

const STORAGE_KEY = '@notification_preferences';

export const NotificationSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const authService = useAuthService();

  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [soundPickerType, setSoundPickerType] = useState<'cdiComplete' | 'pdiTransition'>('cdiComplete');

  const soundRef = React.useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadPreferences();
    checkNotificationPermissions();
  }, []);

  // Check permission status when screen comes into focus (e.g., returning from Settings)
  useFocusEffect(
    useCallback(() => {
      const checkAndEnableNotifications = async () => {
        const { status } = await Notifications.getPermissionsAsync();
        const wasDisabled = !notificationsEnabled;
        const isNowEnabled = status === 'granted';

        if (wasDisabled && isNowEnabled) {
          // Permission was just granted - enable key notifications
          setNotificationsEnabled(true);

          // Register push token with backend (this was missing before!)
          const accessToken = authService.getAccessToken();
          await requestPermissions(accessToken);

          const newPreferences = {
            ...preferences,
            dailyLessonReminder: true,
            newReportNotification: true,
          };
          await savePreferences(newPreferences);

          // Schedule the daily reminder
          if (newPreferences.dailyLessonReminder) {
            await scheduleDailyReminder(newPreferences.dailyLessonTime);
          }
        } else {
          setNotificationsEnabled(isNowEnabled);
        }
      };

      checkAndEnableNotifications();
    }, [notificationsEnabled, preferences])
  );

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPreferences(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
      setPreferences(newPreferences);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      Alert.alert('Error', 'Failed to save preferences');
    }
  };

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === 'granted');
  };

  const requestNotificationPermissions = async () => {
    // Get access token to register push token with backend
    const accessToken = authService.getAccessToken();
    const granted = await requestPermissions(accessToken);

    if (!granted) {
      Alert.alert(
        'Notifications Disabled',
        'Please enable notifications in your device settings to receive reminders.',
        [
          { text: 'OK', style: 'cancel' },
        ]
      );
      return false;
    }

    setNotificationsEnabled(true);

    // When permission is granted for the first time, automatically enable key notifications
    const newPreferences = {
      ...preferences,
      dailyLessonReminder: true,
      newReportNotification: true,
    };
    await savePreferences(newPreferences);

    // Schedule the daily reminder with the current time preference
    if (newPreferences.dailyLessonReminder) {
      await scheduleDailyReminder(newPreferences.dailyLessonTime);
    }

    return true;
  };

  const handleToggle = async (key: keyof NotificationPreferences) => {
    // If turning on any notification, check permissions first
    if (!preferences[key] && !notificationsEnabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) return;
    }

    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };

    await savePreferences(newPreferences);

    // TODO: Schedule/cancel actual notifications based on preferences
    if (key === 'dailyLessonReminder') {
      if (newPreferences.dailyLessonReminder) {
        // Schedule daily reminder
        scheduleDailyReminder(newPreferences.dailyLessonTime);
      } else {
        // Cancel daily reminder
        cancelDailyReminder();
      }
    }
  };

  const scheduleDailyReminder = async (time: string) => {
    try {
      const notificationId = await scheduleDailyLessonReminder(time);
      if (notificationId) {
        console.log('Successfully scheduled daily reminder for', time);
      } else {
        console.error('Failed to schedule daily reminder');
      }
    } catch (error) {
      console.error('Error scheduling daily reminder:', error);
    }
  };

  const cancelDailyReminder = async () => {
    try {
      await cancelDailyLessonReminder();
      console.log('Successfully canceled daily reminder');
    } catch (error) {
      console.error('Error canceling daily reminder:', error);
    }
  };

  const handleTimeChange = () => {
    // Parse current time and set it as initial value
    const [hour, minute] = preferences.dailyLessonTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute);
    setTempTime(date);
    setShowTimePicker(true);
  };

  const handleTimePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (selectedDate) {
      setTempTime(selectedDate);

      // On Android, immediately save the time
      if (Platform.OS === 'android' && event.type === 'set') {
        saveNewTime(selectedDate);
      }
    }
  };

  const saveNewTime = async (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    const newPreferences = {
      ...preferences,
      dailyLessonTime: timeString,
    };

    await savePreferences(newPreferences);

    // Reschedule notification with new time
    if (preferences.dailyLessonReminder) {
      await scheduleDailyReminder(timeString);
    }
  };

  const handleConfirmTime = () => {
    setShowTimePicker(false);
    saveNewTime(tempTime);
  };

  const handleCancelTimePicker = () => {
    setShowTimePicker(false);
  };

  const handleSoundChange = (type: 'cdiComplete' | 'pdiTransition') => {
    setSoundPickerType(type);
    setShowSoundPicker(true);
  };

  const handleSoundSelect = async (soundId: string) => {
    const key = soundPickerType === 'cdiComplete' ? 'cdiCompleteSound' : 'pdiTransitionSound';

    const newPreferences = {
      ...preferences,
      [key]: soundId,
    };

    await savePreferences(newPreferences);

    // Play sound preview
    await playSound(soundId);

    // Keep modal open so user can test other sounds
    // Modal only closes when user clicks "Done" button
  };

  const getSoundLabel = (soundId: string): string => {
    // Look in both sound arrays
    const sound = [...CONNECT_PHASE_SOUNDS, ...DISCIPLINE_PHASE_SOUNDS].find(s => s.id === soundId);
    return sound ? `${sound.label}` : soundId;
  };

  const getCurrentSoundOptions = () => {
    return soundPickerType === 'cdiComplete' ? CONNECT_PHASE_SOUNDS : DISCIPLINE_PHASE_SOUNDS;
  };

  const playSound = async (soundId: string) => {
    try {
      // Stop and unload previous sound if any
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Don't play if "none" is selected
      if (soundId === 'none') {
        return;
      }

      // Map sound ID to actual sound file
      let soundSource;
      switch (soundId) {
        case 'voice-reminder':
          soundSource = SOUNDS.voiceReminder;
          break;
        // For now, other sounds will use the voice reminder as placeholder
        // TODO: Add actual sound files for other options
        case 'Win':
          soundSource = SOUNDS.Win;
          break;
        case 'Bell':
          soundSource = SOUNDS.Bell; // Placeholder
          break;
        default:
          console.log('Unknown sound ID:', soundId);
          return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create and play sound
      const { sound } = await Audio.Sound.createAsync(soundSource);
      soundRef.current = sound;

      await sound.playAsync();

      // Unload after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          if (soundRef.current === sound) {
            soundRef.current = null;
          }
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
      Alert.alert('Error', 'Failed to play sound preview');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
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
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Permission Status */}
        {!notificationsEnabled && (
          <View style={styles.permissionBanner}>
            <Ionicons name="notifications-off-outline" size={32} color="#F59E0B" />
            <View style={styles.permissionTextContainer}>
              <Text style={styles.permissionTitle}>Notifications Disabled</Text>
              <Text style={styles.permissionSubtitle}>
                To receive reminders and updates, please enable notifications in your device Settings.
              </Text>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => Linking.openSettings()}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={16} color="#FFFFFF" />
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Daily Lesson Reminder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Reminders</Text>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons
                  name="calendar-outline"
                  size={22}
                  color={notificationsEnabled ? "#8C49D5" : "#D1D5DB"}
                />
                <View style={styles.settingContent}>
                  <Text style={[
                    styles.settingText,
                    !notificationsEnabled && styles.settingTextDisabled
                  ]}>
                    Daily Lesson Reminder
                  </Text>
                  <Text style={styles.settingDescription}>
                    Get reminded to complete your daily lesson
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.dailyLessonReminder && notificationsEnabled}
                onValueChange={() => handleToggle('dailyLessonReminder')}
                disabled={!notificationsEnabled}
                trackColor={{ false: '#D1D5DB', true: '#C4B5FD' }}
                thumbColor={preferences.dailyLessonReminder && notificationsEnabled ? '#8C49D5' : '#F3F4F6'}
                ios_backgroundColor="#D1D5DB"
              />
            </View>

            {preferences.dailyLessonReminder && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.timeRow}
                  onPress={handleTimeChange}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timeLabel}>Reminder Time</Text>
                  <View style={styles.timeValue}>
                    <Text style={styles.timeText}>{preferences.dailyLessonTime}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Practice & Progress */}
        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress</Text>

          <View style={styles.card}> */}
            {/* <View style={styles.settingRow}> */}
              {/* <View style={styles.settingLeft}>
                <Ionicons name="fitness-outline" size={22} color="#8C49D5" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingText}>Practice Reminders</Text>
                  <Text style={styles.settingDescription}>
                    Reminders to practice PCIT skills with your child
                  </Text>
                </View>
              </View> */}
              {/* <Switch
                value={preferences.practiceReminders}
                onValueChange={() => handleToggle('practiceReminders')}
                trackColor={{ false: '#D1D5DB', true: '#C4B5FD' }}
                thumbColor={preferences.practiceReminders ? '#8C49D5' : '#F3F4F6'}
                ios_backgroundColor="#D1D5DB"
              /> */}
            {/* </View> */}

            {/* <View style={styles.divider} /> */}

            {/* <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="trending-up-outline" size={22} color="#8C49D5" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingText}>Progress Updates</Text>
                  <Text style={styles.settingDescription}>
                    Notifications about your learning milestones
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.progressUpdates}
                onValueChange={() => handleToggle('progressUpdates')}
                trackColor={{ false: '#D1D5DB', true: '#C4B5FD' }}
                thumbColor={preferences.progressUpdates ? '#8C49D5' : '#F3F4F6'}
                ios_backgroundColor="#D1D5DB"
              />
            </View> */}

            {/* <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="stats-chart-outline" size={22} color="#8C49D5" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingText}>New Report</Text>
                  <Text style={styles.settingDescription}>
                    Get notified when latest session report is ready.
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.weeklySummary}
                onValueChange={() => handleToggle('weeklySummary')}
                trackColor={{ false: '#D1D5DB', true: '#C4B5FD' }}
                thumbColor={preferences.weeklySummary ? '#8C49D5' : '#F3F4F6'}
                ios_backgroundColor="#D1D5DB"
              />
            </View>
          </View>
        </View> */}

        {/* Session Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Play Session</Text>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color={notificationsEnabled ? "#8C49D5" : "#D1D5DB"}
                />
                <View style={styles.settingContent}>
                  <Text style={[
                    styles.settingText,
                    !notificationsEnabled && styles.settingTextDisabled
                  ]}>
                    New Report Ready
                  </Text>
                  <Text style={styles.settingDescription}>
                    Get notified when your session report is ready to view
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.newReportNotification && notificationsEnabled}
                onValueChange={() => handleToggle('newReportNotification')}
                disabled={!notificationsEnabled}
                trackColor={{ false: '#D1D5DB', true: '#C4B5FD' }}
                thumbColor={preferences.newReportNotification && notificationsEnabled ? '#8C49D5' : '#F3F4F6'}
                ios_backgroundColor="#D1D5DB"
              />
            </View>
          </View>
        </View>

        {/* Play Session Sound Effects */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Play Session Sounds</Text>

          <View style={styles.card}>
            {/* CDI Complete Sound */}
            <TouchableOpacity
              style={styles.soundRow}
              onPress={() => handleSoundChange('cdiComplete')}
              activeOpacity={0.7}
            >
              <View style={styles.soundLeft}>
                <Ionicons name="play-circle-outline" size={22} color="#8C49D5" />
                <View style={styles.soundContent}>
                  <Text style={styles.soundText}>Connect Phase</Text>
                  <Text style={styles.soundDescription}>
                    Sound when 5-minute play session finishes
                  </Text>
                </View>
              </View>
              <View style={styles.soundValue}>
                <Text style={styles.soundLabel}>{getSoundLabel(preferences.cdiCompleteSound)}</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* PDI Transition Sound */}
            <TouchableOpacity
              style={styles.soundRow}
              onPress={() => handleSoundChange('pdiTransition')}
              activeOpacity={0.7}
            >
              <View style={styles.soundLeft}>
                <Ionicons name="swap-horizontal-outline" size={22} color="#8C49D5" />
                <View style={styles.soundContent}>
                  <Text style={styles.soundText}>Discipline Phase</Text>
                  <Text style={styles.soundDescription}>
                    Sound when transitioning from child directed play to discipline
                  </Text>
                </View>
              </View>
              <View style={styles.soundValue}>
                <Text style={styles.soundLabel}>{getSoundLabel(preferences.pdiTransitionSound)}</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            You can change these settings at any time. Notification times and frequency may vary.
          </Text>
        </View>
      </ScrollView>

      {/* Time Picker Modal (iOS) */}
      {Platform.OS === 'ios' && showTimePicker && (
        <Modal
          visible={showTimePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={handleCancelTimePicker}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleCancelTimePicker}
          >
            <View style={styles.modalContent}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={handleCancelTimePicker}>
                  <Text style={styles.pickerButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Select Time</Text>
                <TouchableOpacity onPress={handleConfirmTime}>
                  <Text style={[styles.pickerButton, styles.pickerButtonConfirm]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={handleTimePickerChange}
                textColor="#1F2937"
                style={styles.timePicker}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Time Picker (Android) */}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleTimePickerChange}
        />
      )}

      {/* Sound Picker Modal */}
      {showSoundPicker && (
        <Modal
          visible={showSoundPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowSoundPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSoundPicker(false)}
          >
            <View style={styles.soundModalContent}>
              <View style={styles.pickerHeader}>
                <View style={{ width: 60 }} />
                <Text style={styles.pickerTitle}>
                  {soundPickerType === 'cdiComplete' ? 'Connect Phase Sound' : 'Discipline Phase Sound'}
                </Text>
                <TouchableOpacity onPress={() => setShowSoundPicker(false)}>
                  <Text style={styles.pickerButton}>Done</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.soundOptionsContainer}>
                {getCurrentSoundOptions().map((sound) => {
                  const isSelected = soundPickerType === 'cdiComplete'
                    ? preferences.cdiCompleteSound === sound.id
                    : preferences.pdiTransitionSound === sound.id;

                  return (
                    <TouchableOpacity
                      key={sound.id}
                      style={[
                        styles.soundOption,
                        isSelected && styles.soundOptionSelected
                      ]}
                      onPress={() => handleSoundSelect(sound.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.soundOptionLeft}>
                        {/* <Text style={styles.soundEmoji}>{sound.emoji}</Text> */}
                        <Text style={[
                          styles.soundOptionText,
                          isSelected && styles.soundOptionTextSelected
                        ]}>
                          {sound.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color="#8C49D5" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
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
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  permissionTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  permissionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#92400E',
    marginBottom: 6,
  },
  permissionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
    marginBottom: 12,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  settingsButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#1F2937',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
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
    flex: 1,
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 2,
  },
  settingTextDisabled: {
    color: '#9CA3AF',
  },
  settingDescription: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingLeft: 34,
  },
  timeLabel: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#6B7280',
  },
  timeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#8C49D5',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    marginTop: 24,
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: '#1F2937',
  },
  pickerButton: {
    fontFamily: FONTS.regular,
    fontSize: 17,
    color: '#8C49D5',
  },
  pickerButtonConfirm: {
    fontFamily: FONTS.semiBold,
  },
  timePicker: {
    height: 200,
    width: '100%',
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  soundLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  soundContent: {
    flex: 1,
    marginLeft: 12,
  },
  soundText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 2,
  },
  soundDescription: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
  },
  soundValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soundLabel: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
  },
  soundModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 34,
  },
  soundOptionsContainer: {
    paddingHorizontal: 20,
  },
  soundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#F9FAFB',
  },
  soundOptionSelected: {
    backgroundColor: '#F3E8FF',
    borderWidth: 2,
    borderColor: '#8C49D5',
  },
  soundOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  soundEmoji: {
    fontSize: 24,
  },
  soundOptionText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#1F2937',
  },
  soundOptionTextSelected: {
    fontFamily: FONTS.semiBold,
    color: '#8C49D5',
  },
});
