/**
 * Lesson Cache Utility
 * Caches the next 2 unlocked lessons for instant loading
 * Uses AsyncStorage for persistence across app restarts
 *
 * Cache Strategy:
 * - Caches 2 unlocked lessons (current + next)
 * - Keeps completed lessons until next app open
 * - Auto-cleans completed lessons on app startup
 * - No time-based expiration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LessonDetailResponse } from '@nora/core';

const CACHE_PREFIX = '@nora_lesson_cache:';
const CACHE_TIMESTAMP_PREFIX = '@nora_lesson_cache_time:';
const LESSONS_LIST_CACHE_KEY = '@nora_lessons_list_cache';

export class LessonCache {
  /**
   * Get cached lesson detail
   * @param lessonId Lesson ID
   * @returns Cached lesson data or null if not found
   */
  static async get(lessonId: string): Promise<LessonDetailResponse | null> {
    try {
      const cacheKey = `${CACHE_PREFIX}${lessonId}`;

      const cachedData = await AsyncStorage.getItem(cacheKey);

      if (!cachedData) {
        return null;
      }

      console.log('Cache hit for lesson:', lessonId);
      return JSON.parse(cachedData);
    } catch (error) {
      console.error('Error reading lesson cache:', error);
      return null;
    }
  }

  /**
   * Cache lesson detail
   * @param lessonId Lesson ID
   * @param data Lesson detail data
   */
  static async set(lessonId: string, data: LessonDetailResponse): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${lessonId}`;
      const timestampKey = `${CACHE_TIMESTAMP_PREFIX}${lessonId}`;

      await Promise.all([
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)),
        AsyncStorage.setItem(timestampKey, Date.now().toString()),
      ]);

      console.log('Cached lesson:', lessonId);
    } catch (error) {
      console.error('Error caching lesson:', error);
    }
  }

  /**
   * Remove cached lesson
   * @param lessonId Lesson ID
   */
  static async remove(lessonId: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${lessonId}`;
      const timestampKey = `${CACHE_TIMESTAMP_PREFIX}${lessonId}`;

      await Promise.all([
        AsyncStorage.removeItem(cacheKey),
        AsyncStorage.removeItem(timestampKey),
      ]);

      console.log('Removed cached lesson:', lessonId);
    } catch (error) {
      console.error('Error removing lesson cache:', error);
    }
  }

  /**
   * Clear all cached lessons
   */
  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const lessonCacheKeys = keys.filter(
        key => key.startsWith(CACHE_PREFIX) || key.startsWith(CACHE_TIMESTAMP_PREFIX)
      );

      if (lessonCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(lessonCacheKeys);
        console.log('Cleared all lesson caches');
      }
    } catch (error) {
      console.error('Error clearing lesson cache:', error);
    }
  }

  /**
   * Cache multiple lessons at once
   * @param lessons Array of lesson IDs and their data
   */
  static async setMultiple(lessons: Array<{ id: string; data: LessonDetailResponse }>): Promise<void> {
    try {
      const entries: Array<[string, string]> = [];
      const now = Date.now().toString();

      lessons.forEach(({ id, data }) => {
        entries.push([`${CACHE_PREFIX}${id}`, JSON.stringify(data)]);
        entries.push([`${CACHE_TIMESTAMP_PREFIX}${id}`, now]);
      });

      await AsyncStorage.multiSet(entries);
      console.log('Cached multiple lessons:', lessons.map(l => l.id));
    } catch (error) {
      console.error('Error caching multiple lessons:', error);
    }
  }

  /**
   * Clean up completed lessons from cache
   * Removes cache for lessons with status COMPLETED
   * Called on app startup to keep cache fresh
   */
  static async cleanupCompletedLessons(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));

      const completedLessonIds: string[] = [];

      // Check each cached lesson's completion status
      for (const cacheKey of cacheKeys) {
        try {
          const cachedData = await AsyncStorage.getItem(cacheKey);
          if (!cachedData) continue;

          const lessonData: LessonDetailResponse = JSON.parse(cachedData);

          // If lesson is completed, mark for removal
          if (lessonData.userProgress?.status === 'COMPLETED') {
            const lessonId = cacheKey.replace(CACHE_PREFIX, '');
            completedLessonIds.push(lessonId);
          }
        } catch (parseError) {
          console.error('Error parsing cached lesson:', parseError);
        }
      }

      // Remove completed lessons from cache
      if (completedLessonIds.length > 0) {
        const keysToRemove: string[] = [];
        completedLessonIds.forEach(id => {
          keysToRemove.push(`${CACHE_PREFIX}${id}`);
          keysToRemove.push(`${CACHE_TIMESTAMP_PREFIX}${id}`);
        });

        await AsyncStorage.multiRemove(keysToRemove);
        console.log('Cleaned up completed lessons from cache:', completedLessonIds);
      } else {
        console.log('No completed lessons to clean up');
      }
    } catch (error) {
      console.error('Error cleaning up completed lessons:', error);
    }
  }

  /**
   * Cache lessons list (for home screen)
   * @param lessons Array of lesson card data
   */
  static async setLessonsList(lessons: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(LESSONS_LIST_CACHE_KEY, JSON.stringify(lessons));
      console.log('📦 Cached lessons list:', lessons.length, 'lessons');
    } catch (error) {
      console.error('Error caching lessons list:', error);
    }
  }

  /**
   * Get cached lessons list
   * @returns Cached lessons list or null
   */
  static async getLessonsList(): Promise<any[] | null> {
    try {
      const cachedData = await AsyncStorage.getItem(LESSONS_LIST_CACHE_KEY);
      if (!cachedData) {
        return null;
      }
      console.log('✅ Lessons list cache hit');
      return JSON.parse(cachedData);
    } catch (error) {
      console.error('Error reading lessons list cache:', error);
      return null;
    }
  }

  /**
   * Remove cached lessons list
   */
  static async removeLessonsList(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LESSONS_LIST_CACHE_KEY);
      console.log('🗑️ Removed lessons list cache');
    } catch (error) {
      console.error('Error removing lessons list cache:', error);
    }
  }
}
