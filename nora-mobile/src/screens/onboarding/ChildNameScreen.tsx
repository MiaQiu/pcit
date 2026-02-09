/**
 * Child Name Screen
 * User enters their child's name
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OnboardingLayout } from '../../components/OnboardingLayout';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';
import { OnboardingTextInput } from '../../components/OnboardingTextInput';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';

export const ChildNameScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();
  const [childName, setChildName] = useState(data.childName);

  const handleContinue = () => {
    if (childName.trim()) {
      updateData({ childName: childName.trim() });
      navigation.navigate('ChildGender');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const isValid = childName.trim().length > 0;

  return (
    <OnboardingLayout useKeyboardAvoid>
      <OnboardingProgressHeader phase={1} step={3} totalSteps={6} />

      <OnboardingTextInput
        title="What's your child's name?"
        value={childName}
        onChangeText={setChildName}
        onSubmitEditing={handleContinue}
      />

      <View style={styles.spacer} />

      <OnboardingButtonRow
        onBack={handleBack}
        onContinue={handleContinue}
        continueDisabled={!isValid}
      />
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  spacer: {
    flex: 1,
  },
});
