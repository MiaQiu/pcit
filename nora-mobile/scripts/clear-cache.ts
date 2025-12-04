/**
 * Clear Lesson Cache Script
 * Run this to clear all cached lesson data from AsyncStorage
 * Useful when cache gets corrupted or you need a fresh start
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const lessonCacheKeys = keys.filter(
      key => key.startsWith('@nora_lesson_cache:') || key.startsWith('@nora_lesson_cache_time:')
    );

    if (lessonCacheKeys.length > 0) {
      await AsyncStorage.multiRemove(lessonCacheKeys);
      console.log('✅ Cleared', lessonCacheKeys.length / 2, 'cached lessons');
    } else {
      console.log('ℹ️ No cached lessons found');
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

clearCache();
