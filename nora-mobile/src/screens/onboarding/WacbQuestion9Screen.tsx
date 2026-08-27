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

  const handleSubmitSurvey = async (selectedValue: number, _updateData: any, navigation: any) => {
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

    // Skip the onboarding-era ChildBehaviorProfile/Intro3 continuation. This
    // flow is now reached standalone from ReportDetailScreen's "unlock" card,
    // not just during first-time onboarding — when it carries the originating
    // session's recordingId, return to that session's ProfileReportScreen;
    // otherwise fall back to the account Profile screen. Both live on the root
    // stack, outside this nested Onboarding navigator, so use the parent.
    const parent = navigation.getParent();
    if (data.wacbReturnRecordingId) {
      parent?.navigate('ProfileReport', { recordingId: data.wacbReturnRecordingId, justCompletedWacb: true });
    } else {
      parent?.navigate('Profile');
    }
    return false;
  };

  return (
    <MultipleChoiceScreen
      {...getWacbQuestions(childName, t)[8]}
      onBeforeNavigate={handleSubmitSurvey}
      disableAutoNavigate={true}
    />
  );
};
