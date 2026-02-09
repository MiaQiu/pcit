/**
 * Intro 2 Screen
 * "When is your 5 mins?" - Time picker for play session scheduling
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';
import { DragonCard } from '../../components/DragonCard';

export const Intro2Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();
  const userName = data.name || '';

  // Default to 7:30 PM
  const defaultDate = new Date();
  defaultDate.setHours(19, 30, 0, 0);
  const [selectedTime, setSelectedTime] = useState(defaultDate);

  const onTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setSelectedTime(date);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <OnboardingProgressHeader phase={4} step={2} totalSteps={3} />

        <View style={styles.textContent}>
          <Text style={styles.title}>
            Hi{userName ? ` ${userName}` : ''}, When is your 5 mins?
          </Text>
          <Text style={styles.description}>
            Many parents find the "After-School Reconnect" or "Pre-Dinner Play" or "Weekend day morning" works best.
          </Text>

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

        <View style={styles.cardContainer}>
          <DragonCard text="Personalized guidance that grows with your child" />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            const hours = selectedTime.getHours().toString().padStart(2, '0');
            const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
            updateData({ reminderTime: `${hours}:${minutes}` });
            navigation.navigate('Intro3');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Continue  →</Text>
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
    paddingTop: 40,
    paddingBottom: 112,
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
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
    marginTop: -60
  },
  cardContainer: {},
  button: {
    position: 'absolute',
    bottom: 16,
    left: 32,
    right: 32,
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
});
