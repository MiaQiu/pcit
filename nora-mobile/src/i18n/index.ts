import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import zhTW from './locales/zh-TW.json';
import zhCN from './locales/zh-CN.json';

export const LANGUAGE_KEY = '@nora_language';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-TW': { translation: zhTW },
      'zh-CN': { translation: zhCN },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

function detectDeviceLanguage(): string {
  const locales = getLocales();
  const primary = locales[0]?.languageTag ?? '';
  // Match zh-TW, zh-Hant, zh-Hant-TW, etc.
  if (primary.startsWith('zh-TW') || primary.startsWith('zh-Hant')) {
    return 'zh-TW';
  }
  // Match zh-CN, zh-Hans, zh-Hans-CN, zh-SG, etc.
  if (primary.startsWith('zh-CN') || primary.startsWith('zh-Hans') || primary.startsWith('zh-SG')) {
    return 'zh-CN';
  }
  return 'en';
}

export async function loadSavedLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    const lang = saved ?? detectDeviceLanguage();
    if (lang !== i18n.language) {
      await i18n.changeLanguage(lang);
    }
  } catch {
    // Non-critical — default language remains
  }
}

export async function changeLanguage(lang: string): Promise<void> {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

export default i18n;
