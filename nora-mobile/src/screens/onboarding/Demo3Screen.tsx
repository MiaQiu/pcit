import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';

export const Demo3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <DemoTemplate
      text="Personalized coaching based on your real moments, grounded in child development science."
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate('Demo4')}
    >
      <View style={styles.imageContainer}>
        <Image
          source={require('../../../assets/images/demo3.jpg')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    </DemoTemplate>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    width: '95%',
    flex: 1,
    alignSelf: 'center',
    marginTop:50
  },
  image: {
    width: '100%',
    height: '100%',

  },
});
