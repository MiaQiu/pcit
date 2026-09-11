// SDK 54's `expo-file-system` default entry is the new File/Directory API —
// `documentDirectory`, `downloadAsync`, `getInfoAsync`, `makeDirectoryAsync`
// were moved to `/legacy` and now throw at runtime from the main entry.
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DemoVideo, LessonService } from '@nora/core';

const CACHE_DIR = `${FileSystem.documentDirectory}demo-video-thumbnails/`;
const METADATA_KEY = 'demo_video_thumbnail_cache_v1';

interface CacheEntry {
  localUri: string;
  updatedAt: string;
}

async function loadMetadata(): Promise<Record<string, CacheEntry>> {
  const raw = await AsyncStorage.getItem(METADATA_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveMetadata(metadata: Record<string, CacheEntry>): Promise<void> {
  await AsyncStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
}

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

async function downloadThumbnail(
  videoId: string,
  remoteUrl: string,
  updatedAt: string,
  metadata: Record<string, CacheEntry>
): Promise<string | null> {
  const ext = remoteUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
  const localUri = `${CACHE_DIR}${videoId}.${safeExt}`;

  try {
    const result = await FileSystem.downloadAsync(remoteUrl, localUri);
    if (result.status === 200) {
      metadata[videoId] = { localUri, updatedAt };
      return localUri;
    }
  } catch (err) {
    console.warn(`[demoVideoThumbnailCache] Download failed for ${videoId}:`, err);
  }
  return null;
}

/**
 * Resolve local cached thumbnail URIs for a list of demo videos.
 *
 * Already-cached files are returned immediately via `uris` so the current
 * version can render without waiting on the network — callers are expected
 * to invoke this on every check point (app open, Learn tab focus) rather
 * than relying on a time-based interval, since the caller already controls
 * when a fresh `DemoVideo[]` (with current `updatedAt`) is available.
 * Missing thumbnails (new video) or ones whose `updatedAt` no longer matches
 * the cached entry (admin replaced the file) are downloaded in the
 * background; `onThumbnailReady` fires per-video as each finishes.
 */
export async function resolveDemoVideoThumbnailUris(
  videos: DemoVideo[],
  onThumbnailReady?: (videoId: string, localUri: string) => void
): Promise<{ uris: Record<string, string> }> {
  await ensureCacheDir();
  const metadata = await loadMetadata();
  const uris: Record<string, string> = {};
  const toDownload: DemoVideo[] = [];

  for (const video of videos) {
    if (!video.thumbnailUrl) continue;

    const entry = metadata[video.id];
    if (entry) {
      const fileInfo = await FileSystem.getInfoAsync(entry.localUri);
      if (fileInfo.exists) {
        uris[video.id] = entry.localUri;
        if (entry.updatedAt !== video.updatedAt) toDownload.push(video);
        continue;
      }
    }

    toDownload.push(video);
  }

  if (toDownload.length > 0) {
    // Download each thumbnail independently so they appear as soon as ready,
    // without blocking the immediate return of already-cached `uris`.
    (async () => {
      const fresh = await loadMetadata();
      await Promise.allSettled(
        toDownload.map(async (video) => {
          if (!video.thumbnailUrl) return;
          const localUri = await downloadThumbnail(video.id, video.thumbnailUrl, video.updatedAt, fresh);
          if (localUri) onThumbnailReady?.(video.id, localUri);
        })
      );
      saveMetadata(fresh).catch(() => {});
    })();
  }

  return { uris };
}

/**
 * Fire-and-forget prefetch: fetches the active demo videos list and downloads
 * any new/changed thumbnails to disk. Called on app open so thumbnails are
 * already local by the time the user taps into Learn. Safe to call without
 * awaiting.
 */
export function prefetchDemoVideoThumbnails(lessonService: LessonService): void {
  (async () => {
    try {
      const { demoVideos } = await lessonService.getDemoVideos();
      await resolveDemoVideoThumbnailUris(demoVideos);
    } catch (err) {
      console.warn('[demoVideoThumbnailCache] prefetch failed:', err);
    }
  })();
}
