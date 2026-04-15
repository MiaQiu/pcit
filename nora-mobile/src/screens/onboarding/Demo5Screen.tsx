import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';

export const Demo5Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <DemoTemplate
      text={`Empowering every caregiver,\nin 90+ languages.`}
      onBack={() => navigation.navigate('Demo4')}
      onNext={() => navigation.navigate('ParentingIntro')}
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
