import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';

export const Demo2Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  return (
    <DemoTemplate
      text={t('onboarding.demo2.text')}
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Demo1B')}
      onNext={() => navigation.navigate('Demo2B')}
    >
      <View style={styles.imageContainer}>
        <Image
          source={require('../../../assets/images/demo2.png')}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
    </DemoTemplate>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    height: 250,
    width: 350,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop:150,
    alignSelf:'center'
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
