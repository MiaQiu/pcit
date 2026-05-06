/**
 * User-scoped AsyncStorage
 *
 * Prefixes every key with `user:<userId>:` so different users on the same
 * device never share data.
 *
 * Logout clears only the in-memory userId pointer — cached data is preserved
 * on disk so re-login is instant and offline-first. Explicit data deletion
 * (e.g. account deletion) should call clearKeysForUser() directly.
 *
 * Usage:
 *   import * as userStorage from '../lib/userStorage';
 *   await userStorage.setItem('notification_preferences', json);
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_USER_KEY = '@last_user_id';

let currentUserId: string | null = null;

/**
 * Call this after a successful login / auth check with the authenticated user's ID.
 */
export async function setCurrentUserId(userId: string): Promise<void> {
  try {
    currentUserId = userId;
    await AsyncStorage.setItem(LAST_USER_KEY, userId);
  } catch (error) {
    console.error('[userStorage] setCurrentUserId error:', error);
    currentUserId = userId; // still set in-memory so the app works
  }
}

/**
 * Call this on logout. Clears the in-memory userId so subsequent reads
 * return null, but leaves cached data on disk for fast re-login.
 */
export async function clearCurrentUser(): Promise<void> {
  currentUserId = null;
}

/**
 * Resolve the current user ID, falling back to the last-known stored ID if
 * the in-memory value was wiped (e.g. by Fast Refresh or module re-init).
 */
async function resolveUserId(): Promise<string | null> {
  if (currentUserId) return currentUserId;
  try {
    const stored = await AsyncStorage.getItem(LAST_USER_KEY);
    if (stored) {
      console.warn('[userStorage] currentUserId was null — recovered from AsyncStorage:', stored);
      currentUserId = stored;
      return stored;
    }
  } catch (error) {
    console.error('[userStorage] resolveUserId fallback failed:', error);
  }
  return null;
}

export async function getItem(key: string): Promise<string | null> {
  const userId = await resolveUserId();
  if (!userId) return null;
  return AsyncStorage.getItem(`user:${userId}:${key}`);
}

export async function setItem(key: string, value: string): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) return;
  return AsyncStorage.setItem(`user:${userId}:${key}`, value);
}

export async function removeItem(key: string): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) return;
  return AsyncStorage.removeItem(`user:${userId}:${key}`);
}

/**
 * One-time migration: moves legacy device-level keys into the current user's
 * namespace. Call once after setCurrentUserId() on every login. Safe to call
 * repeatedly — skips any key that already has a user-scoped value.
 *
 * Old format → new format:
 *   @notification_preferences → user:<id>:@notification_preferences
 *   @nora_coach_messages_cache → user:<id>:@nora_coach_messages_cache
 *   ... etc.
 */
const LEGACY_DEVICE_KEYS = [
  '@notification_preferences',
  '@nora_coach_messages_cache',
  '@nora_psych_messages_cache',
  '@nora_psych_requested',
  '@report_chat_demo_shown',
  '@discipline_phase_celebrated',
];

export async function migrateLegacyDeviceKeys(): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) return;
  try {
    await Promise.all(
      LEGACY_DEVICE_KEYS.map(async (key) => {
        const newKey = `user:${userId}:${key}`;
        const [newValue, oldValue] = await Promise.all([
          AsyncStorage.getItem(newKey),
          AsyncStorage.getItem(key),
        ]);
        // Only migrate if destination is empty and source has data
        if (newValue === null && oldValue !== null) {
          await AsyncStorage.setItem(newKey, oldValue);
          await AsyncStorage.removeItem(key);
          console.log(`[userStorage] Migrated legacy key: ${key}`);
        }
      })
    );
  } catch (error) {
    console.error('[userStorage] migrateLegacyDeviceKeys error:', error);
  }
}

export async function clearKeysForUser(userId: string): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter(key => key.startsWith(`user:${userId}:`));
    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
    }
  } catch (error) {
    console.error('[userStorage] clearKeysForUser error:', error);
  }
}
