import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';
import amplitudeService from '../../services/amplitudeService';

const CoachingCard: React.FC<{ label: string; body: string; shift?: boolean }> = ({ label, body, shift = false }) => (
  <View style={[card.wrapper, shift && card.shifted]}>
    <LinearGradient
      colors={['#B8D4F5', '#C8C0F0', '#D8E8FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={card.border}
    >
      <View style={card.inner}>
        <Text style={card.text}>
          <Text style={card.label}>{label}: </Text>
          {body}
        </Text>
      </View>
    </LinearGradient>
  </View>
); 

export const Demo3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  useEffect(() => { amplitudeService.trackOnboardingScreen('demo3', 8); }, []);

  return (
    <DemoTemplate
      text={t('onboarding.demo3.text')}
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Demo2B')}
      onNext={() => { amplitudeService.trackOnboardingStepCompleted('demo3', 8); navigation.navigate('Demo4'); }}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#B8D4F5', '#C8C0F0', '#D8E8FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.outerBorder}
        >
          <View style={styles.innerBox}>
            <Text style={styles.title}>{t('onboarding.demo3.title')}</Text>
            <CoachingCard
              label={t('onboarding.demo3.card1Label')}
              body={t('onboarding.demo3.card1Body')}
            />
            <CoachingCard
              label={t('onboarding.demo3.card2Label')}
              body={t('onboarding.demo3.card2Body')}
              shift
            />
          </View>
        </LinearGradient>
      </View>
    </DemoTemplate>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 24,
    marginTop: 50,
    marginBottom: 50,
   
  },
  outerBorder: {
    borderRadius: 24,
    padding: 6,
  },
  innerBox: {
    backgroundColor: '#FAFBFF',
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#6B3FA0',
    textAlign: 'center',
    marginBottom: 4,
  },
});

const card = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    width: '94%',
  },
  shifted: {
    alignSelf: 'flex-end',
  },
  border: {
    borderRadius: 14,
    padding: 2,
  },
  inner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  label: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#1F2937',
  },
  text: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },
});
