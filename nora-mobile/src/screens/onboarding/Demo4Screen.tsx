import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';

export const Demo4Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <DemoTemplate
      text="Help your child thrive. Build on their strengths and support their emotional and social growth."
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
