import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';

export const Demo4Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  return (
    <DemoTemplate
      text={t('onboarding.demo4.text')}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate('Demo5')}
    >
      <View style={styles.imageContainer}>
        <Image
          source={require('../../../assets/images/demo4.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    </DemoTemplate>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    width: '120%',
    flex: 1,
    alignSelf: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    marginTop:40,
  },
});
