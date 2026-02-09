/**
 * Focus Areas Screen
 * "Target" - Shows personalized focus areas before PreIntroReassurance
 */

import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { IntroScreenTemplate } from './IntroScreenTemplate';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { evaluateFocusAreas } from '../../utils/focusAreas';

export const FocusAreasScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const focusAreas = useMemo(
    () => evaluateFocusAreas(data.issue, data.wacb),
    [data.issue, data.wacb]
  );

  return (
    <IntroScreenTemplate
      header={<OnboardingProgressHeader phase={3} step={1} totalSteps={3} />}
      subtitle="Target"
      title="Your Focus Areas"
      description={
        <Text style={styles.description}>
          {focusAreas.map((area) => `  •  ${area}`).join('\n')}
          {'\n\n'}These are the first areas we'll focus on together
        </Text>
      }
      buttonText="Continue  →"
      onNext={() => navigation.navigate('GuidanceIntro')}
    />
  );
};

const styles = StyleSheet.create({
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 28,
  },
});
