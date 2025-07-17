/**
 * Backend Infrastructure Service
 * Main orchestrator for all backend services
 */

import { LocalStorageService } from './LocalStorageService';
import { CloudSyncService } from './CloudSyncService';
import { CommunityDatabaseService } from './CommunityDatabaseService';
import { WebSocketService } from './WebSocketService';
import { CacheService } from './CacheService';
import { ErrorHandlingService } from './ErrorHandlingService';
import { UserScanData, Vote, CommunityRating, DatabaseResponse, SyncStatus } from './types';

export class BackendInfrastructureService {
  private static instance: BackendInfrastructureService;
  
  private localStorage: LocalStorageService;
  private cloudSync: CloudSyncService;
  private communityDB: CommunityDatabaseService;
  private webSocket: WebSocketService;
  private cache: CacheService;
  private errorHandler: ErrorHandlingService;

  constructor() {
    this.localStorage = LocalStorageService.getInstance();
    this.cloudSync = CloudSyncService.getInstance();
    this.communityDB = CommunityDatabaseService.getInstance();
    this.webSocket = WebSocketService.getInstance();
    this.cache = CacheService.getInstance();
    this.errorHandler = ErrorHandlingService.getInstance();
  }

  static getInstance(): BackendInfrastructureService {
    if (!BackendInfrastructureService.instance) {
      BackendInfrastructureService.instance = new BackendInfrastructureService();
    }
    return BackendInfrastructureService.instance;
  }

  /**
   * Initialize all backend services
   */
  async initialize(): Promise<void> {
    try {
      // Initialize local storage and validate data integrity
      await this.localStorage.validateDataIntegrity();
      
      // Start auto-sync
      this.cloudSync.startAutoSync();
      
      // Connect to WebSocket for real-time updates
      const wsConnected = await this.webSocket.connect();
      if (!wsConnected) {
        this.errorHandler.setServiceAvailability('webSocket', false);
      }

      // Setup WebSocket event listeners
      this.setupWebSocketListeners();
      
      console.log('Backend infrastructure initialized successfully');
    } catch (error) {
      console.error('Failed to initialize backend infrastructure:', error);
      throw error;
    }
  }

  /**
   * Store scan data with fallback mechanisms
   */
  async storeScanData(scanData: UserScanData): Promise<DatabaseResponse<UserScanData>> {
    try {
      // Always store locally first
      const localResult = await this.localStorage.storeScanData(scanData);
      
      // Try to sync to cloud if online
      const isOnline = await this.cloudSync.checkOnlineStatus();
      if (isOnline) {
        try {
          await this.errorHandler.executeWithCircuitBreaker('cloudSync', async () => {
            return this.cloudSync.syncToCloud([scanData]);
          });
        } catch (error) {
          // Cloud sync failed, but local storage succeeded
          console.warn('Cloud sync failed, data stored locally:', error);
        }
      } else {
        // Queue for later sync
        await this.localStorage.queueForSync({
          type: 'upload',
          data: scanData,
          timestamp: Date.now()
        });
      }

      return localResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Storage failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Submit community vote with real-time updates
   */
  async submitVote(vote: Vote): Promise<DatabaseResponse<CommunityRating>> {
    try {
      // Add vote to community database
      const result = await this.errorHandler.executeWithCircuitBreaker('communityDB', async () => {
        return this.communityDB.addVote(vote);
      });

      if (result.success && result.data) {
        // Cache the updated rating
        this.cache.set(`rating_${vote.qrHash}`, result.data);
        
        // Broadcast update via WebSocket
        this.webSocket.broadcastRatingUpdate(vote.qrHash, result.data);
        
        // Store vote locally for sync
        await this.localStorage.queueForSync({
          type: 'vote',
          data: vote,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vote failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get community rating with caching
   */
  async getCommunityRating(qrHash: string): Promise<CommunityRating | null> {
    try {
      // Check cache first
      const cached = this.cache.get<CommunityRating>(`rating_${qrHash}`);
      if (cached) {
        return cached;
      }

      // Get from community database
      const rating = await this.errorHandler.executeWithCircuitBreaker('communityDB', async () => {
        return this.communityDB.getCommunityRating(qrHash);
      });

      // Cache the result
      if (rating) {
        this.cache.set(`rating_${qrHash}`, rating);
      }

      return rating;
    } catch (error) {
      console.error('Failed to get community rating:', error);
      return null;
    }
  }

  /**
   * Get scan history with local fallback
   */
  async getScanHistory(): Promise<UserScanData[]> {
    try {
      return await this.localStorage.getScanHistory();
    } catch (error) {
      console.error('Failed to get scan history:', error);
      return [];
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    return this.cloudSync.getSyncStatus();
  }

  /**
   * Force sync all data
   */
  async forceSyncAll(): Promise<DatabaseResponse<{ synced: number }>> {
    try {
      const scanHistory = await this.localStorage.getScanHistory();
      return await this.cloudSync.syncToCloud(scanHistory);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupWebSocketListeners(): void {
    // Listen for rating updates
    this.webSocket.subscribe('rating_update', (message) => {
      if (message.qrHash && message.data?.newRating) {
        // Update cache
        this.cache.set(`rating_${message.qrHash}`, message.data.newRating);
      }
    });

    // Listen for vote updates
    this.webSocket.subscribe('vote', (message) => {
      // Handle incoming votes
      console.log('Received vote update:', message);
    });
  }

  /**
   * Perform database sharding for large datasets
   */
  generateShardKey(qrHash: string, shardCount: number = 10): number {
    let hash = 0;
    for (let i = 0; i < qrHash.length; i++) {
      const char = qrHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % shardCount;
  }

  /**
   * Clean up old data across all services
   */
  async performMaintenanceCleanup(): Promise<{
    localStorage: any;
    community: any;
    cache: any;
  }> {
    const results = {
      localStorage: await this.localStorage.getStorageStats(),
      community: await this.communityDB.cleanupOldData(),
      cache: this.cache.getStats()
    };

    // Clear expired cache entries
    this.cache.clear();

    return results;
  }

  /**
   * Get overall system health
   */
  getSystemHealth() {
    const serviceAvailability = this.errorHandler.getServiceAvailability();
    const errorStats = this.errorHandler.getErrorStats();
    const wsStatus = this.webSocket.getConnectionStatus();
    const cacheStats = this.cache.getStats();

    return {
      services: serviceAvailability,
      errors: errorStats,
      webSocket: wsStatus,
      cache: cacheStats,
      timestamp: Date.now()
    };
  }

  /**
   * Shutdown all services gracefully
   */
  async shutdown(): Promise<void> {
    try {
      // Disconnect WebSocket
      this.webSocket.disconnect();
      
      // Stop cache cleanup
      this.cache.stopCleanup();
      
      // Final sync attempt
      const isOnline = await this.cloudSync.checkOnlineStatus();
      if (isOnline) {
        await this.cloudSync.processSyncQueue();
      }

      console.log('Backend infrastructure shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

// Export singleton instance
export const backendInfrastructure = BackendInfrastructureService.getInstance();
