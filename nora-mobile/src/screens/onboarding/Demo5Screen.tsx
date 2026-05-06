import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';
import amplitudeService from '../../services/amplitudeService';

export const Demo5Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  useEffect(() => { amplitudeService.trackOnboardingScreen('demo5', 10); }, []);

  return (
    <DemoTemplate
      text={t('onboarding.demo5.text')}
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Demo4')}
      onNext={() => { amplitudeService.trackOnboardingStepCompleted('demo5', 10); navigation.navigate('ParentingIntro'); }}
    >
      <View style={styles.imageContainer}>
        <Image
          source={require('../../../assets/images/demo5.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    </DemoTemplate>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    width: '80%',
    flex: 1,
    alignSelf:'center',
    marginTop:50
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
