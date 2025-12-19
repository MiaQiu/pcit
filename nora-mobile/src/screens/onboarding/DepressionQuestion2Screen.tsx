/**
 * Depression Survey Question 2 Screen (PHQ-2)
 * Question: Feeling down, depressed, or hopeless?
 * Submits both answers and navigates based on score
 */

import React from 'react';
import { Alert } from 'react-native';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { useAuthService } from '../../contexts/AppContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { getOnboardingProgress } from '../../config/onboardingProgress';

const OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

export const DepressionQuestion2Screen: React.FC = () => {
  const authService = useAuthService();
  const { data } = useOnboarding();

  const handleSubmitSurvey = async (selectedValue: number, updateData: any, navigation: any) => {
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
      const q1Interest = data.phq2?.q1Interest || 0;
      const q2Depressed = selectedValue;
      const totalScore = q1Interest + q2Depressed;

      console.log('Submitting PHQ-2 survey:', { q1Interest, q2Depressed, totalScore });

      const response = await authService.authenticatedRequest(
        `${API_URL}/api/phq2-survey`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q1Interest,
            q2Depressed,
            totalScore,
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('PHQ-2 submission error:', errorData);
        throw new Error(errorData.error || 'Failed to submit survey');
      }

      console.log('PHQ-2 submitted successfully, totalScore:', totalScore);

      // Navigate based on score
      if (totalScore >= 3) {
        navigation.navigate('SelfCare');
      } else {
        navigation.navigate('PreIntroReassurance');
      }

      // Prevent default navigation by throwing (but after we've navigated)
      throw new Error('Navigation handled');
    } catch (err: any) {
      if (err.message === 'Navigation handled') {
        // Expected - we handled navigation ourselves
        throw err;
      }

      console.error('PHQ-2 Survey submission error:', err);
      Alert.alert(
        'Submission Error',
        'Failed to submit survey. You can continue and complete it later from your profile.'
      );
      // Continue anyway on error
      navigation.navigate('PreIntroReassurance');
      throw err; // Prevent default navigation
    }
  };

  return (
    <MultipleChoiceScreen
      headerText="Your answers are private and used only to personalize your experience."
      title="Over the last 2 weeks, how often have you been bothered by: Feeling down, depressed, or hopeless?"
      options={OPTIONS}
      dataField="phq2.q2Depressed"
      nextScreen="PreIntroReassurance" // This will be overridden by onBeforeNavigate
      onBeforeNavigate={handleSubmitSurvey}
      continueText="Submit"
      progress={getOnboardingProgress('DepressionQuestion2')}
    />
  );
};
