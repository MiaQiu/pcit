/**
 * Name Input Screen
 * User enters their name
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OnboardingLayout } from '../../components/OnboardingLayout';
import { OnboardingTextInput } from '../../components/OnboardingTextInput';
import { OnboardingFooter } from '../../components/OnboardingFooter';
import amplitudeService from '../../services/amplitudeService';
import { useAuthService } from '../../contexts/AppContext';
import { saveOnboardingFields } from '../../utils/onboardingDraft';
import { goBackTo } from '../../navigation/goBackTo';

export const NameInputScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();
  const { t } = useTranslation();
  const authService = useAuthService();
  const [name, setName] = useState(data.name);

  useEffect(() => { amplitudeService.trackOnboardingScreen('name_input', 12); }, []);

  const handleContinue = () => {
    if (name.trim()) {
      updateData({ name: name.trim() });
      amplitudeService.trackOnboardingStepCompleted('name_input', 12);
      saveOnboardingFields(authService, { name: name.trim() });
      navigation.navigate('Relationship');
    }
  };

  const isValid = name.trim().length > 0;

  return (
    <OnboardingLayout useKeyboardAvoid>
      <OnboardingTextInput
        title={t('onboarding.nameInput.title')}
        value={name}
        onChangeText={setName}
        onSubmitEditing={handleContinue}
      />

      <View style={styles.spacer} />

      <OnboardingFooter
        parentPadding={20}
        onBack={() => goBackTo(navigation, 'OB2V2')}
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
