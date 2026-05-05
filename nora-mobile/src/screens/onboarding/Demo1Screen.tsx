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

        {/* Image */}
        <View style={styles.imageContainer}>
          <View style={styles.cylinderContainer}>
            <Image
              source={require('../../../assets/images/demo1.png')}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
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
    marginTop:32
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 18,
    marginTop:18
  },
  imageContainer: {
    width: SCREEN_WIDTH - 48,
    aspectRatio: 1.2,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cylinderContainer: {
    width: '95%',
    aspectRatio: 1.6,
    backgroundColor: '#EAF6F0',
    borderRadius: 9999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    alignSelf:'center'
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
