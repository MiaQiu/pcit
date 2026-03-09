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
      title="But you don’t have to figure it out alone."
      description={
        <Text style={styles.description}>
    
          In <Text style={styles.bold}>just 5 minutes a day</Text>, Nora listens to real moments between you and
           your child and gives <Text style={styles.bold}>personalized coaching grounded in child development 
           science</Text> — helping you build emotional, social, and self-control skills one 
           small interaction at a time.
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
