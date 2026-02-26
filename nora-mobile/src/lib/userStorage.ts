/**
 * User-scoped AsyncStorage
 *
 * Prefixes every key with `user:<userId>:` so different users on the same
 * device never share data. On login with a new userId the previous user's
 * keys are automatically cleared in the background.
 *
 * Usage:
 *   import * as userStorage from '../lib/userStorage';
 *   await userStorage.setItem('module_picker_selected_module', key);
 *
 * Device-level keys (e.g. @notification_preferences) should continue
 * to use AsyncStorage directly — do NOT route them through this module.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_USER_KEY = '@last_user_id';

let currentUserId: string | null = null;

/**
 * Call this after a successful login / auth check with the authenticated user's ID.
 * If a different user was stored from a previous session, their keys are cleared
 * in the background before the new user's ID is recorded.
 */
export async function setCurrentUserId(userId: string): Promise<void> {
  try {
    const lastUserId = await AsyncStorage.getItem(LAST_USER_KEY);
    if (lastUserId && lastUserId !== userId) {
      // Different user — wipe their data before proceeding
      clearKeysForUser(lastUserId).catch(err =>
        console.error('[userStorage] Failed to clear previous user data:', err)
      );
    }
    currentUserId = userId;
    await AsyncStorage.setItem(LAST_USER_KEY, userId);
  } catch (error) {
    console.error('[userStorage] setCurrentUserId error:', error);
    currentUserId = userId; // still set in-memory so the app works
  }
}

/**
 * Call this on logout. Clears all keys for the current user and resets
 * the in-memory userId so subsequent reads return null.
 */
export async function clearCurrentUser(): Promise<void> {
  if (currentUserId) {
    await clearKeysForUser(currentUserId);
  }
  currentUserId = null;
}

export async function getItem(key: string): Promise<string | null> {
  if (!currentUserId) return null;
  return AsyncStorage.getItem(`user:${currentUserId}:${key}`);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (!currentUserId) return;
  return AsyncStorage.setItem(`user:${currentUserId}:${key}`, value);
}

export async function removeItem(key: string): Promise<void> {
  if (!currentUserId) return;
  return AsyncStorage.removeItem(`user:${currentUserId}:${key}`);
}

async function clearKeysForUser(userId: string): Promise<void> {
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
