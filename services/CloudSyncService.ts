/**
 * Cloud Synchronization Service
 * Handles syncing local data to cloud when online
 */

import { UserScanData, DatabaseResponse, SyncStatus } from './types';
import { LocalStorageService } from './LocalStorageService';

const SYNC_CONFIG = {
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 60000, // 1 minute
  MAX_RETRY_ATTEMPTS: 5,
  BATCH_SIZE: 50,
  SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes
} as const;

export class CloudSyncService {
  private static instance: CloudSyncService;
  private localStorage: LocalStorageService;
  private syncInProgress = false;
  private retryAttempts = 0;
  private lastSyncTime = 0;

  constructor() {
    this.localStorage = LocalStorageService.getInstance();
  }

  static getInstance(): CloudSyncService {
    if (!CloudSyncService.instance) {
      CloudSyncService.instance = new CloudSyncService();
    }
    return CloudSyncService.instance;
  }

  /**
   * Sync local data to cloud when online
   */
  async syncToCloud(localData: UserScanData[]): Promise<DatabaseResponse<{ synced: number }>> {
    if (this.syncInProgress) {
      return {
        success: false,
        error: 'Sync already in progress',
        timestamp: Date.now()
      };
    }

    try {
      this.syncInProgress = true;
      
      // Process data in batches to avoid overwhelming the server
      const batches = this.createBatches(localData, SYNC_CONFIG.BATCH_SIZE);
      let totalSynced = 0;

      for (const batch of batches) {
        const result = await this.syncBatch(batch);
        if (result.success) {
          totalSynced += batch.length;
        } else {
          throw new Error(result.error || 'Batch sync failed');
        }
      }

      this.lastSyncTime = Date.now();
      this.retryAttempts = 0;

      return {
        success: true,
        data: { synced: totalSynced },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        timestamp: Date.now()
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Handle sync conflicts with server data
   */
  handleSyncConflicts(localData: any, serverData: any): any {
    // Server wins strategy - use latest timestamp
    if (serverData.timestamp > localData.timestamp) {
      return serverData;
    }
    return localData;
  }

  /**
   * Implement exponential backoff for failed syncs
   */
  calculateBackoffDelay(attempt: number): number {
    const delay = SYNC_CONFIG.BASE_DELAY * Math.pow(2, attempt - 1);
    return Math.min(SYNC_CONFIG.MAX_DELAY, delay);
  }

  /**
   * Retry sync with exponential backoff
   */
  async retrySyncWithBackoff(data: UserScanData[]): Promise<DatabaseResponse<{ synced: number }>> {
    if (this.retryAttempts >= SYNC_CONFIG.MAX_RETRY_ATTEMPTS) {
      return {
        success: false,
        error: 'Max retry attempts exceeded',
        timestamp: Date.now()
      };
    }

    this.retryAttempts++;
    const delay = this.calculateBackoffDelay(this.retryAttempts);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return this.syncToCloud(data);
  }

  /**
   * Process sync queue when coming back online
   */
  async processSyncQueue(): Promise<DatabaseResponse<{ processed: number }>> {
    try {
      const queue = await this.localStorage.getSyncQueue();
      if (queue.length === 0) {
        return {
          success: true,
          data: { processed: 0 },
          timestamp: Date.now()
        };
      }

      const processedIds: string[] = [];
      let processedCount = 0;

      for (const item of queue) {
        try {
          // Simulate API call to sync individual item
          const mockApiCall = await this.mockSyncItem(item);
          if (mockApiCall.success) {
            processedIds.push(item.id);
            processedCount++;
          }
        } catch (error) {
          console.error('Failed to process queue item:', error);
        }
      }

      // Remove processed items from queue
      await this.localStorage.clearSyncQueue(processedIds);

      return {
        success: true,
        data: { processed: processedCount },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Queue processing failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const queue = await this.localStorage.getSyncQueue();
    
    return {
      lastSync: this.lastSyncTime,
      pendingUploads: queue.filter(item => item.type === 'upload').length,
      pendingDownloads: queue.filter(item => item.type === 'download').length,
      isOnline: await this.checkOnlineStatus()
    };
  }

  /**
   * Check if device is online
   */
  async checkOnlineStatus(): Promise<boolean> {
    try {
      // For React Native, you'd use NetInfo
      // For web, check navigator.onLine
      if (typeof navigator !== 'undefined') {
        return navigator.onLine;
      }
      return true; // Assume online in test environment
    } catch {
      return false;
    }
  }

  /**
   * Start automatic sync interval
   */
  startAutoSync(): void {
    setInterval(async () => {
      if (await this.checkOnlineStatus() && !this.syncInProgress) {
        const scanHistory = await this.localStorage.getScanHistory();
        if (scanHistory.length > 0) {
          await this.syncToCloud(scanHistory);
        }
        await this.processSyncQueue();
      }
    }, SYNC_CONFIG.SYNC_INTERVAL);
  }

  /**
   * Create batches for processing large datasets
   */
  private createBatches<T>(data: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sync a single batch of data
   */
  private async syncBatch(batch: UserScanData[]): Promise<DatabaseResponse<UserScanData[]>> {
    try {
      // Mock API call - in real implementation, this would be an HTTP request
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
      
      return {
        success: true,
        data: batch,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch sync failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Mock sync individual queue item
   */
  private async mockSyncItem(item: any): Promise<DatabaseResponse<any>> {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        success: true,
        data: item,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Item sync failed',
        timestamp: Date.now()
      };
    }
  }
}
