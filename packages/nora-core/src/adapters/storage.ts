/**
 * Storage Adapter Interface
 * Platform-agnostic storage interface that can be implemented for:
 * - Web: localStorage
 * - Mobile: AsyncStorage (non-sensitive) or SecureStore (sensitive)
 */

export interface StorageAdapter {
  /**
   * Get an item from storage
   * @param key The key to retrieve
   * @returns The value or null if not found
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Set an item in storage
   * @param key The key to set
   * @param value The value to store
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Remove an item from storage
   * @param key The key to remove
   */
  removeItem(key: string): Promise<void>;

  /**
   * Clear all items from storage
   */
  clear?(): Promise<void>;
}

/**
 * Web localStorage adapter (for browser)
 */
export class WebStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }
}
