/**
 * WACB Question 9 Screen
 */

import React from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { getWacbQuestions } from './wacbQuestions.config';
import { useAuthService } from '../../contexts/AppContext';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const WacbQuestion9Screen: React.FC = () => {
  const authService = useAuthService();
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const childName = data.childName || 'your child';

  const handleSubmitSurvey = async (selectedValue: number) => {
    // Submit all WACB data to the backend
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
      const wacbData = {
        ...data.wacb,
        q9Attention: selectedValue,
        parentingStressLevel: data.wacb?.parentingStressLevel || 1, // Default value if not provided
      };

      console.log('Submitting WACB survey to:', `${API_URL}/api/wacb-survey`);

      const response = await authService.authenticatedRequest(
        `${API_URL}/api/wacb-survey`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(wacbData),
        }
      );

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Survey submission error:', errorData);
        throw new Error(errorData.error || 'Failed to submit survey');
      }

      const result = await response.json();
      console.log('Survey submitted successfully:', result);
    } catch (err: any) {
      console.error('WACB Survey submission error:', err);
      Alert.alert(
        t('onboarding.wacb.submissionError'),
        err.message || t('onboarding.wacb.submissionFailed')
      );
      // Re-throw to prevent navigation
      throw err;
    }
  };

  return (
    <MultipleChoiceScreen
      {...getWacbQuestions(childName, t)[8]}
      onBeforeNavigate={handleSubmitSurvey}
      disableAutoNavigate={true}
    />
  );
};
