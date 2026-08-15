/**
 * OB Letter Content Screen
 * Shown after OBLetter (the "tap to open" envelope), before ChildSnapshotIntro.
 * TEMP: navigates to OBPlay1V2 (not OBPlay1) to preview the v2 onboarding
 * chain end-to-end. Revert to 'OBPlay1' once the v2 review is done.
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
import { hasAdhdOrDevelopmentalConcern } from '../../utils/onboardingBranch';
import amplitudeService from '../../services/amplitudeService';

export const OBLetterContentScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const userName = data.name || 'there';
  const childName = data.childName || 'your child';
  const isAltBranch = hasAdhdOrDevelopmentalConcern(data.issue);

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_letter_content', 21); }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {isAltBranch ? (
          <>
            <Text style={styles.title}>
              {t('onboarding.obLetterContent.hi')}
              <Text style={styles.highlight}>{userName}</Text>
              {t('onboarding.obLetterContent.comma')}
              {'\n'}
              {t('onboarding.obLetterContent.thankYouAlt')}
            </Text>
            <Text style={styles.subtitle}>
              {t('onboarding.obLetterContent.subtitleAltPre')}
              <Text style={styles.highlightRegular}>
                {childName}
                {t('onboarding.obLetterContent.subtitleAltHighlight')}
              </Text>
              {t('onboarding.obLetterContent.subtitleAltPost')}
            </Text>
          </>
        ) : (
          <Text style={styles.title}>
            {t('onboarding.obLetterContent.hi')}
            <Text style={styles.highlight}>{userName}</Text>
            {t('onboarding.obLetterContent.comma')}
            {'\n'}
            {t('onboarding.obLetterContent.thankYou')}
            <Text style={styles.highlight}>{childName}</Text>
            {t('onboarding.obLetterContent.period')}
          </Text>
        )}

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
            navigation.navigate('OBPlay1V2');
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
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 20,
    color: '#6B7280',
    lineHeight: 26,
    marginTop: 8,
  },
  highlightRegular: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
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
