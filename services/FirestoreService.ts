/**
 * Firestore Service
 * Core Firestore operations wrapper with offline support
 */

import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { DatabaseResponse } from './types';

interface FirestoreConfig {
  enableOfflinePersistence?: boolean;
  cacheSizeBytes?: number;
}

export class FirestoreService {
  private static instance: FirestoreService;
  private isInitialized = false;

  static getInstance(): FirestoreService {
    if (!FirestoreService.instance) {
      FirestoreService.instance = new FirestoreService();
    }
    return FirestoreService.instance;
  }

  /**
   * Initialize Firestore with offline persistence
   */
  async initializeFirestore(config: FirestoreConfig = {}): Promise<void> {
    if (this.isInitialized) return;

    try {
      const {
        enableOfflinePersistence = true,
        cacheSizeBytes = firestore.CACHE_SIZE_UNLIMITED
      } = config;

      if (enableOfflinePersistence) {
        await firestore().settings({
          persistence: true,
          cacheSizeBytes,
        });
      }

      this.isInitialized = true;
      console.log('Firestore initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firestore:', error);
      throw error;
    }
  }

  /**
   * Create or set a document
   */
  async createDocument<T>(
    collectionPath: string,
    documentId: string,
    data: T,
    merge = false
  ): Promise<DatabaseResponse<T>> {
    try {
      await firestore()
        .collection(collectionPath)
        .doc(documentId)
        .set(data, { merge });

      return {
        success: true,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Document creation failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Update an existing document
   */
  async updateDocument<T>(
    collectionPath: string,
    documentId: string,
    updates: Partial<T>
  ): Promise<DatabaseResponse<Partial<T>>> {
    try {
      await firestore()
        .collection(collectionPath)
        .doc(documentId)
        .update(updates);

      return {
        success: true,
        data: updates,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Document update failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(
    collectionPath: string,
    documentId: string
  ): Promise<DatabaseResponse<void>> {
    try {
      await firestore()
        .collection(collectionPath)
        .doc(documentId)
        .delete();

      return {
        success: true,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Document deletion failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get a single document (one-time read)
   */
  async getDocument<T>(
    collectionPath: string,
    documentId: string
  ): Promise<DatabaseResponse<T | null>> {
    try {
      const documentSnapshot = await firestore()
        .collection(collectionPath)
        .doc(documentId)
        .get();

      if (documentSnapshot.exists) {
        const data = documentSnapshot.data() as T;
        return {
          success: true,
          data,
          timestamp: Date.now()
        };
      } else {
        return {
          success: true,
          data: null,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Document read failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Subscribe to document changes with real-time updates
   */
  subscribeToDocument<T>(
    collectionPath: string,
    documentId: string,
    callback: (data: T | null, error?: string) => void
  ): () => void {
    const unsubscribe = firestore()
      .collection(collectionPath)
      .doc(documentId)
      .onSnapshot(
        (documentSnapshot) => {
          if (documentSnapshot.exists) {
            const data = documentSnapshot.data() as T;
            callback(data);
          } else {
            callback(null);
          }
        },
        (error) => {
          console.error('Document subscription error:', error);
          callback(null, error.message);
        }
      );

    return unsubscribe;
  }

  /**
   * Query a collection with filters
   */
  async queryCollection<T>(
    collectionPath: string,
    queries: Array<{
      field: string;
      operator: FirebaseFirestoreTypes.WhereFilterOp;
      value: any;
    }> = [],
    orderBy?: { field: string; direction?: 'asc' | 'desc' },
    limit?: number
  ): Promise<DatabaseResponse<T[]>> {
    try {
      let query = firestore().collection(collectionPath);

      // Apply where clauses
      queries.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });

      // Apply ordering
      if (orderBy) {
        query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const querySnapshot = await query.get();
      const results: T[] = [];

      querySnapshot.forEach((doc) => {
        results.push(doc.data() as T);
      });

      return {
        success: true,
        data: results,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Subscribe to collection changes with real-time updates
   */
  subscribeToCollection<T>(
    collectionPath: string,
    callback: (data: T[], error?: string) => void,
    queries: Array<{
      field: string;
      operator: FirebaseFirestoreTypes.WhereFilterOp;
      value: any;
    }> = [],
    orderBy?: { field: string; direction?: 'asc' | 'desc' },
    limit?: number
  ): () => void {
    let query = firestore().collection(collectionPath);

    // Apply where clauses
    queries.forEach(({ field, operator, value }) => {
      query = query.where(field, operator, value);
    });

    // Apply ordering
    if (orderBy) {
      query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
    }

    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }

    const unsubscribe = query.onSnapshot(
      (querySnapshot) => {
        const results: T[] = [];
        querySnapshot.forEach((doc) => {
          results.push(doc.data() as T);
        });
        callback(results);
      },
      (error) => {
        console.error('Collection subscription error:', error);
        callback([], error.message);
      }
    );

    return unsubscribe;
  }

  /**
   * Perform multiple writes atomically
   */
  async batchWrite(
    operations: Array<{
      type: 'set' | 'update' | 'delete';
      collectionPath: string;
      documentId: string;
      data?: any;
      merge?: boolean;
    }>
  ): Promise<DatabaseResponse<void>> {
    try {
      const batch = firestore().batch();

      operations.forEach(({ type, collectionPath, documentId, data, merge }) => {
        const docRef = firestore().collection(collectionPath).doc(documentId);

        switch (type) {
          case 'set':
            batch.set(docRef, data, merge ? { merge } : {});
            break;
          case 'update':
            batch.update(docRef, data);
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });

      await batch.commit();

      return {
        success: true,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch write failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Run a transaction for atomic reads and writes
   */
  async runTransaction<T>(
    transactionFunction: (transaction: FirebaseFirestoreTypes.Transaction) => Promise<T>
  ): Promise<DatabaseResponse<T>> {
    try {
      const result = await firestore().runTransaction(transactionFunction);

      return {
        success: true,
        data: result,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get server timestamp for consistent time across clients
   */
  getServerTimestamp(): FirebaseFirestoreTypes.FieldValue {
    return firestore.FieldValue.serverTimestamp();
  }

  /**
   * Check if Firestore is available and online
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      await firestore().enableNetwork();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Enable or disable network connectivity
   */
  async setNetworkEnabled(enabled: boolean): Promise<void> {
    try {
      if (enabled) {
        await firestore().enableNetwork();
      } else {
        await firestore().disableNetwork();
      }
    } catch (error) {
      console.error('Network toggle failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const firestoreService = FirestoreService.getInstance();