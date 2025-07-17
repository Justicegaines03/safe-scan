/**
 * Backend Infrastructure Types
 * Shared types for data storage, community database, and real-time updates
 */

export interface UserScanData {
  userId: string;
  qrData: string;
  timestamp: number;
  safetyTag: 'safe' | 'unsafe';
  sessionId: string;
}

export interface CommunityRating {
  qrHash: string;
  safeVotes: number;
  unsafeVotes: number;
  totalVotes: number;
  confidence: number;
  lastUpdated: number;
}

export interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface SyncStatus {
  lastSync: number;
  pendingUploads: number;
  pendingDownloads: number;
  isOnline: boolean;
}

export interface Vote {
  userId: string;
  qrHash: string;
  vote: 'safe' | 'unsafe';
  timestamp: number;
  weight?: number;
}

export interface WebSocketMessage {
  type: 'vote' | 'rating_update' | 'sync' | 'heartbeat';
  qrHash?: string;
  data?: any;
  timestamp: number;
  clientId?: string;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export interface ServiceAvailability {
  virusTotal: boolean;
  communityDB: boolean;
  localCache: boolean;
  webSocket: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface ShardConfig {
  shardCount: number;
  getShardKey: (key: string) => number;
}
