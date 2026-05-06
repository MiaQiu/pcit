import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';
import amplitudeService from '../../services/amplitudeService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const Demo1BScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  useEffect(() => { amplitudeService.trackOnboardingScreen('demo1b', 5); }, []);

  return (
    <DemoTemplate
      text={t('onboarding.demo1B.text')}
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Demo1')}
      onNext={() => { amplitudeService.trackOnboardingStepCompleted('demo1b', 5); navigation.navigate('Demo2'); }}
    >
      <View style={styles.imageContainer}>
        <Image
          source={require('../../../assets/images/demo1B_clean.png')}
          style={styles.image}
          resizeMode="contain"
        />
        <View style={styles.labelRow}>
          <View style={styles.labelCell}>
            <Text style={styles.cardLabel}>{t('onboarding.demo1B.labels.therapeuticPlay')}</Text>
          </View>
          <View style={styles.labelCell}>
            <Text style={styles.cardLabel}>{t('onboarding.demo1B.labels.settingBoundaries')}</Text>
          </View>
          <View style={styles.labelCell}>
            <Text style={styles.cardLabel}>{t('onboarding.demo1B.labels.manageEmotions')}</Text>
          </View>
        </View>
      </View>
    </DemoTemplate>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 2.3,
    marginTop: 120,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  labelRow: {
    position: 'absolute',
    bottom: '10%',
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  labelCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  cardLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 15,
  },
});
