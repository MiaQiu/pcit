/**
 * OB Letter Content Screen
 * Shown after OBLetter (the "tap to open" envelope), before ChildSnapshotIntro.
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import amplitudeService from '../../services/amplitudeService';

export const OBLetterContentScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const userName = data.name || 'there';
  const childName = data.childName || 'your child';

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_letter_content', 21); }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {t('onboarding.obLetterContent.hi')}
          <Text style={styles.highlight}>{userName}</Text>
          {t('onboarding.obLetterContent.comma')}
          {'\n'}
          {t('onboarding.obLetterContent.thankYou')}
          <Text style={styles.highlight}>{childName}</Text>
          {t('onboarding.obLetterContent.period')}
        </Text>

        <Image
          source={require('../../../assets/images/new onboarding/heart.png')}
          style={styles.heart}
          resizeMode="contain"
        />
      </View>

      <View style={[styles.footer, { paddingBottom: useSafeAreaInsets().bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            amplitudeService.trackOnboardingStepCompleted('ob_letter_content', 21);
            navigation.navigate('OBPlay1');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{t('onboarding.obLetterContent.continueButton')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1F2937',
    lineHeight: 32,
  },
  highlight: {
    color: '#8C49D5',
  },
  heart: {
    width: 70,
    height: 70,
    alignSelf: 'flex-end',
    marginRight:40,
    marginTop: 24,
    
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});
