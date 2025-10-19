/**
 * Firebase Scan History Service
 * Handles scan history storage in Firestore with real-time sync
 */

import { UserScanData, DatabaseResponse } from './types';
import { FirestoreService } from './FirestoreService';
import { FirebaseAuthService } from './FirebaseAuthService';

interface ScanHistoryQuery {
  limit?: number;
  startAfter?: any;
  orderBy?: {
    field: keyof UserScanData;
    direction: 'asc' | 'desc';
  };
  filters?: Array<{
    field: keyof UserScanData;
    operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in';
    value: any;
  }>;
}

interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  lastDocument?: any;
  totalCount?: number;
}

export class FirebaseScanHistoryService {
  private static instance: FirebaseScanHistoryService;
  private firestoreService: FirestoreService;
  private authService: FirebaseAuthService;
  private activeSubscriptions = new Map<string, () => void>();

  static getInstance(): FirebaseScanHistoryService {
    if (!FirebaseScanHistoryService.instance) {
      FirebaseScanHistoryService.instance = new FirebaseScanHistoryService();
    }
    return FirebaseScanHistoryService.instance;
  }

  constructor() {
    this.firestoreService = FirestoreService.getInstance();
    this.authService = FirebaseAuthService.getInstance();
  }

  /**
   * Get collection path for user's scan history
   */
  private getScanHistoryPath(userId: string): string {
    return `users/${userId}/scanHistory`;
  }

  /**
   * Add scan data to user's history in Firestore
   */
  async addScanToHistory(scanData: UserScanData): Promise<DatabaseResponse<UserScanData>> {
    try {
      // Ensure user is authenticated
      const authResult = await this.authService.ensureAuthenticated();
      if (!authResult.success || !authResult.data) {
        return {
          success: false,
          error: 'User authentication required',
          timestamp: Date.now()
        };
      }

      const userId = authResult.data.uid;
      const collectionPath = this.getScanHistoryPath(userId);
      
      // Create document ID from timestamp and session ID for uniqueness
      const documentId = `${scanData.timestamp}_${scanData.sessionId}`;
      
      // Add server timestamp for consistency
      const scanWithServerTimestamp = {
        ...scanData,
        userId, // Ensure userId is included
        createdAt: this.firestoreService.getServerTimestamp(),
        updatedAt: this.firestoreService.getServerTimestamp()
      };

      const result = await this.firestoreService.createDocument(
        collectionPath,
        documentId,
        scanWithServerTimestamp
      );

      if (result.success) {
        console.log('Scan added to Firestore history:', documentId);
        return {
          success: true,
          data: scanData,
          timestamp: Date.now()
        };
      } else {
        return result as DatabaseResponse<UserScanData>;
      }
    } catch (error) {
      console.error('Failed to add scan to Firestore:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add scan',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get user's scan history with pagination
   */
  async getUserScanHistory(
    query: ScanHistoryQuery = {}
  ): Promise<DatabaseResponse<PaginatedResult<UserScanData>>> {
    try {
      // Ensure user is authenticated
      const authResult = await this.authService.ensureAuthenticated();
      if (!authResult.success || !authResult.data) {
        return {
          success: false,
          error: 'User authentication required',
          timestamp: Date.now()
        };
      }

      const userId = authResult.data.uid;
      const collectionPath = this.getScanHistoryPath(userId);

      // Build query parameters
      const {
        limit = 20,
        orderBy = { field: 'timestamp', direction: 'desc' },
        filters = []
      } = query;

      // Convert filters to Firestore format
      const firestoreQueries = filters.map(filter => ({
        field: filter.field as string,
        operator: filter.operator as any,
        value: filter.value
      }));

      const result = await this.firestoreService.queryCollection<UserScanData>(
        collectionPath,
        firestoreQueries,
        {
          field: orderBy.field as string,
          direction: orderBy.direction
        },
        limit + 1 // Fetch one extra to determine if there are more
      );

      if (result.success && result.data) {
        const hasMore = result.data.length > limit;
        const data = hasMore ? result.data.slice(0, limit) : result.data;
        const lastDocument = data.length > 0 ? data[data.length - 1] : undefined;

        return {
          success: true,
          data: {
            data,
            hasMore,
            lastDocument
          },
          timestamp: Date.now()
        };
      } else {
        return result as DatabaseResponse<PaginatedResult<UserScanData>>;
      }
    } catch (error) {
      console.error('Failed to get scan history from Firestore:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scan history',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Subscribe to real-time scan history updates
   */
  subscribeToScanHistory(
    callback: (scans: UserScanData[], error?: string) => void,
    query: ScanHistoryQuery = {}
  ): string | null {
    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        callback([], 'User not authenticated');
        return null;
      }

      const collectionPath = this.getScanHistoryPath(userId);
      const subscriptionId = `scan_history_${userId}_${Date.now()}`;

      // Build query parameters
      const {
        limit = 20,
        orderBy = { field: 'timestamp', direction: 'desc' },
        filters = []
      } = query;

      // Convert filters to Firestore format
      const firestoreQueries = filters.map(filter => ({
        field: filter.field as string,
        operator: filter.operator as any,
        value: filter.value
      }));

      const unsubscribe = this.firestoreService.subscribeToCollection<UserScanData>(
        collectionPath,
        (data, error) => {
          if (error) {
            callback([], error);
          } else {
            callback(data);
          }
        },
        firestoreQueries,
        {
          field: orderBy.field as string,
          direction: orderBy.direction
        },
        limit
      );

      this.activeSubscriptions.set(subscriptionId, unsubscribe);
      return subscriptionId;
    } catch (error) {
      console.error('Failed to subscribe to scan history:', error);
      callback([], error instanceof Error ? error.message : 'Subscription failed');
      return null;
    }
  }

  /**
   * Unsubscribe from scan history updates
   */
  unsubscribeFromScanHistory(subscriptionId: string): void {
    const unsubscribe = this.activeSubscriptions.get(subscriptionId);
    if (unsubscribe) {
      unsubscribe();
      this.activeSubscriptions.delete(subscriptionId);
      console.log('Unsubscribed from scan history:', subscriptionId);
    }
  }

  /**
   * Delete a specific scan from history
   */
  async deleteScan(scanData: UserScanData): Promise<DatabaseResponse<void>> {
    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated',
          timestamp: Date.now()
        };
      }

      if (scanData.userId !== userId) {
        return {
          success: false,
          error: 'Cannot delete scan from another user',
          timestamp: Date.now()
        };
      }

      const collectionPath = this.getScanHistoryPath(userId);
      const documentId = `${scanData.timestamp}_${scanData.sessionId}`;

      const result = await this.firestoreService.deleteDocument(
        collectionPath,
        documentId
      );

      if (result.success) {
        console.log('Scan deleted from Firestore:', documentId);
      }

      return result;
    } catch (error) {
      console.error('Failed to delete scan from Firestore:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete scan',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Update scan data (e.g., add safety tag after analysis)
   */
  async updateScan(
    scanData: UserScanData,
    updates: Partial<UserScanData>
  ): Promise<DatabaseResponse<UserScanData>> {
    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated',
          timestamp: Date.now()
        };
      }

      if (scanData.userId !== userId) {
        return {
          success: false,
          error: 'Cannot update scan from another user',
          timestamp: Date.now()
        };
      }

      const collectionPath = this.getScanHistoryPath(userId);
      const documentId = `${scanData.timestamp}_${scanData.sessionId}`;

      // Add update timestamp
      const updatesWithTimestamp = {
        ...updates,
        updatedAt: this.firestoreService.getServerTimestamp()
      };

      const result = await this.firestoreService.updateDocument(
        collectionPath,
        documentId,
        updatesWithTimestamp
      );

      if (result.success) {
        console.log('Scan updated in Firestore:', documentId);
        return {
          success: true,
          data: { ...scanData, ...updates },
          timestamp: Date.now()
        };
      } else {
        return result as DatabaseResponse<UserScanData>;
      }
    } catch (error) {
      console.error('Failed to update scan in Firestore:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update scan',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get scan count for user
   */
  async getScanCount(): Promise<DatabaseResponse<number>> {
    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated',
          timestamp: Date.now()
        };
      }

      const collectionPath = this.getScanHistoryPath(userId);
      
      // Get all scans to count (could be optimized with aggregation queries in future)
      const result = await this.firestoreService.queryCollection<UserScanData>(
        collectionPath
      );

      if (result.success && result.data) {
        return {
          success: true,
          data: result.data.length,
          timestamp: Date.now()
        };
      } else {
        return result as DatabaseResponse<number>;
      }
    } catch (error) {
      console.error('Failed to get scan count from Firestore:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scan count',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Clear all scan history for user
   */
  async clearAllScanHistory(): Promise<DatabaseResponse<void>> {
    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated',
          timestamp: Date.now()
        };
      }

      const collectionPath = this.getScanHistoryPath(userId);
      
      // Get all scans first
      const scansResult = await this.firestoreService.queryCollection<UserScanData>(
        collectionPath
      );

      if (!scansResult.success || !scansResult.data) {
        return scansResult as DatabaseResponse<void>;
      }

      // Prepare batch delete operations
      const deleteOperations = scansResult.data.map(scan => ({
        type: 'delete' as const,
        collectionPath,
        documentId: `${scan.timestamp}_${scan.sessionId}`
      }));

      if (deleteOperations.length === 0) {
        return {
          success: true,
          timestamp: Date.now()
        };
      }

      const result = await this.firestoreService.batchWrite(deleteOperations);
      
      if (result.success) {
        console.log('All scan history cleared from Firestore');
      }

      return result;
    } catch (error) {
      console.error('Failed to clear scan history from Firestore:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear scan history',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Cleanup all active subscriptions
   */
  cleanup(): void {
    this.activeSubscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.activeSubscriptions.clear();
    console.log('Firebase scan history subscriptions cleaned up');
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<DatabaseResponse<{ totalScans: number; oldestScan?: Date; newestScan?: Date }>> {
    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated',
          timestamp: Date.now()
        };
      }

      const collectionPath = this.getScanHistoryPath(userId);
      
      const result = await this.firestoreService.queryCollection<UserScanData>(
        collectionPath,
        [],
        { field: 'timestamp', direction: 'asc' }
      );

      if (result.success && result.data) {
        const scans = result.data;
        const stats = {
          totalScans: scans.length,
          oldestScan: scans.length > 0 ? new Date(scans[0].timestamp) : undefined,
          newestScan: scans.length > 0 ? new Date(scans[scans.length - 1].timestamp) : undefined
        };

        return {
          success: true,
          data: stats,
          timestamp: Date.now()
        };
      } else {
        return result as DatabaseResponse<{ totalScans: number; oldestScan?: Date; newestScan?: Date }>;
      }
    } catch (error) {
      console.error('Failed to get storage stats from Firestore:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get storage stats',
        timestamp: Date.now()
      };
    }
  }
}

// Export singleton instance
export const firebaseScanHistoryService = FirebaseScanHistoryService.getInstance();