import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';

const IOS_STORE_URL = process.env.EXPO_PUBLIC_IOS_STORE_URL || '';
const ANDROID_STORE_URL = process.env.EXPO_PUBLIC_ANDROID_STORE_URL || '';

export const ForceUpdateScreen: React.FC = () => {
  const { t } = useTranslation();

  useEffect(() => {
    amplitudeService.trackScreenView('Force Update');
  }, []);

  const handleUpdate = () => {
    amplitudeService.trackEvent('Force Update Button Pressed', { platform: Platform.OS });
    const url = Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
    if (url) {
      Linking.openURL(url);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/splash_icon_dino_small.png')} style={styles.dragon} />
      <Text style={styles.title}>{t('forceUpdate.title')}</Text>
      <Text style={styles.message}>{t('forceUpdate.message')}</Text>
      <TouchableOpacity style={styles.button} onPress={handleUpdate}>
        <Text style={styles.buttonText}>{t('forceUpdate.updateButton')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40,
  },
  dragon: {
    width: 660,
    height: 660,
    resizeMode: 'contain',
    marginBottom: -200,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#8C49D5',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
