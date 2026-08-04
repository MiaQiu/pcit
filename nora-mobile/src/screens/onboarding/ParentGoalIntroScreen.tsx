/**
 * Parent Goal Intro Screen
 * Shown after ParentGoal, before ChildSnapshotIntro.
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import amplitudeService from '../../services/amplitudeService';

export const ParentGoalIntroScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const userName = data.name || 'there';

  useEffect(() => { amplitudeService.trackOnboardingScreen('parent_goal_intro', 19); }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {t('onboarding.parentGoalIntro.hi')}
          <Text style={styles.highlight}>{userName}</Text>
          {t('onboarding.parentGoalIntro.comma')}
          {'\n'}
          {t('onboarding.parentGoalIntro.youreInThe')}
          <Text style={styles.highlight}>{t('onboarding.parentGoalIntro.rightPlace')}</Text>
        </Text>

        <Text style={styles.paragraph}>{t('onboarding.parentGoalIntro.paragraph1')}</Text>

        <Text style={styles.paragraph}>
          {t('onboarding.parentGoalIntro.paragraph2Pre')}
          <Text style={styles.highlightRegular}>{t('onboarding.parentGoalIntro.paragraph2Highlight')}</Text>
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: useSafeAreaInsets().bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            amplitudeService.trackOnboardingStepCompleted('parent_goal_intro', 19);
            navigation.navigate('OBLetter');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{t('onboarding.parentGoalIntro.discoverButton')}</Text>
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
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    lineHeight: 34,
    marginBottom: 24,
  },
  highlight: {
    color: '#8C49D5',
  },
  paragraph: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
    marginBottom: 16,
  },
  highlightRegular: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#8C49D5',
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
