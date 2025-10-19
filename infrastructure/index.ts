/**
 * Infrastructure Layer Index
 * Exports all infrastructure services and adapters
 */

export * from './types';

// Legacy services (to be removed in Phase 1)
export { LocalStorageService } from './LocalStorageService';
export { CloudSyncService } from './CloudSyncService';
export { CommunityDatabaseService } from './CommunityDatabaseService';
export { WebSocketService } from './WebSocketService';
export { CacheService } from './CacheService';
export { ErrorHandlingService } from './ErrorHandlingService';
export { BackendInfrastructureService, backendInfrastructure } from './BackendInfrastructureService';
export { UserIdentityService, userIdentityService } from './UserIdentityService';

// Firebase services
export { FirestoreService, firestoreService } from './FirestoreService';
export { FirebaseAuthService, firebaseAuthService } from './FirebaseAuthService';
export { FirebaseScanHistoryService, firebaseScanHistoryService } from './FirebaseScanHistoryService';
export { FirebaseCommunityService, firebaseCommunityService } from './FirebaseCommunityService';
export { FirebaseRealtimeService, firebaseRealtimeService } from './FirebaseRealtimeService';

// Firebase schema and configuration
export * from './FirestoreSchema';

// Infrastructure adapters (implement Application layer interfaces)
export * from './adapters';
