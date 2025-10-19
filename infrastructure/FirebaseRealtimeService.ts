/**
 * Firebase Realtime Service
 * Replaces WebSocket functionality with Firestore real-time listeners
 */

import { CommunityRating, Vote, UserScanData } from './types';
import { FirestoreService } from './FirestoreService';
import { FirebaseAuthService } from './FirebaseAuthService';

interface RealtimeEvent {
  type: 'rating_update' | 'new_scan' | 'vote_submitted' | 'user_activity' | 'system_status';
  qrHash?: string;
  userId?: string;
  data: any;
  timestamp: number;
  source: 'local' | 'server';
}

interface SystemStatus {
  isOnline: boolean;
  lastSync: number;
  activeUsers: number;
  systemHealth: 'healthy' | 'degraded' | 'offline';
}

interface RealtimeSubscription {
  id: string;
  type: string;
  callback: (event: RealtimeEvent) => void;
  unsubscribe: () => void;
  created: number;
}

export class FirebaseRealtimeService {
  private static instance: FirebaseRealtimeService;
  private firestoreService: FirestoreService;
  private authService: FirebaseAuthService;
  private subscriptions = new Map<string, RealtimeSubscription>();
  private eventListeners = new Map<string, Array<(event: RealtimeEvent) => void>>();
  private isConnected = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private connectionCallbacks: Array<(connected: boolean) => void> = [];

  static getInstance(): FirebaseRealtimeService {
    if (!FirebaseRealtimeService.instance) {
      FirebaseRealtimeService.instance = new FirebaseRealtimeService();
    }
    return FirebaseRealtimeService.instance;
  }

  constructor() {
    this.firestoreService = FirestoreService.getInstance();
    this.authService = FirebaseAuthService.getInstance();
    this.initializeConnectionMonitoring();
  }

  /**
   * Initialize connection monitoring
   */
  private initializeConnectionMonitoring(): void {
    // Monitor Firestore connectivity
    this.startHeartbeat();
    
    // Listen to auth state changes
    this.authService.onAuthStateChanged((authState) => {
      if (authState.isAuthenticated) {
        this.handleConnect();
      } else {
        this.handleDisconnect();
      }
    });
  }

  /**
   * Start heartbeat to monitor connection
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const isOnline = await this.firestoreService.checkConnectivity();
        if (isOnline !== this.isConnected) {
          if (isOnline) {
            this.handleConnect();
          } else {
            this.handleDisconnect();
          }
        }
      } catch (error) {
        console.error('Heartbeat check failed:', error);
        this.handleDisconnect();
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Handle connection established
   */
  private handleConnect(): void {
    if (!this.isConnected) {
      this.isConnected = true;
      console.log('Firebase realtime service connected');
      this.notifyConnectionChange(true);
      this.emitEvent({
        type: 'system_status',
        data: { status: 'connected', timestamp: Date.now() },
        timestamp: Date.now(),
        source: 'local'
      });
    }
  }

  /**
   * Handle connection lost
   */
  private handleDisconnect(): void {
    if (this.isConnected) {
      this.isConnected = false;
      console.log('Firebase realtime service disconnected');
      this.notifyConnectionChange(false);
      this.emitEvent({
        type: 'system_status',
        data: { status: 'disconnected', timestamp: Date.now() },
        timestamp: Date.now(),
        source: 'local'
      });
    }
  }

  /**
   * Notify connection state callbacks
   */
  private notifyConnectionChange(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Connection callback error:', error);
      }
    });
  }

  /**
   * Emit event to all relevant listeners
   */
  private emitEvent(event: RealtimeEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });

    // Also emit to 'all' listeners
    const allListeners = this.eventListeners.get('all') || [];
    allListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  /**
   * Subscribe to community rating updates for a specific QR code
   */
  subscribeToRatingUpdates(
    qrHash: string,
    callback: (rating: CommunityRating | null) => void
  ): string {
    const subscriptionId = `rating_${qrHash}_${Date.now()}`;

    const unsubscribe = this.firestoreService.subscribeToDocument<CommunityRating>(
      'qrCodes',
      qrHash,
      (rating, error) => {
        if (error) {
          console.error('Rating subscription error:', error);
          return;
        }

        callback(rating);

        // Emit realtime event
        this.emitEvent({
          type: 'rating_update',
          qrHash,
          data: rating,
          timestamp: Date.now(),
          source: 'server'
        });
      }
    );

    const subscription: RealtimeSubscription = {
      id: subscriptionId,
      type: 'rating_update',
      callback: (event) => {
        if (event.type === 'rating_update' && event.qrHash === qrHash) {
          callback(event.data);
        }
      },
      unsubscribe,
      created: Date.now()
    };

    this.subscriptions.set(subscriptionId, subscription);
    console.log('Subscribed to rating updates:', qrHash);

    return subscriptionId;
  }

  /**
   * Subscribe to user's scan history updates
   */
  subscribeToScanHistory(
    callback: (scans: UserScanData[]) => void
  ): string | null {
    const userId = this.authService.getUserId();
    if (!userId) {
      console.error('Cannot subscribe to scan history: user not authenticated');
      return null;
    }

    const subscriptionId = `scan_history_${userId}_${Date.now()}`;
    const collectionPath = `users/${userId}/scanHistory`;

    const unsubscribe = this.firestoreService.subscribeToCollection<UserScanData>(
      collectionPath,
      (scans, error) => {
        if (error) {
          console.error('Scan history subscription error:', error);
          return;
        }

        callback(scans);

        // Emit realtime event for new scans
        this.emitEvent({
          type: 'new_scan',
          userId,
          data: scans,
          timestamp: Date.now(),
          source: 'server'
        });
      },
      [],
      { field: 'timestamp', direction: 'desc' },
      50 // Limit to recent scans
    );

    const subscription: RealtimeSubscription = {
      id: subscriptionId,
      type: 'new_scan',
      callback: (event) => {
        if (event.type === 'new_scan' && event.userId === userId) {
          callback(event.data);
        }
      },
      unsubscribe,
      created: Date.now()
    };

    this.subscriptions.set(subscriptionId, subscription);
    console.log('Subscribed to scan history updates:', userId);

    return subscriptionId;
  }

  /**
   * Subscribe to recent community activity
   */
  subscribeToRecentActivity(
    callback: (ratings: CommunityRating[]) => void,
    limit = 10
  ): string {
    const subscriptionId = `recent_activity_${Date.now()}`;

    const unsubscribe = this.firestoreService.subscribeToCollection<CommunityRating>(
      'qrCodes',
      (ratings, error) => {
        if (error) {
          console.error('Recent activity subscription error:', error);
          return;
        }

        callback(ratings);

        // Emit realtime event
        this.emitEvent({
          type: 'user_activity',
          data: ratings,
          timestamp: Date.now(),
          source: 'server'
        });
      },
      [],
      { field: 'lastUpdated', direction: 'desc' },
      limit
    );

    const subscription: RealtimeSubscription = {
      id: subscriptionId,
      type: 'user_activity',
      callback: (event) => {
        if (event.type === 'user_activity') {
          callback(event.data);
        }
      },
      unsubscribe,
      created: Date.now()
    };

    this.subscriptions.set(subscriptionId, subscription);
    console.log('Subscribed to recent activity');

    return subscriptionId;
  }

  /**
   * Subscribe to general event types
   */
  subscribe(
    eventType: string,
    callback: (event: RealtimeEvent) => void
  ): string {
    const subscriptionId = `${eventType}_${Date.now()}`;

    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }

    this.eventListeners.get(eventType)!.push(callback);

    // Create subscription entry for tracking
    const subscription: RealtimeSubscription = {
      id: subscriptionId,
      type: eventType,
      callback,
      unsubscribe: () => {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
          const index = listeners.indexOf(callback);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      },
      created: Date.now()
    };

    this.subscriptions.set(subscriptionId, subscription);
    console.log('Subscribed to event type:', eventType);

    return subscriptionId;
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionId);
      console.log('Unsubscribed:', subscriptionId);
    }
  }

  /**
   * Broadcast rating update (called when vote is submitted)
   */
  broadcastRatingUpdate(qrHash: string, rating: CommunityRating): void {
    this.emitEvent({
      type: 'rating_update',
      qrHash,
      data: rating,
      timestamp: Date.now(),
      source: 'local'
    });
  }

  /**
   * Broadcast vote submission
   */
  broadcastVoteSubmitted(vote: Vote, rating: CommunityRating): void {
    this.emitEvent({
      type: 'vote_submitted',
      qrHash: vote.qrHash,
      userId: vote.userId,
      data: { vote, rating },
      timestamp: Date.now(),
      source: 'local'
    });
  }

  /**
   * Broadcast new scan
   */
  broadcastNewScan(scanData: UserScanData): void {
    this.emitEvent({
      type: 'new_scan',
      userId: scanData.userId,
      data: scanData,
      timestamp: Date.now(),
      source: 'local'
    });
  }

  /**
   * Get connection status
   */
  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const isOnline = await this.firestoreService.checkConnectivity();
      
      return {
        isOnline,
        lastSync: Date.now(),
        activeUsers: this.subscriptions.size, // Simplified metric
        systemHealth: isOnline ? 'healthy' : 'offline'
      };
    } catch (error) {
      return {
        isOnline: false,
        lastSync: 0,
        activeUsers: 0,
        systemHealth: 'offline'
      };
    }
  }

  /**
   * Monitor connection status
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionCallbacks.push(callback);
    
    // Immediately call with current status
    callback(this.isConnected);

    // Return unsubscribe function
    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Manually trigger connection check
   */
  async checkConnection(): Promise<boolean> {
    try {
      const isOnline = await this.firestoreService.checkConnectivity();
      if (isOnline !== this.isConnected) {
        if (isOnline) {
          this.handleConnect();
        } else {
          this.handleDisconnect();
        }
      }
      return isOnline;
    } catch (error) {
      console.error('Connection check failed:', error);
      this.handleDisconnect();
      return false;
    }
  }

  /**
   * Get all active subscriptions (for debugging)
   */
  getActiveSubscriptions(): Array<{ id: string; type: string; created: number }> {
    return Array.from(this.subscriptions.values()).map(sub => ({
      id: sub.id,
      type: sub.type,
      created: sub.created
    }));
  }

  /**
   * Enable or disable network (useful for testing offline scenarios)
   */
  async setNetworkEnabled(enabled: boolean): Promise<void> {
    try {
      await this.firestoreService.setNetworkEnabled(enabled);
      if (enabled) {
        this.handleConnect();
      } else {
        this.handleDisconnect();
      }
    } catch (error) {
      console.error('Failed to toggle network:', error);
    }
  }

  /**
   * Cleanup all subscriptions and stop services
   */
  cleanup(): void {
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    // Unsubscribe from all subscriptions
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();

    // Clear event listeners
    this.eventListeners.clear();

    // Clear connection callbacks
    this.connectionCallbacks = [];

    this.isConnected = false;
    console.log('Firebase realtime service cleaned up');
  }

  /**
   * Get subscription count by type
   */
  getSubscriptionStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    this.subscriptions.forEach((subscription) => {
      stats[subscription.type] = (stats[subscription.type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Remove stale subscriptions (older than specified time)
   */
  cleanupStaleSubscriptions(maxAge = 30 * 60 * 1000): number { // 30 minutes default
    const now = Date.now();
    let removedCount = 0;

    this.subscriptions.forEach((subscription, id) => {
      if (now - subscription.created > maxAge) {
        subscription.unsubscribe();
        this.subscriptions.delete(id);
        removedCount++;
      }
    });

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} stale subscriptions`);
    }

    return removedCount;
  }
}

// Export singleton instance
export const firebaseRealtimeService = FirebaseRealtimeService.getInstance();