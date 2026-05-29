/**
 * Child Birthday Screen
 * User enters their child's birthday with a date picker
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Picker } from '@react-native-picker/picker';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';
import amplitudeService from '../../services/amplitudeService';
import { useAuthService } from '../../contexts/AppContext';

// ─── Android custom scroll picker ────────────────────────────────────────────

const ITEM_HEIGHT = 56;
const PICKER_HEIGHT = ITEM_HEIGHT * 3;

interface ScrollPickerProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const ScrollPicker: React.FC<ScrollPickerProps> = ({ items, selectedIndex, onSelect }) => {
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setActiveIndex(Math.max(0, Math.min(items.length - 1, index)));
  }, [items.length]);

  const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    setActiveIndex(clamped);
    onSelect(clamped);
  }, [items.length, onSelect]);

  return (
    <View style={pickerStyles.container}>
      <ScrollView
        contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        scrollEventThrottle={16}
      >
        {items.map((item, index) => {
          const isSelected = index === activeIndex;
          return (
            <View key={index} style={pickerStyles.item}>
              <Text style={[pickerStyles.itemText, isSelected && pickerStyles.itemTextSelected]}>
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const pickerStyles = StyleSheet.create({
  container: {
    flex: 1,
    height: PICKER_HEIGHT,
    overflow: 'hidden',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 18,
    color: '#9CA3AF',
  },
  itemTextSelected: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#1F1F1F',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export const ChildBirthdayScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();
  const { t } = useTranslation();
  const authService = useAuthService();
  const insets = useSafeAreaInsets();

  useEffect(() => { amplitudeService.trackOnboardingScreen('child_birthday', 16); }, []);

  const currentDate = new Date();
  const initialMonth = data.childBirthday ? data.childBirthday.getMonth() : currentDate.getMonth();
  const initialYear = data.childBirthday ? data.childBirthday.getFullYear() : currentDate.getFullYear() - 3;

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  const currentYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => t(`months.short${i}`));
  const years = Array.from({ length: 13 }, (_, i) => String(currentYear - 12 + i));
  const initialYearIndex = years.indexOf(String(initialYear));

  const getChildAge = () => {
    const birthday = new Date(selectedYear, selectedMonth, 1);
    const today = new Date();
    const age = today.getFullYear() - birthday.getFullYear();
    return today.getMonth() < birthday.getMonth() ? age - 1 : age;
  };

  const childAge = getChildAge();

  const handleContinue = () => {
    const birthday = new Date(selectedYear, selectedMonth, 1);
    updateData({ childBirthday: birthday });
    amplitudeService.trackOnboardingStepCompleted('child_birthday', 16);
    authService.completeOnboarding({ childBirthday: birthday }).catch(() => {});
    navigation.navigate('ChildIssue');
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('ChildGender');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <OnboardingProgressHeader phase={1} step={5} totalSteps={6} />

        <View style={styles.header}>
          <Text style={styles.title}>{t('onboarding.childBirthday.title', { name: data.childName })}</Text>
        </View>

        <View style={styles.pickersContainer}>
          {Platform.OS === 'ios' ? (
            <>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedMonth}
                  onValueChange={(v) => setSelectedMonth(v)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  {months.map((month, index) => (
                    <Picker.Item key={index} label={month} value={index} />
                  ))}
                </Picker>
              </View>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedYear}
                  onValueChange={(v) => setSelectedYear(v)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  {years.map((year) => (
                    <Picker.Item key={year} label={year} value={Number(year)} />
                  ))}
                </Picker>
              </View>
            </>
          ) : (
            <>
              <ScrollPicker
                items={months}
                selectedIndex={initialMonth}
                onSelect={setSelectedMonth}
              />
              <ScrollPicker
                items={years}
                selectedIndex={initialYearIndex >= 0 ? initialYearIndex : years.length - 4}
                onSelect={(i) => setSelectedYear(Number(years[i]))}
              />
            </>
          )}
        </View>

        {(childAge < 2 || childAge > 7) && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>
              {t('onboarding.childBirthday.ageSuitabilityNote')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <OnboardingButtonRow
          onBack={handleBack}
          onContinue={handleContinue}
        />
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
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  footer: {
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 32,
    marginBottom: 40,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#4A5565',
    textAlign: 'center',
  },
  pickersContainer: {
    flexDirection: 'row',
    gap: Platform.OS === 'android' ? 0 : 12,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  pickerWrapper: {
    flex: 1,
  },
  picker: {
    height: 170,
  },
  pickerItem: {
    height: 170,
    fontSize: 28,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  messageContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
  },
  messageText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#4A5565',
    lineHeight: 20,
  },
});
