/**
 * Child Birthday Screen
 * User enters their child's birthday with a date picker
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Picker } from '@react-native-picker/picker';
import { OnboardingLayout } from '../../components/OnboardingLayout';
import { OnboardingDragonHeader } from '../../components/OnboardingDragonHeader';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';

export const ChildBirthdayScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();

  // Get current date for defaults
  const currentDate = new Date();
  const initialMonth = data.childBirthday ? data.childBirthday.getMonth() : currentDate.getMonth();
  const initialYear = data.childBirthday ? data.childBirthday.getFullYear() : currentDate.getFullYear() - 3;

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  const handleContinue = () => {
    // Create a date from month and year (set day to 1st)
    const birthday = new Date(selectedYear, selectedMonth, 1);
    updateData({ childBirthday: birthday });
    navigation.navigate('ChildIssue');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  // Generate months array (short form)
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Generate years array (from 12 years ago to current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 13 }, (_, i) => currentYear - 12 + i);

  return (
    <OnboardingLayout>
      <OnboardingDragonHeader text="This helps us tailor guidance to your child's age and development." />

      <View style={styles.header}>
        <Text style={styles.title}>When is {data.childName}'s birthday?</Text>
      </View>

      {/* Month and Year Pickers */}
      <View style={styles.pickersContainer}>
        {/* Month Picker */}
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedMonth}
            onValueChange={(itemValue) => setSelectedMonth(itemValue)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {months.map((month, index) => (
              <Picker.Item key={index} label={month} value={index} />
            ))}
          </Picker>
        </View>

        {/* Year Picker */}
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedYear}
            onValueChange={(itemValue) => setSelectedYear(itemValue)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {years.map((year) => (
              <Picker.Item key={year} label={year.toString()} value={year} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.spacer} />

      <OnboardingButtonRow
        onBack={handleBack}
        onContinue={handleContinue}
      />
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  header: {
    marginTop: 32,
    marginBottom: 32,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#4A5565',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickersContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
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
  spacer: {
    flex: 1,
  },
});
