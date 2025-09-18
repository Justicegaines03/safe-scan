# Firebase Setup Guide for Safe Scan

This document provides a comprehensive guide for setting up and configuring Firebase for the Safe Scan mobile application.

## Table of Contents

1. [Overview](#overview)
2. [Collection Structure](#collection-structure)
3. [Security Rules](#security-rules)
4. [Required Indexes](#required-indexes)
5. [Service Configuration](#service-configuration)
6. [Data Migration](#data-migration)
7. [Testing Strategy](#testing-strategy)
8. [Performance Optimization](#performance-optimization)

## Overview

The Safe Scan app uses Firebase Firestore as the primary backend database, replacing the previous local storage and WebSocket implementations. The Firebase setup includes:

- **Firestore Database**: Document-based storage for scan history, community ratings, and votes
- **Firebase Authentication**: Anonymous user authentication for privacy
- **Real-time Listeners**: Live updates replacing WebSocket functionality
- **Offline Support**: Built-in offline persistence and sync

## Collection Structure

### Root Collections

```
/users/{userId}                    - User profiles and settings
/users/{userId}/scanHistory/{scanId} - Individual scan records
/qrCodes/{qrHash}                 - Community rating data
/qrCodes/{qrHash}/votes/{userId}  - Individual user votes
/systemStats/global               - Global app statistics
/userSessions/{sessionId}         - Active user sessions (optional)
```

### Data Models

#### User Document (`/users/{userId}`)
```typescript
{
  uid: string;
  isAnonymous: boolean;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  settings: {
    notifications: boolean;
    autoSync: boolean;
    theme: 'light' | 'dark' | 'auto';
    dataSharing: boolean;
  };
  stats: {
    totalScans: number;
    totalVotes: number;
    joinedAt: Timestamp;
  };
}
```

#### Scan History (`/users/{userId}/scanHistory/{scanId}`)
```typescript
{
  userId: string;
  qrData: string;
  timestamp: number;
  safetyTag: 'safe' | 'unsafe' | 'unknown';
  sessionId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  scanMethod: 'camera' | 'manual' | 'clipboard' | 'file';
  isPrivate: boolean;
  sharedWithCommunity: boolean;
}
```

#### Community Rating (`/qrCodes/{qrHash}`)
```typescript
{
  qrHash: string;
  safeVotes: number;
  unsafeVotes: number;
  totalVotes: number;
  confidence: number; // 0-1
  lastUpdated: Timestamp;
  qrType: 'url' | 'text' | 'email' | 'phone' | 'wifi' | 'contact' | 'unknown';
  contentPreview?: string;
}
```

#### Vote (`/qrCodes/{qrHash}/votes/{userId}`)
```typescript
{
  userId: string;
  qrHash: string;
  vote: 'safe' | 'unsafe';
  timestamp: number;
  weight: number; // 0-1
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reason?: 'malware' | 'phishing' | 'spam' | 'safe_verified' | 'trusted_source';
  confidence: number; // 0-1
}
```

## Security Rules

The `firestore.rules` file implements comprehensive security including:

### User Data Protection
- Users can only access their own scan history
- Anonymous authentication supported
- Private scans are not visible to moderators

### Community Data Access
- Public read access to community ratings
- Authenticated write access for votes
- Rate limiting for spam prevention

### Moderation Features
- Moderator access to non-private content
- Report system for malicious content
- Admin controls for system management

### Data Validation
- Strict type checking on all writes
- Maximum data length limits
- Timestamp validation for recent data

## Required Indexes

Create these indexes in Firebase Console or via CLI:

### 1. Scan History Queries
```
Collection: users/{userId}/scanHistory
Fields: timestamp (Descending), safetyTag (Ascending)
```

### 2. Community Ratings
```
Collection: qrCodes
Fields: lastUpdated (Descending), totalVotes (Ascending)
```

### 3. Vote Queries
```
Collection: qrCodes/{qrHash}/votes
Fields: timestamp (Descending), vote (Ascending)
```

### 4. Private Scan Filtering
```
Collection: users/{userId}/scanHistory
Fields: isPrivate (Ascending), timestamp (Descending)
```

### Create Indexes
```bash
# Using Firebase CLI
firebase firestore:indexes

# Or create manually in Firebase Console
https://console.firebase.google.com/project/YOUR_PROJECT/firestore/indexes
```

## Service Configuration

### Initialize Firebase Services

```typescript
import { firestoreService } from './services/FirestoreService';
import { firebaseAuthService } from './services/FirebaseAuthService';

// Initialize on app start
await firestoreService.initializeFirestore({
  enableOfflinePersistence: true,
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED
});

// Ensure user authentication
await firebaseAuthService.ensureAuthenticated();
```

### Using the Services

```typescript
// Scan history
import { firebaseScanHistoryService } from './services';

// Add a scan
await firebaseScanHistoryService.addScanToHistory(scanData);

// Get history with real-time updates
const subscriptionId = firebaseScanHistoryService.subscribeToScanHistory(
  (scans) => console.log('Updated scans:', scans)
);

// Community voting
import { firebaseCommunityService } from './services';

// Submit a vote
await firebaseCommunityService.submitVote({
  userId: 'user123',
  qrHash: 'abc123...',
  vote: 'safe',
  timestamp: Date.now()
});

// Real-time rating updates
import { firebaseRealtimeService } from './services';

firebaseRealtimeService.subscribeToRatingUpdates(
  qrHash,
  (rating) => console.log('Updated rating:', rating)
);
```

## Data Migration

### Migration Strategy

1. **Phase 1**: Run Firebase services alongside existing services
2. **Phase 2**: Migrate existing local data to Firestore
3. **Phase 3**: Switch components to use Firebase services
4. **Phase 4**: Remove old services after validation

### Migration Script Example

```typescript
import { LocalStorageService } from './services/LocalStorageService';
import { firebaseScanHistoryService } from './services';

async function migrateScanHistory() {
  const localStorage = LocalStorageService.getInstance();
  const existingHistory = await localStorage.getScanHistory();
  
  for (const scan of existingHistory) {
    try {
      await firebaseScanHistoryService.addScanToHistory(scan);
      console.log('Migrated scan:', scan.timestamp);
    } catch (error) {
      console.error('Failed to migrate scan:', scan.timestamp, error);
    }
  }
  
  console.log(`Migrated ${existingHistory.length} scans to Firebase`);
}
```

## Testing Strategy

### Unit Testing

```typescript
// Mock Firestore for testing
jest.mock('@react-native-firebase/firestore', () => ({
  // Mock implementation
}));

import { firebaseScanHistoryService } from './services';

describe('Firebase Scan History Service', () => {
  it('should add scan to history', async () => {
    const scanData = {
      userId: 'test-user',
      qrData: 'https://example.com',
      timestamp: Date.now(),
      safetyTag: 'unknown',
      sessionId: 'test-session'
    };
    
    const result = await firebaseScanHistoryService.addScanToHistory(scanData);
    expect(result.success).toBe(true);
  });
});
```

### Integration Testing

```typescript
// Test with Firebase emulator
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const testEnv = await initializeTestEnvironment({
  projectId: 'safe-scan-test',
  firestore: {
    rules: fs.readFileSync('firestore.rules', 'utf8'),
  },
});

// Test security rules
const alice = testEnv.authenticatedContext('alice');
const bob = testEnv.authenticatedContext('bob');

// Alice should be able to read her own scans
await assertSucceeds(
  alice.firestore()
    .collection('users/alice/scanHistory')
    .get()
);

// Bob should not be able to read Alice's scans
await assertFails(
  bob.firestore()
    .collection('users/alice/scanHistory')
    .get()
);
```

## Performance Optimization

### Query Optimization

```typescript
// Use pagination for large datasets
const query = {
  limit: 20,
  orderBy: { field: 'timestamp', direction: 'desc' },
  startAfter: lastDocument
};

const result = await firebaseScanHistoryService.getUserScanHistory(query);
```

### Caching Strategy

```typescript
// Enable offline persistence
await firestoreService.initializeFirestore({
  enableOfflinePersistence: true,
  cacheSizeBytes: 40 * 1024 * 1024 // 40MB cache
});

// Use cached data when offline
const result = await firestoreService.getDocument('qrCodes', qrHash);
if (result.metadata?.isFromCache) {
  console.log('Data loaded from cache');
}
```

### Real-time Subscription Management

```typescript
class ComponentWithFirebase {
  private subscriptions: string[] = [];

  componentDidMount() {
    // Subscribe to updates
    const subscriptionId = firebaseRealtimeService.subscribeToRatingUpdates(
      this.props.qrHash,
      this.handleRatingUpdate
    );
    this.subscriptions.push(subscriptionId);
  }

  componentWillUnmount() {
    // Clean up subscriptions
    this.subscriptions.forEach(id => {
      firebaseRealtimeService.unsubscribe(id);
    });
  }
}
```

## Monitoring and Analytics

### Performance Monitoring

```typescript
// Track operation performance
const startTime = Date.now();
await firebaseCommunityService.submitVote(vote);
const duration = Date.now() - startTime;

// Log metrics
console.log(`Vote submission took ${duration}ms`);
```

### Error Tracking

```typescript
// Comprehensive error handling
try {
  await firebaseScanHistoryService.addScanToHistory(scanData);
} catch (error) {
  // Log error details
  console.error('Scan history error:', {
    error: error.message,
    userId: scanData.userId,
    timestamp: Date.now(),
    service: 'firebaseScanHistory'
  });
  
  // Fallback to local storage if needed
  await localStorageService.storeScanData(scanData);
}
```

## Environment Configuration

### Development
```typescript
const config = {
  enableOfflinePersistence: true,
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
  enableNetwork: true
};
```

### Production
```typescript
const config = {
  enableOfflinePersistence: true,
  cacheSizeBytes: 40 * 1024 * 1024, // 40MB limit
  enableNetwork: true
};
```

## Deployment Checklist

- [ ] Security rules deployed and tested
- [ ] Required indexes created
- [ ] Authentication configured
- [ ] Offline persistence enabled
- [ ] Error handling implemented
- [ ] Performance monitoring setup
- [ ] Data migration tested
- [ ] Backup strategy in place

## Support and Troubleshooting

### Common Issues

1. **Offline Support**: Ensure persistence is enabled before first Firestore operation
2. **Security Rules**: Test rules thoroughly with Firebase emulator
3. **Index Errors**: Create composite indexes for complex queries
4. **Rate Limiting**: Implement proper rate limiting in security rules
5. **Memory Leaks**: Always clean up real-time subscriptions

### Debug Mode

```typescript
// Enable debug logging
if (__DEV__) {
  firestore.setLogLevel('debug');
}
```

For additional support, refer to:
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Firebase](https://rnfirebase.io/)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)