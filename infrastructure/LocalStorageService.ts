/**
 * Local Data Storage Service
 * Handles offline data persistence and storage management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserScanData, DatabaseResponse } from './types';

const STORAGE_KEYS = {
  SCAN_HISTORY: '@safe_scan_history',
  USER_VOTES: '@safe_scan_user_votes',
  SETTINGS: '@safe_scan_settings',
  CACHE: '@safe_scan_cache',
  SYNC_QUEUE: '@safe_scan_sync_queue',
} as const;

const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
const CLEANUP_THRESHOLD = 0.9; // Start cleanup at 90% capacity

export class LocalStorageService {
  private static instance: LocalStorageService;

  constructor() {
    console.log('LocalStorageService constructor called');
  }

  static getInstance(): LocalStorageService {
    console.log('LocalStorageService.getInstance() called');
    if (!LocalStorageService.instance) {
      console.log('Creating new LocalStorageService instance');
      LocalStorageService.instance = new LocalStorageService();
    }
    console.log('Returning LocalStorageService instance:', LocalStorageService.instance);
    return LocalStorageService.instance;
  }

  /**
   * Store scan data locally when offline
   */
  async storeScanData(scanData: UserScanData): Promise<DatabaseResponse<UserScanData>> {
    try {
      const existingData = await this.getScanHistory();
      const updatedData = [scanData, ...existingData];
      
      // Check storage limits before saving
      await this.enforceStorageLimits(updatedData);
      
      const serialized = JSON.stringify(updatedData);
      await AsyncStorage.setItem(STORAGE_KEYS.SCAN_HISTORY, serialized);

      return {
        success: true,
        data: scanData,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Storage failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Retrieve scan history from local storage
   */
  async getScanHistory(): Promise<UserScanData[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SCAN_HISTORY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error retrieving scan history:', error);
      return [];
    }
  }

  /**
   * Handle storage quota limits with cleanup strategy
   */
  async enforceStorageLimits(data: UserScanData[]): Promise<UserScanData[]> {
    const serialized = JSON.stringify(data);
    const currentSize = new Blob([serialized]).size;

    if (currentSize > MAX_STORAGE_SIZE * CLEANUP_THRESHOLD) {
      // Sort by timestamp and keep most recent entries
      const sortedData = data.sort((a, b) => b.timestamp - a.timestamp);
      
      let cleanedData = [...sortedData];
      let cleanedSize = currentSize;

      // Remove oldest entries until under limit
      while (cleanedSize > MAX_STORAGE_SIZE * 0.7 && cleanedData.length > 0) {
        cleanedData.pop();
        cleanedSize = new Blob([JSON.stringify(cleanedData)]).size;
      }

      return cleanedData;
    }

    return data;
  }

  /**
   * Maintain data integrity across app sessions
   */
  async validateDataIntegrity(): Promise<boolean> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      
      for (const key of keys) {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          // Validate JSON structure
          JSON.parse(stored);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Data integrity check failed:', error);
      await this.repairCorruptedData();
      return false;
    }
  }

  /**
   * Handle corrupted local data gracefully with fallback
   */
  async repairCorruptedData(): Promise<void> {
    const fallbackData = {
      scanHistory: [],
      userVotes: [],
      settings: { notifications: true, autoSync: true },
      cache: {},
      syncQueue: []
    };

    try {
      // Attempt to repair each storage key
      for (const [key, defaultValue] of Object.entries(fallbackData)) {
        const storageKey = STORAGE_KEYS[key.toUpperCase() as keyof typeof STORAGE_KEYS];
        if (storageKey) {
          try {
            const stored = await AsyncStorage.getItem(storageKey);
            if (stored) {
              JSON.parse(stored); // Test if valid JSON
            }
          } catch {
            // Replace corrupted data with fallback
            await AsyncStorage.setItem(storageKey, JSON.stringify(defaultValue));
          }
        }
      }
    } catch (error) {
      console.error('Data repair failed:', error);
      // Last resort: clear all corrupted data
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    }
  }

  /**
   * Queue operations for later sync when offline
   */
  async queueForSync(operation: any): Promise<void> {
    try {
      const queue = await this.getSyncQueue();
      queue.push({
        ...operation,
        queuedAt: Date.now(),
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      });
      
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to queue operation:', error);
    }
  }

  /**
   * Get sync queue for processing when online
   */
  async getSyncQueue(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear processed items from sync queue
   */
  async clearSyncQueue(processedIds: string[]): Promise<void> {
    try {
      const queue = await this.getSyncQueue();
      const remaining = queue.filter(item => !processedIds.includes(item.id));
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(remaining));
    } catch (error) {
      console.error('Failed to clear sync queue:', error);
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{ used: number; available: number; percentage: number }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }

      const percentage = (totalSize / MAX_STORAGE_SIZE) * 100;
      
      return {
        used: totalSize,
        available: MAX_STORAGE_SIZE - totalSize,
        percentage: Math.round(percentage * 100) / 100
      };
    } catch {
      return { used: 0, available: MAX_STORAGE_SIZE, percentage: 0 };
    }
  }

  /**
   * Clear all local storage
   */
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }
}
