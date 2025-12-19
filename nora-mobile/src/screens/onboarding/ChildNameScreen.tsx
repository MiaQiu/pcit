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
import { OnboardingDragonHeader } from '../../components/OnboardingDragonHeader';
import { OnboardingTextInput } from '../../components/OnboardingTextInput';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';
import { getOnboardingProgress } from '../../config/onboardingProgress';

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
      <OnboardingDragonHeader
        text="We'll use their name to personalize tips and messages."
        progress={getOnboardingProgress('ChildName')}
      />

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
