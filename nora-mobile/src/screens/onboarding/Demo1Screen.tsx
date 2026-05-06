import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH - 48;

// A single floating label: dot + text, absolutely positioned
// A single floating label: dot + text, absolutely positioned
const Label: React.FC<{ text: string; style: object; align?: 'left' | 'right' }> = ({
  text,
  style,
  align = 'left',
}) => (
  <View style={[labelStyles.wrapper, align === 'right' && labelStyles.wrapperRight, style]}>
    {align === 'right' && <Text style={labelStyles.text}>{text}</Text>}
    <View style={labelStyles.dot} />
    {align === 'left' && <Text style={labelStyles.text}>{text}</Text>}
  </View>
);

const labelStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  wrapperRight: {
    flexDirection: 'row-reverse',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#8C49D5',
  },
  text: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#1F2937',
    maxWidth: 110,
    lineHeight: 15,
  },
});

export const Demo1Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subtitle */}
        <Text style={styles.subtitle}>{t('onboarding.demo1.subtitle')}</Text>

        {/* Title */}
        <Text style={styles.title}>{t('onboarding.demo1.title')}</Text>

        {/* Image with floating labels */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/images/demo1_clean.png')}
            style={styles.image}
            resizeMode="contain"
          />

          {/* Top */}
          <Label text={t('onboarding.demo1.labels.childDevelopment')} style={{ top: '22%', left: '40%' }} />
          {/* Upper-right */}
          <Label text={t('onboarding.demo1.labels.attachmentScience')}  style={{ top: '29%', left: '62%' }} align="right" />
          {/* Upper-left */}
          <Label text={t('onboarding.demo1.labels.speechTherapy')}      style={{ top: '29%', left: '24%' }} />
          {/* Right */}
          <Label text={t('onboarding.demo1.labels.socialLearning')}     style={{ top: '38%', left: '72%' }} align="right" />
          {/* Lower-right */}
          <Label text={t('onboarding.demo1.labels.behaviorManagement')} style={{ top: '47%', left: '82%' }} align="right" />
          {/* Left */}
          <Label text={t('onboarding.demo1.labels.playTherapy')}        style={{ top: '38%', left: '13%' }} />
          {/* Lower-left */}
          <Label text={t('onboarding.demo1.labels.authoritativeParenting')} style={{ top: '47%', left: '2%' }} />
        </View>

        {/* Meet Nora */}
        <Text style={styles.meetTitle}>{t('onboarding.demo1.meetNora')}</Text>
        <Text style={styles.description}>{t('onboarding.demo1.description')}</Text>
      </ScrollView>

      {/* Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Demo1B')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{t('onboarding.letsGo')}</Text>
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
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 16,
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#8C49D5',
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 32,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 18,
    marginTop: 18,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    aspectRatio: 1,
    marginBottom: 24,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  meetTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 26,
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
