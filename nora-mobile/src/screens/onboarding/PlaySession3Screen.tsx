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
import { useOnboarding } from '../../contexts/OnboardingContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_W = SCREEN_WIDTH - 40;
const IMAGE_H = IMAGE_W * (1692 / 1331);

export const PlaySession3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data } = useOnboarding();
  const childName = data.childName || 'K';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{t('onboarding.playSession3.title')}</Text>
      </View>
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>{t('onboarding.playSession3.subtitle')}</Text>
      </View>

      <View style={styles.imageOuter}>
        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/images/play3_clean.png')}
            style={styles.image}
            resizeMode="contain"
          />
          <Text style={[styles.cardLabel, { position: 'absolute', top: '53%', left: '35%' }]}>
            {t('onboarding.playSession3.cardLabel')}
          </Text>
          <Text style={[styles.cardContent, { position: 'absolute', top: '56%', left: '31%', width: '40%' }]}>
            {t('onboarding.playSession3.cardContent', { name: childName })}
          </Text>
          <Text style={[styles.cardButton, { position: 'absolute', top: '64%', left: '12%', right: '12%' }]}>
            {t('onboarding.playSession3.cardButton')}
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <OnboardingBackButton onPress={() => navigation.goBack()} />
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('PlaySession4')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{t('onboarding.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  titleContainer: { paddingHorizontal: 28, paddingTop: 64, alignItems: 'center' },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1F2937',
    lineHeight: 34,
    textAlign: 'center',
    width: '100%',
  },
  subtitleContainer: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 8, alignItems: 'center' },
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
    width: IMAGE_W,
    height: IMAGE_H,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cardLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 9,
    color: '#1F2937',
  },
  cardContent: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 6,
    color: '#374151',
    lineHeight: 10,
  },
  cardButton: {
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  button: {
    flex: 1,
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18, color: '#FFFFFF' },
});
