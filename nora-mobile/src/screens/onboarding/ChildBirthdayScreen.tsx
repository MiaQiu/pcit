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
import { getOnboardingProgress } from '../../config/onboardingProgress';

export const ChildBirthdayScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();

  // Get current date for defaults
  const currentDate = new Date();
  const initialMonth = data.childBirthday ? data.childBirthday.getMonth() : currentDate.getMonth();
  const initialYear = data.childBirthday ? data.childBirthday.getFullYear() : currentDate.getFullYear() - 3;

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  // Calculate child's age in years
  const getChildAge = () => {
    const birthday = new Date(selectedYear, selectedMonth, 1);
    const today = new Date();
    const ageInYears = today.getFullYear() - birthday.getFullYear();
    const monthDifference = today.getMonth() - birthday.getMonth();

    // Adjust age if birthday hasn't occurred yet this year
    if (monthDifference < 0) {
      return ageInYears - 1;
    }
    return ageInYears;
  };

  const childAge = getChildAge();

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
      <OnboardingDragonHeader
        text="This helps us tailor guidance to your child's age and development."
        progress={getOnboardingProgress('ChildBirthday')}
      />

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

      {/* Age-based message */}
      {(childAge < 2 || childAge > 7) && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
          * Note on <Text style={styles.boldText}>Age Suitability</Text>: Nora's method is clinically evidenced to be most effective for children between 2 and 7 years old. However, the foundational skills taught here, such as positive reinforcement and emotional regulation, can be adapted and beneficial for children of any age.
          </Text>
        </View>
      )}

  
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
  messageContainer: {
    marginTop: 16,
    marginBottom: 16,
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
    textAlign: 'left',
  },
  boldText: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  spacer: {
    flex: 1,
  },
});
