import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { OnboardingBackButton } from '../../components/OnboardingBackButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH - 40;

const PolaroidLabel: React.FC<{ text: string; top: string; rotate: string }> = ({ text, top, rotate }) => (
  <View style={[labelStyles.row, { top }]}>
    <Text style={[labelStyles.text, { transform: [{ rotate }] }]}>{text}</Text>
  </View>
);

const labelStyles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  text: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#1F2937',
    letterSpacing: 0.3,
  },
});

export const PlaySession2Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{t('onboarding.playSession2.title')}</Text>
      </View>

      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>{t('onboarding.playSession2.subtitle')}</Text>
      </View>

      <View style={styles.imageOuter}>
        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/images/play2_clean.png')}
            style={styles.image}
            resizeMode="contain"
          />
          <PolaroidLabel
            text={t('onboarding.playSession2.labels.childLedPlay')}
            top="78%"
            rotate="-2deg"
          />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <OnboardingBackButton onPress={() => navigation.goBack()} />
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('PlaySession3')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{t('onboarding.continue')}</Text>
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
  titleContainer: {
    paddingHorizontal: 28,
    paddingTop: 64,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1F2937',
    lineHeight: 34,
    textAlign: 'center',
    width: '100%',
  },
  subtitleContainer: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    textAlign: 'center',
    width: '100%',
  },
  imageOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  button: {
    flex: 1,
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
