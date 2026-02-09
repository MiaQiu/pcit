/**
 * Name Input Screen
 * User enters their name
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

export const NameInputScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();
  const [name, setName] = useState(data.name);

  const handleContinue = () => {
    if (name.trim()) {
      updateData({ name: name.trim() });
      navigation.navigate('Relationship');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const isValid = name.trim().length > 0;

  return (
    <OnboardingLayout useKeyboardAvoid>
      <OnboardingProgressHeader phase={1} step={1} totalSteps={6} />

      <OnboardingTextInput
        title="What's your name?"
        value={name}
        onChangeText={setName}
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
