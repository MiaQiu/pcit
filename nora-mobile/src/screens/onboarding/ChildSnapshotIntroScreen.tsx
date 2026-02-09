/**
 * Child Snapshot Intro Screen
 * "Getting to know your child" - Shown after ChildIssue, before InitialReassurance
 */

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { IntroScreenTemplate } from './IntroScreenTemplate';

export const ChildSnapshotIntroScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <IntroScreenTemplate
      currentSegment={1}
      totalSegments={1}
      subtitle="Getting to know your child"
      title="A quick snapshot of your child"
      description="There are no right or wrong answers. This helps Nora understand what your child may be learning right now, so insights are tailored to your child — not generic advice."
      buttonText="Let's go!  →"
      onNext={() => navigation.navigate('WacbQuestion1')}
    />
  );
};
