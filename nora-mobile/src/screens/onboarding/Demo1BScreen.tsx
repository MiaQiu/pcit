import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';

export const Demo1BScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <DemoTemplate
      text="Get simple strategies that actually work."
      onBack={() => navigation.navigate('Demo1')}
      onNext={() => navigation.navigate('Demo2')}
    >
      <View style={styles.imageContainer}>
        <Image
          source={require('../../../assets/images/demo1B.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    </DemoTemplate>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop:120
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
