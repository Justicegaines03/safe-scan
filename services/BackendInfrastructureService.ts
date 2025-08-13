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
    console.log('BackendInfrastructureService constructor called');
    
    console.log('LocalStorageService class:', LocalStorageService);
    
    // Try direct instantiation to debug
    try {
      this.localStorage = new LocalStorageService();
      console.log('Direct LocalStorageService instantiation:', this.localStorage);
      console.log('queueForSync method exists:', typeof this.localStorage.queueForSync);
      console.log('All localStorage methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.localStorage)));
    } catch (error) {
      console.error('Error creating LocalStorageService:', error);
      this.localStorage = LocalStorageService.getInstance();
    }
    
    this.cloudSync = CloudSyncService.getInstance();
    this.communityDB = CommunityDatabaseService.getInstance();
    this.webSocket = WebSocketService.getInstance();
    this.cache = CacheService.getInstance();
    this.errorHandler = ErrorHandlingService.getInstance();
    
    console.log('BackendInfrastructureService - localStorage:', this.localStorage);
    console.log('BackendInfrastructureService - localStorage methods:', Object.getOwnPropertyNames(this.localStorage));
    console.log('BackendInfrastructureService - all services initialized');
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
      console.log('=== Initializing backend services');
      
      // Initialize local storage and validate data integrity
      if (this.localStorage && typeof this.localStorage.validateDataIntegrity === 'function') {
        await this.localStorage.validateDataIntegrity();
        console.log('localStorage initialized successfully');
      } else {
        console.warn('localStorage not available, skipping validation');
      }
      
      // Start auto-sync
      if (this.cloudSync && typeof this.cloudSync.startAutoSync === 'function') {
        this.cloudSync.startAutoSync();
        console.log('CloudSync started successfully');
      } else {
        console.warn('CloudSync not available');
      }
      
      // Connect to WebSocket for real-time updates
      if (this.webSocket && typeof this.webSocket.connect === 'function') {
        const wsConnected = await this.webSocket.connect();
        if (!wsConnected && this.errorHandler && typeof this.errorHandler.setServiceAvailability === 'function') {
          this.errorHandler.setServiceAvailability('webSocket', false);
        }
        console.log('WebSocket connection attempted');
      } else {
        console.warn('WebSocket not available');
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
      console.log('=== NEW submitVote called with vote:', vote);
      console.log('=== Using workaround implementation');
      
      // Add vote to community database
      console.log('=== About to call errorHandler.executeWithCircuitBreaker');
      const result = await this.errorHandler.executeWithCircuitBreaker('communityDB', async () => {
        console.log('=== About to call communityDB.addVote');
        return this.communityDB.addVote(vote);
      });
      console.log('=== addVote completed, result:', result);
      console.log('=== addVote completed, result:', result);

      if (result.success && result.data) {
        console.log('=== Vote successful, about to cache and broadcast');
        
        // Cache the updated rating
        console.log('=== About to call cache.set');
        this.cache.set(`rating_${vote.qrHash}`, result.data);
        console.log('=== cache.set completed');
        
        // Broadcast update via WebSocket
        console.log('=== About to call webSocket.broadcastRatingUpdate');
        this.webSocket.broadcastRatingUpdate(vote.qrHash, result.data);
        console.log('=== webSocket.broadcastRatingUpdate completed');
        
        // Store vote locally for sync - using direct AsyncStorage as workaround
        console.log('About to queue vote for sync');
        
        try {
          // Direct implementation of queueForSync functionality
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const SYNC_QUEUE_KEY = '@safe_scan_sync_queue';
          
          // Get existing queue
          const existingQueue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
          const queue = existingQueue ? JSON.parse(existingQueue) : [];
          
          // Add new vote to queue
          queue.push({
            type: 'vote',
            data: vote,
            timestamp: Date.now(),
            queuedAt: Date.now(),
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
          });
          
          // Save updated queue
          await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
          console.log('Vote queued for sync successfully');
          
        } catch (syncError) {
          console.error('Failed to queue vote for sync:', syncError);
          // Don't throw here - the vote was still submitted successfully
        }
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
   * Retract community vote with real-time updates
   */
  async retractVote(userId: string, qrHash: string): Promise<DatabaseResponse<CommunityRating>> {
    try {
      console.log('=== Retracting vote - userId:', userId, 'qrHash:', qrHash);
      
      // Retract vote from community database
      const result = await this.errorHandler.executeWithCircuitBreaker('communityDB', async () => {
        return this.communityDB.retractVote(userId, qrHash);
      });

      if (result.success && result.data) {
        console.log('=== Vote retracted successfully, updating cache and broadcasting');
        
        // Update cache with the new rating
        this.cache.set(`rating_${qrHash}`, result.data);
        
        // Broadcast update via WebSocket
        this.webSocket.broadcastRatingUpdate(qrHash, result.data);
        
        // Queue retraction for sync
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const SYNC_QUEUE_KEY = '@safe_scan_sync_queue';
          
          // Get existing queue
          const existingQueue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
          const queue = existingQueue ? JSON.parse(existingQueue) : [];
          
          // Add retraction to queue
          queue.push({
            type: 'retractVote',
            data: { userId, qrHash },
            timestamp: Date.now(),
            queuedAt: Date.now(),
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
          });
          
          // Save updated queue
          await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
          console.log('Vote retraction queued for sync successfully');
          
        } catch (syncError) {
          console.error('Failed to queue vote retraction for sync:', syncError);
          // Don't throw here - the retraction was still processed successfully
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vote retraction failed',
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
