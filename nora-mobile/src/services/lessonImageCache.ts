import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_DIR = `${FileSystem.documentDirectory}lesson-images/`;
const METADATA_KEY = 'lesson_image_cache_v1';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  localUri: string;
  imageUpdatedAt: string;
  lastChecked: number;
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

async function downloadImage(
  lessonId: string,
  remoteUrl: string,
  imageUpdatedAt: string,
  metadata: Record<string, CacheEntry>
): Promise<string | null> {
  const ext = remoteUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
  const localUri = `${CACHE_DIR}${lessonId}.${safeExt}`;

  try {
    const result = await FileSystem.downloadAsync(remoteUrl, localUri);
    if (result.status === 200) {
      metadata[lessonId] = { localUri, imageUpdatedAt, lastChecked: Date.now() };
      return localUri;
    }
  } catch (err) {
    console.warn(`[lessonImageCache] Download failed for ${lessonId}:`, err);
  }
  return null;
}

/**
 * Resolve local cached URIs for a list of lessons.
 *
 * Returns immediately with whatever is already on disk. Also returns a
 * `pendingDownloads` promise that resolves with newly downloaded URIs once
 * background downloads finish (may be an empty object if nothing needed).
 *
 * Daily-check logic: within 24 h, cached entries are used as-is.
 * After 24 h, imageUpdatedAt is compared; only re-download if it changed.
 */
export async function resolveImageUris(
  lessons: Array<{ id: string; dragonImageUrl?: string | null; imageUpdatedAt?: string | null }>
): Promise<{ uris: Record<string, string>; pendingDownloads: Promise<Record<string, string>> }> {
  await ensureCacheDir();
  const metadata = await loadMetadata();
  const now = Date.now();
  const uris: Record<string, string> = {};
  const toDownload: typeof lessons = [];
  const metadataUpdated: Record<string, CacheEntry> = {};

  for (const lesson of lessons) {
    const remoteUrl = lesson.dragonImageUrl;
    if (!remoteUrl || remoteUrl.startsWith('mock://')) continue;

    const entry = metadata[lesson.id];

    if (entry) {
      const fileInfo = await FileSystem.getInfoAsync(entry.localUri);
      if (fileInfo.exists) {
        uris[lesson.id] = entry.localUri;

        if (now - entry.lastChecked >= CHECK_INTERVAL_MS) {
          if (entry.imageUpdatedAt !== (lesson.imageUpdatedAt ?? '')) {
            // Image was updated — schedule re-download
            toDownload.push(lesson);
          } else {
            // Still current — just refresh the check timestamp
            metadataUpdated[lesson.id] = { ...entry, lastChecked: now };
          }
        }
        continue;
      }
    }

    // Not cached or file missing
    toDownload.push(lesson);
  }

  // Persist lastChecked updates without waiting
  if (Object.keys(metadataUpdated).length > 0) {
    saveMetadata({ ...metadata, ...metadataUpdated }).catch(() => {});
  }

  const pendingDownloads = (async (): Promise<Record<string, string>> => {
    if (toDownload.length === 0) return {};

    const fresh = await loadMetadata();
    const newUris: Record<string, string> = {};

    await Promise.allSettled(
      toDownload.map(async (lesson) => {
        if (!lesson.dragonImageUrl) return;
        const localUri = await downloadImage(
          lesson.id,
          lesson.dragonImageUrl,
          lesson.imageUpdatedAt ?? '',
          fresh
        );
        if (localUri) newUris[lesson.id] = localUri;
      })
    );

    await saveMetadata(fresh);
    return newUris;
  })();

  return { uris, pendingDownloads };
}
