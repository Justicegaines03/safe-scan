/**
 * Firestore Database Schema
 * Defines the collection structure and data models for Firebase
 */

import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// =============================================================================
// COLLECTION STRUCTURE
// =============================================================================

/**
 * Root Collections:
 * 
 * /users/{userId}                    - User profile and settings
 * /users/{userId}/scanHistory/{scanId} - User's scan history
 * /qrCodes/{qrHash}                 - QR code community data
 * /qrCodes/{qrHash}/votes/{userId}  - Individual user votes
 * /systemStats/global               - Global app statistics
 * /userSessions/{sessionId}         - Active user sessions (optional)
 */

// =============================================================================
// FIRESTORE DOCUMENT INTERFACES
// =============================================================================

/**
 * User Document (/users/{userId})
 */
export interface FirestoreUser {
  uid: string;
  isAnonymous: boolean;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  lastActiveAt: FirebaseFirestoreTypes.Timestamp;
  settings: {
    notifications: boolean;
    autoSync: boolean;
    theme: 'light' | 'dark' | 'auto';
    dataSharing: boolean;
  };
  stats: {
    totalScans: number;
    totalVotes: number;
    joinedAt: FirebaseFirestoreTypes.Timestamp;
    lastScanAt?: FirebaseFirestoreTypes.Timestamp;
    lastVoteAt?: FirebaseFirestoreTypes.Timestamp;
  };
  version: number; // For schema migrations
}

/**
 * Scan History Document (/users/{userId}/scanHistory/{scanId})
 */
export interface FirestoreScanHistory {
  // Core scan data
  userId: string;
  qrData: string;
  timestamp: number; // Client timestamp for sorting
  safetyTag: 'safe' | 'unsafe' | 'unknown';
  sessionId: string;
  
  // Firestore metadata
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
  
  // Optional analysis results
  virusTotalResult?: {
    scanned: boolean;
    positives: number;
    total: number;
    permalink?: string;
    scanDate: FirebaseFirestoreTypes.Timestamp;
  };
  
  // Scan context
  scanMethod: 'camera' | 'manual' | 'clipboard' | 'file';
  deviceInfo?: {
    platform: string;
    version: string;
    userAgent?: string;
  };
  
  // Privacy and sharing
  isPrivate: boolean; // User can mark scans as private
  sharedWithCommunity: boolean;
}

/**
 * QR Code Community Data (/qrCodes/{qrHash})
 */
export interface FirestoreQRCode {
  qrHash: string; // SHA-256 hash of QR content
  
  // Community rating data
  safeVotes: number;
  unsafeVotes: number;
  totalVotes: number;
  confidence: number; // 0-1 confidence score
  
  // Metadata
  firstSeenAt: FirebaseFirestoreTypes.Timestamp;
  lastUpdated: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
  
  // QR Code analysis
  qrType: 'url' | 'text' | 'email' | 'phone' | 'wifi' | 'contact' | 'unknown';
  contentPreview?: string; // First 100 chars (sanitized)
  
  // Community insights
  reportCount: number; // Number of times reported
  verifiedSafe?: boolean; // Admin verification
  verifiedUnsafe?: boolean; // Admin verification
  
  // Aggregated analysis
  virusTotalSummary?: {
    totalScans: number;
    averagePositives: number;
    lastScanDate: FirebaseFirestoreTypes.Timestamp;
    consensus: 'safe' | 'unsafe' | 'unknown';
  };
  
  // Geographic insights (privacy-safe)
  regions?: string[]; // Country codes where seen
  
  // Performance metrics
  responseTimeMs?: number; // Average community response time
}

/**
 * Individual Vote Document (/qrCodes/{qrHash}/votes/{userId})
 */
export interface FirestoreVote {
  userId: string;
  qrHash: string;
  vote: 'safe' | 'unsafe';
  timestamp: number; // Client timestamp
  weight: number; // Calculated vote weight (0-1)
  
  // Firestore metadata
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
  
  // Vote context
  reason?: 'malware' | 'phishing' | 'spam' | 'safe_verified' | 'trusted_source' | 'personal_experience';
  confidence: number; // User's confidence in their vote (0-1)
  
  // Anti-spam measures
  ipHash?: string; // Hashed IP for spam detection
  userAgent?: string; // For bot detection
  sessionId: string;
  
  // Vote verification
  verified?: boolean; // By admin or trusted user
  flagged?: boolean; // Suspicious vote
  
  // User context (privacy-safe)
  userReputation?: number; // Based on vote accuracy history
  isExpertUser?: boolean; // Security professional, verified user, etc.
}

/**
 * Global Statistics (/systemStats/global)
 */
export interface FirestoreSystemStats {
  // Overall metrics
  totalUsers: number;
  activeUsers24h: number;
  totalScans: number;
  totalVotes: number;
  totalQRCodes: number;
  
  // Quality metrics
  averageConfidence: number;
  consensusRate: number; // % of QR codes with clear consensus
  
  // Safety metrics
  safePercentage: number;
  unsafePercentage: number;
  unknownPercentage: number;
  
  // Performance metrics
  averageResponseTime: number;
  systemHealth: 'healthy' | 'degraded' | 'maintenance';
  
  // Update tracking
  lastUpdated: FirebaseFirestoreTypes.Timestamp;
  updateFrequency: number; // Minutes between updates
  
  // Version info
  schemaVersion: number;
  appVersion: string;
}

/**
 * User Session Document (/userSessions/{sessionId}) - Optional
 */
export interface FirestoreUserSession {
  sessionId: string;
  userId: string;
  isActive: boolean;
  
  // Session timing
  startedAt: FirebaseFirestoreTypes.Timestamp;
  lastActivityAt: FirebaseFirestoreTypes.Timestamp;
  endedAt?: FirebaseFirestoreTypes.Timestamp;
  
  // Session data
  deviceInfo: {
    platform: string;
    version: string;
    appVersion: string;
  };
  
  // Session activities
  scansCount: number;
  votesCount: number;
  errorsCount: number;
  
  // Privacy
  ipHash?: string;
  locationRegion?: string; // Country/region only
}

// =============================================================================
// QUERY INTERFACES
// =============================================================================

/**
 * Common query parameters for Firestore operations
 */
export interface FirestoreQuery {
  limit?: number;
  offset?: number;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  where?: Array<{
    field: string;
    operator: FirebaseFirestoreTypes.WhereFilterOp;
    value: any;
  }>;
  startAfter?: any;
  endBefore?: any;
}

/**
 * Scan history specific query options
 */
export interface ScanHistoryQuery extends FirestoreQuery {
  dateRange?: {
    start: Date;
    end: Date;
  };
  safetyTag?: 'safe' | 'unsafe' | 'unknown';
  includePrivate?: boolean;
}

/**
 * QR code search query options
 */
export interface QRCodeQuery extends FirestoreQuery {
  qrType?: string;
  minVotes?: number;
  minConfidence?: number;
  region?: string;
  verified?: boolean;
}

/**
 * Vote query options
 */
export interface VoteQuery extends FirestoreQuery {
  vote?: 'safe' | 'unsafe';
  minWeight?: number;
  verified?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// =============================================================================
// FIRESTORE SECURITY INTERFACES
// =============================================================================

/**
 * Security rule context
 */
export interface SecurityContext {
  userId: string;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  userReputation?: number;
  isAdmin?: boolean;
  isModerator?: boolean;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// =============================================================================
// MIGRATION AND VERSIONING
// =============================================================================

/**
 * Schema migration interface
 */
export interface SchemaMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrationDate: Date;
  backward_compatible: boolean;
  migration: (data: any) => any;
}

/**
 * Collection indexes for performance
 */
export interface FirestoreIndexes {
  collection: string;
  fields: Array<{
    fieldPath: string;
    order?: 'ASCENDING' | 'DESCENDING';
  }>;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
}

// =============================================================================
// EXPORT CONSTANTS
// =============================================================================

/**
 * Collection paths as constants
 */
export const COLLECTIONS = {
  USERS: 'users',
  SCAN_HISTORY: 'scanHistory',
  QR_CODES: 'qrCodes',
  VOTES: 'votes',
  SYSTEM_STATS: 'systemStats',
  USER_SESSIONS: 'userSessions'
} as const;

/**
 * Document paths helpers
 */
export const DOCUMENT_PATHS = {
  user: (userId: string) => `${COLLECTIONS.USERS}/${userId}`,
  scanHistory: (userId: string, scanId: string) => 
    `${COLLECTIONS.USERS}/${userId}/${COLLECTIONS.SCAN_HISTORY}/${scanId}`,
  qrCode: (qrHash: string) => `${COLLECTIONS.QR_CODES}/${qrHash}`,
  vote: (qrHash: string, userId: string) => 
    `${COLLECTIONS.QR_CODES}/${qrHash}/${COLLECTIONS.VOTES}/${userId}`,
  systemStats: () => `${COLLECTIONS.SYSTEM_STATS}/global`,
  userSession: (sessionId: string) => `${COLLECTIONS.USER_SESSIONS}/${sessionId}`
} as const;

/**
 * Field constraints
 */
export const FIELD_CONSTRAINTS = {
  QR_DATA_MAX_LENGTH: 2000,
  CONTENT_PREVIEW_MAX_LENGTH: 100,
  MAX_VOTES_PER_USER_PER_DAY: 100,
  MAX_SCANS_PER_USER_PER_DAY: 1000,
  VOTE_WEIGHT_DECAY_DAYS: 7,
  SESSION_TIMEOUT_HOURS: 24
} as const;

/**
 * Required indexes for optimal performance
 */
export const REQUIRED_INDEXES: FirestoreIndexes[] = [
  {
    collection: 'users/{userId}/scanHistory',
    fields: [
      { fieldPath: 'timestamp', order: 'DESCENDING' },
      { fieldPath: 'safetyTag' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collection: 'qrCodes',
    fields: [
      { fieldPath: 'lastUpdated', order: 'DESCENDING' },
      { fieldPath: 'totalVotes' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collection: 'qrCodes/{qrHash}/votes',
    fields: [
      { fieldPath: 'timestamp', order: 'DESCENDING' },
      { fieldPath: 'vote' }
    ],
    queryScope: 'COLLECTION'
  }
];

export default {
  COLLECTIONS,
  DOCUMENT_PATHS,
  FIELD_CONSTRAINTS,
  REQUIRED_INDEXES
};