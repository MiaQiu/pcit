/**
 * Child Name Screen
 * User enters their child's name
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OnboardingLayout } from '../../components/OnboardingLayout';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';
import { OnboardingTextInput } from '../../components/OnboardingTextInput';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';
import amplitudeService from '../../services/amplitudeService';
import { useAuthService } from '../../contexts/AppContext';

export const ChildNameScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();
  const { t } = useTranslation();
  const authService = useAuthService();
  const [childName, setChildName] = useState(data.childName);

  useEffect(() => { amplitudeService.trackOnboardingScreen('child_name', 14); }, []);

  const handleContinue = () => {
    if (childName.trim()) {
      updateData({ childName: childName.trim() });
      amplitudeService.trackOnboardingStepCompleted('child_name', 14);
      authService.completeOnboarding({ childName: childName.trim() }).catch(() => {});
      navigation.navigate('ChildGender');
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Relationship');
    }
  };

  const isValid = childName.trim().length > 0;

  return (
    <OnboardingLayout useKeyboardAvoid>
      <OnboardingProgressHeader phase={1} step={3} totalSteps={6} />

      <OnboardingTextInput
        title={t('onboarding.childName.title')}
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
