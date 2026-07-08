/**
 * Name Input Screen
 * User enters their name
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OnboardingLayout } from '../../components/OnboardingLayout';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';
import { OnboardingTextInput } from '../../components/OnboardingTextInput';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';
import amplitudeService from '../../services/amplitudeService';
import { useAuthService } from '../../contexts/AppContext';

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
      authService.completeOnboarding({ name: name.trim() }).catch(() => {});
      navigation.navigate('Relationship');
    }
  };

  const isValid = name.trim().length > 0;

  // TEMPORARY — dev-only escape hatch so testers stuck mid-onboarding (e.g. accounts created
  // via web signup) can log out without reinstalling the app. Remove before shipping.
  const handleDevLogout = async () => {
    try {
      await authService.logout();
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Welcome' }] }));
    } catch (error) {
      console.error('Dev logout error:', error);
    }
  };

  return (
    <OnboardingLayout useKeyboardAvoid>
      <OnboardingProgressHeader phase={1} step={1} totalSteps={6} />

      <TouchableOpacity onPress={handleDevLogout} style={styles.devLogoutButton}>
        <Text style={styles.devLogoutText}>[DEV] Log out</Text>
      </TouchableOpacity>

      <OnboardingTextInput
        title={t('onboarding.nameInput.title')}
        value={name}
        onChangeText={setName}
        onSubmitEditing={handleContinue}
      />

      <View style={styles.spacer} />

      <OnboardingButtonRow
        onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('ParentingIntro')}
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
  // TEMPORARY — remove alongside handleDevLogout above.
  devLogoutButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  devLogoutText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
