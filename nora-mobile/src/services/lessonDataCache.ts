import * as userStorage from '../lib/userStorage';
import type { ModuleListResponse, LessonListResponse, LessonService } from '@nora/core';
import { resolveImageUris } from './lessonImageCache';

const CACHE_KEY = 'lesson_data_cache_v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface LessonDataCache {
  modulesRes: ModuleListResponse;
  lessonsRes: LessonListResponse;
  cachedAt: number;
  locale: string;
}

export async function getCachedLessonData(locale: string): Promise<LessonDataCache | null> {
  try {
    const raw = await userStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LessonDataCache;
    if (data.locale !== locale) return null;
    return data;
  } catch {
    return null;
  }
}

export function isCacheStale(cachedAt: number): boolean {
  return Date.now() - cachedAt > MAX_AGE_MS;
}

export async function saveLessonData(
  locale: string,
  modulesRes: ModuleListResponse,
  lessonsRes: LessonListResponse
): Promise<void> {
  try {
    const data: LessonDataCache = { modulesRes, lessonsRes, cachedAt: Date.now(), locale };
    await userStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[lessonDataCache] save failed:', err);
  }
}

export async function invalidateLessonCache(): Promise<void> {
  try {
    await userStorage.removeItem(CACHE_KEY);
  } catch {}
}

/**
 * Fire-and-forget prefetch: fetches lesson data and downloads all images to disk.
 * Safe to call without awaiting. Skips if a fresh cache already exists.
 */
export function prefetchLessons(lessonService: LessonService, locale: string): void {
  (async () => {
    try {
      const existing = await getCachedLessonData(locale);
      if (existing && !isCacheStale(existing.cachedAt)) return;

      const [modulesRes, lessonsRes] = await Promise.all([
        lessonService.getModules(locale),
        lessonService.getLessons(undefined, locale),
      ]);
      await saveLessonData(locale, modulesRes, lessonsRes);
      await resolveImageUris(lessonsRes.lessons);
    } catch (err) {
      console.warn('[lessonDataCache] prefetch failed:', err);
    }
  })();
}
