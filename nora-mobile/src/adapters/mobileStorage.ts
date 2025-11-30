import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageAdapter } from '@nora/core';

/**
 * Secure Storage Adapter (for sensitive data like tokens)
 * Uses expo-secure-store for encrypted storage
 */
export class SecureStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }

  async clear(): Promise<void> {
    // SecureStore doesn't have a clear method, so this is a no-op
    // Individual keys must be deleted manually
    console.warn('SecureStore does not support clear()');
  }
}

/**
 * Async Storage Adapter (for non-sensitive data)
 * Uses React Native AsyncStorage for simple key-value storage
 */
export class AsyncStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  }
}
