/**
 * Backend Infrastructure Types
 * Shared types for data storage, community database, and real-time updates
 */

import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

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

// =============================================================================
// FIREBASE-SPECIFIC TYPES
// =============================================================================

/**
 * Firebase Authentication User
 */
export interface FirebaseUser {
  uid: string;
  isAnonymous: boolean;
  createdAt: number;
  lastSignIn: number;
  email?: string;
  displayName?: string;
}

/**
 * Firebase Authentication State
 */
export interface FirebaseAuthState {
  user: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: string;
}

/**
 * Firebase Configuration
 */
export interface FirebaseConfig {
  enableOfflinePersistence: boolean;
  cacheSizeBytes: number;
  enableNetwork: boolean;
  host?: string;
  ssl?: boolean;
}

/**
 * Firestore Query Configuration
 */
export interface FirestoreQueryConfig {
  collection: string;
  where?: Array<{
    field: string;
    operator: FirebaseFirestoreTypes.WhereFilterOp;
    value: any;
  }>;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  startAfter?: any;
  endBefore?: any;
}

/**
 * Firestore Batch Operation
 */
export interface FirestoreBatchOperation {
  type: 'set' | 'update' | 'delete';
  collection: string;
  documentId: string;
  data?: any;
  merge?: boolean;
}

/**
 * Firebase Real-time Event
 */
export interface FirebaseRealtimeEvent {
  type: 'rating_update' | 'new_scan' | 'vote_submitted' | 'user_activity' | 'system_status';
  qrHash?: string;
  userId?: string;
  data: any;
  timestamp: number;
  source: 'local' | 'server';
}

/**
 * Firebase Subscription
 */
export interface FirebaseSubscription {
  id: string;
  type: string;
  collection: string;
  documentId?: string;
  query?: FirestoreQueryConfig;
  callback: (data: any, error?: string) => void;
  unsubscribe: () => void;
  created: number;
  lastUpdate?: number;
}

/**
 * Firebase Service Status
 */
export interface FirebaseServiceStatus {
  firestore: boolean;
  auth: boolean;
  functions?: boolean;
  storage?: boolean;
  isOnline: boolean;
  lastCheck: number;
}

/**
 * Firebase Error Enhanced
 */
export interface FirebaseError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  service: 'firestore' | 'auth' | 'functions' | 'storage';
  operation?: string;
  retryable: boolean;
}

/**
 * Firebase Transaction Context
 */
export interface FirebaseTransactionContext {
  transactionId: string;
  startTime: number;
  operations: Array<{
    type: 'read' | 'write';
    collection: string;
    documentId: string;
    timestamp: number;
  }>;
  status: 'pending' | 'committed' | 'failed';
}

/**
 * Firebase Rate Limiting
 */
export interface FirebaseRateLimit {
  userId: string;
  action: string;
  count: number;
  windowStart: number;
  windowDuration: number;
  isBlocked: boolean;
  resetAt: number;
}

/**
 * Firebase Analytics Event
 */
export interface FirebaseAnalyticsEvent {
  eventName: string;
  parameters: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp: number;
  source: 'user_action' | 'system_event' | 'error';
}

/**
 * Firebase Security Context
 */
export interface FirebaseSecurityContext {
  userId: string;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  permissions: string[];
  role?: 'user' | 'moderator' | 'admin';
  reputation?: number;
  verified?: boolean;
}

/**
 * Firebase Data Migration
 */
export interface FirebaseDataMigration {
  migrationId: string;
  fromService: 'localStorage' | 'asyncStorage' | 'webSocket';
  toService: 'firestore' | 'auth' | 'functions';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  startTime: number;
  endTime?: number;
  errors?: string[];
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
}

/**
 * Firebase Offline Queue Item
 */
export interface FirebaseOfflineQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  data?: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high';
  userId?: string;
}

/**
 * Firebase Performance Metrics
 */
export interface FirebasePerformanceMetrics {
  operationType: 'read' | 'write' | 'query' | 'transaction';
  collection: string;
  documentCount?: number;
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: number;
  userId?: string;
  offline?: boolean;
}

/**
 * Firebase Cache Configuration
 */
export interface FirebaseCacheConfig {
  enablePersistence: boolean;
  cacheSizeBytes: number;
  tabSynchronization: boolean;
  ignoreUndefinedProperties: boolean;
  experimentalForceLongPolling?: boolean;
}

/**
 * Firebase Sync Status
 */
export interface FirebaseSyncStatus {
  lastSync: number;
  pendingWrites: number;
  pendingReads: number;
  isOnline: boolean;
  hasPendingWrites: boolean;
  fromCache: boolean;
  syncState: 'synced' | 'pending' | 'error';
}

/**
 * Extended UserScanData for Firebase
 */
export interface FirebaseUserScanData extends UserScanData {
  // Firebase metadata
  createdAt?: FirebaseFirestoreTypes.Timestamp;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
  
  // Enhanced fields
  safetyTag: 'safe' | 'unsafe' | 'unknown'; // Updated to include 'unknown'
  scanMethod?: 'camera' | 'manual' | 'clipboard' | 'file';
  isPrivate?: boolean;
  sharedWithCommunity?: boolean;
  
  // Analysis results
  virusTotalResult?: {
    scanned: boolean;
    positives: number;
    total: number;
    permalink?: string;
    scanDate: FirebaseFirestoreTypes.Timestamp;
  };
  
  // Device context
  deviceInfo?: {
    platform: string;
    version: string;
    userAgent?: string;
  };
}

/**
 * Extended CommunityRating for Firebase
 */
export interface FirebaseCommunityRating extends CommunityRating {
  // Firebase metadata
  createdAt?: FirebaseFirestoreTypes.Timestamp;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
  
  // Enhanced fields
  qrType?: 'url' | 'text' | 'email' | 'phone' | 'wifi' | 'contact' | 'unknown';
  contentPreview?: string;
  reportCount?: number;
  verifiedSafe?: boolean;
  verifiedUnsafe?: boolean;
  
  // Geographic insights
  regions?: string[];
  
  // Performance metrics
  responseTimeMs?: number;
  
  // Virus scanning summary
  virusTotalSummary?: {
    totalScans: number;
    averagePositives: number;
    lastScanDate: FirebaseFirestoreTypes.Timestamp;
    consensus: 'safe' | 'unsafe' | 'unknown';
  };
}

/**
 * Extended Vote for Firebase
 */
export interface FirebaseVote extends Vote {
  // Firebase metadata
  createdAt?: FirebaseFirestoreTypes.Timestamp;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
  
  // Enhanced fields
  reason?: 'malware' | 'phishing' | 'spam' | 'safe_verified' | 'trusted_source' | 'personal_experience';
  confidence?: number; // User's confidence in their vote (0-1)
  
  // Anti-spam measures
  ipHash?: string;
  userAgent?: string;
  
  // Verification
  verified?: boolean;
  flagged?: boolean;
  
  // User context
  userReputation?: number;
  isExpertUser?: boolean;
}

/**
 * Firebase Service Response (extends DatabaseResponse)
 */
export interface FirebaseResponse<T> extends DatabaseResponse<T> {
  source?: 'cache' | 'server';
  fromCache?: boolean;
  hasPendingWrites?: boolean;
  metadata?: {
    isFromCache: boolean;
    hasPendingWrites: boolean;
    fromServerTimestamp?: FirebaseFirestoreTypes.Timestamp;
  };
}
