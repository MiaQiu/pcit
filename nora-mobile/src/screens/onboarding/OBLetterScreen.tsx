import React, { useEffect } from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const OBLetterScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const insets = useSafeAreaInsets();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_letter', 20); }, []);

  const handleOpen = () => {
    amplitudeService.trackOnboardingStepCompleted('ob_letter', 20);
    navigation.navigate('OBLetterContent');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={styles.content} onPress={handleOpen} activeOpacity={0.85}>
        <Image
          source={require('../../../assets/images/new onboarding/OB-letter.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH - 48,
    height: SCREEN_WIDTH - 48,
  },
});
