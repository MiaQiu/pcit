/**
 * Parenting Intro Screen
 * "Parenting is complex" - Shown after account creation
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { IntroScreenTemplate } from './IntroScreenTemplate';

export const ParentingIntroScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <IntroScreenTemplate
      subtitle="Parenting is complex"
      title="Nora helps you see more clearly."
      onBack={() => navigation.goBack()}
      description={
        <Text style={styles.description}>
          Parenting a 2–7 year old is intense — even on good days. Big emotions,
          testing limits, sudden meltdowns —{' '}
          <Text style={styles.bold}>
            this is how young children grow.
          </Text>{' '}
          Most challenges aren't about bad behavior. They're about skills your
          child is still developing.
        </Text>
      }
      buttonText="Let's go!  →"
      onNext={() => navigation.navigate('NameInput')}
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
  bold: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
