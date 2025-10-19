````markdown
# Local Storage Implementation Guide

## Overview
SafeScan's local storage system provides robust, offline-first data persistence using React Native's AsyncStorage. The implementation includes intelligent quota management, data integrity protection, corruption recovery, and seamless offline operation support.

## Architecture Design

### Storage Strategy
The local storage system follows an **offline-first approach** where:
1. All data is stored locally immediately
2. Operations work without network connectivity
3. Synchronization happens in the background when online
4. Local data is the source of truth for user experience

### Data Hierarchy
```
AsyncStorage Structure:
├── @safe_scan_history      // User's scan history and results
├── @safe_scan_user_votes   // Community voting history
├── @safe_scan_settings     // Application preferences  
├── @safe_scan_cache        // Temporary cached data
└── @safe_scan_sync_queue   // Offline operations queue
```

## Core Implementation

### 1. Service Architecture
```typescript
export class LocalStorageService {
  private static instance: LocalStorageService;
  
  // Storage configuration
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly CLEANUP_THRESHOLD = 0.9; // Start cleanup at 90%
  private readonly STORAGE_KEYS = {
    SCAN_HISTORY: '@safe_scan_history',
    USER_VOTES: '@safe_scan_user_votes', 
    SETTINGS: '@safe_scan_settings',
    CACHE: '@safe_scan_cache',
    SYNC_QUEUE: '@safe_scan_sync_queue'
  };
  
  static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }
}
```

### 2. Data Persistence Operations

#### Store Scan Data
```typescript
async storeScanData(scanData: UserScanData): Promise<DatabaseResponse<UserScanData>> {
  try {
    // Get existing data
    const existingData = await this.getScanHistory();
    
    // Add new scan to beginning of array (most recent first)
    const updatedData = [scanData, ...existingData];
    
    // Enforce storage limits before saving
    const cleanedData = await this.enforceStorageLimits(updatedData);
    
    // Serialize and store
    const serialized = JSON.stringify(cleanedData);
    await AsyncStorage.setItem(this.STORAGE_KEYS.SCAN_HISTORY, serialized);
    
    return {
      success: true,
      data: scanData,
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Storage failed',
      timestamp: Date.now()
    };
  }
}
```

#### Retrieve Scan History  
```typescript
async getScanHistory(): Promise<UserScanData[]> {
  try {
    const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.SCAN_HISTORY);
    
    if (!stored) {
      return []; // Return empty array for new installations
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate data structure
    if (!Array.isArray(parsed)) {
      console.warn('Invalid scan history format, resetting to empty array');
      return [];
    }
    
    return parsed;
  } catch (error) {
    console.error('Error retrieving scan history:', error);
    
    // Don't throw error - return empty array for graceful degradation
    return [];
  }
}
```

### 3. Intelligent Storage Quota Management

#### Automatic Cleanup Strategy
```typescript
async enforceStorageLimits(data: UserScanData[]): Promise<UserScanData[]> {
  const serialized = JSON.stringify(data);
  const currentSize = new Blob([serialized]).size;
  
  // Check if we're approaching storage limit
  if (currentSize > this.MAX_STORAGE_SIZE * this.CLEANUP_THRESHOLD) {
    console.log(`Storage cleanup triggered. Current size: ${currentSize} bytes`);
    
    // Sort by timestamp (most recent first)
    const sortedData = data.sort((a, b) => b.timestamp - a.timestamp);
    
    let cleanedData = [...sortedData];
    let cleanedSize = currentSize;
    
    // Remove oldest entries until we're under 70% of limit
    while (cleanedSize > this.MAX_STORAGE_SIZE * 0.7 && cleanedData.length > 0) {
      const removedEntry = cleanedData.pop();
      cleanedSize = new Blob([JSON.stringify(cleanedData)]).size;
      
      console.log(`Removed entry from ${removedEntry?.timestamp} to free space`);
    }
    
    console.log(`Storage cleanup complete. New size: ${cleanedSize} bytes`);
    return cleanedData;
  }
  
  return data;
}
```

#### Storage Statistics
```typescript
async getStorageStats(): Promise<StorageStats> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    let totalSize = 0;
    
    // Calculate total storage usage across all app data
    for (const key of keys) {
      if (key.startsWith('@safe_scan_')) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }
    }
    
    const percentage = (totalSize / this.MAX_STORAGE_SIZE) * 100;
    
    return {
      used: totalSize,
      available: this.MAX_STORAGE_SIZE - totalSize,
      percentage: Math.round(percentage * 100) / 100,
      maxSize: this.MAX_STORAGE_SIZE
    };
  } catch (error) {
    console.error('Failed to calculate storage stats:', error);
    return { 
      used: 0, 
      available: this.MAX_STORAGE_SIZE, 
      percentage: 0,
      maxSize: this.MAX_STORAGE_SIZE 
    };
  }
}
```

### 4. Data Integrity & Corruption Recovery

#### Integrity Validation
```typescript
async validateDataIntegrity(): Promise<boolean> {
  try {
    const keys = Object.values(this.STORAGE_KEYS);
    let allValid = true;
    
    for (const key of keys) {
      const stored = await AsyncStorage.getItem(key);
      
      if (stored) {
        try {
          // Validate JSON structure
          const parsed = JSON.parse(stored);
          
          // Additional validation based on data type
          if (key === this.STORAGE_KEYS.SCAN_HISTORY) {
            if (!Array.isArray(parsed)) {
              throw new Error('Scan history should be an array');
            }
          }
          
          console.log(`✓ Data integrity check passed for ${key}`);
        } catch (parseError) {
          console.error(`✗ Data integrity check failed for ${key}:`, parseError);
          allValid = false;
        }
      }
    }
    
    if (!allValid) {
      console.warn('Data integrity issues detected, initiating repair');
      await this.repairCorruptedData();
    }
    
    return allValid;
  } catch (error) {
    console.error('Data integrity check failed:', error);
    await this.repairCorruptedData();
    return false;
  }
}
```

#### Corruption Recovery
```typescript
async repairCorruptedData(): Promise<void> {
  console.log('Initiating data corruption repair...');
  
  const fallbackData = {
    SCAN_HISTORY: [],
    USER_VOTES: [],
    SETTINGS: { 
      notifications: true, 
      autoSync: true,
      theme: 'system'
    },
    CACHE: {},
    SYNC_QUEUE: []
  };
  
  try {
    // Attempt to repair each storage key individually
    for (const [dataType, defaultValue] of Object.entries(fallbackData)) {
      const storageKey = this.STORAGE_KEYS[dataType as keyof typeof this.STORAGE_KEYS];
      
      if (storageKey) {
        try {
          const stored = await AsyncStorage.getItem(storageKey);
          
          if (stored) {
            // Test if data can be parsed
            JSON.parse(stored);
            console.log(`✓ ${dataType} data is valid, keeping existing`);
          } else {
            // No data exists, create with defaults
            await AsyncStorage.setItem(storageKey, JSON.stringify(defaultValue));
            console.log(`✓ ${dataType} initialized with defaults`);
          }
        } catch (error) {
          // Data is corrupted, replace with defaults
          await AsyncStorage.setItem(storageKey, JSON.stringify(defaultValue));
          console.log(`✓ ${dataType} replaced with defaults due to corruption`);
        }
      }
    }
    
    console.log('Data corruption repair completed successfully');
  } catch (error) {
    console.error('Data repair failed, performing complete reset:', error);
    
    // Last resort: clear all corrupted data
    await AsyncStorage.multiRemove(Object.values(this.STORAGE_KEYS));
    
    // Reinitialize with defaults
    for (const [dataType, defaultValue] of Object.entries(fallbackData)) {
      const storageKey = this.STORAGE_KEYS[dataType as keyof typeof this.STORAGE_KEYS];
      if (storageKey) {
        await AsyncStorage.setItem(storageKey, JSON.stringify(defaultValue));
      }
    }
    
    console.log('Complete data reset completed');
  }
}
```

### 5. Offline Operation Support

#### Operation Queuing
```typescript
async queueForSync(operation: OfflineOperation): Promise<void> {
  try {
    const queue = await this.getSyncQueue();
    
    const queuedOperation = {
      ...operation,
      queuedAt: Date.now(),
      id: this.generateOperationId(),
      retryCount: 0,
      maxRetries: 3
    };
    
    queue.push(queuedOperation);
    
    await AsyncStorage.setItem(
      this.STORAGE_KEYS.SYNC_QUEUE, 
      JSON.stringify(queue)
    );
    
    console.log(`Operation queued for sync: ${operation.type}`);
  } catch (error) {
    console.error('Failed to queue operation:', error);
  }
}

private generateOperationId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}
```

#### Queue Processing
```typescript
async getSyncQueue(): Promise<OfflineOperation[]> {
  try {
    const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.SYNC_QUEUE);
    
    if (!stored) {
      return [];
    }
    
    const queue = JSON.parse(stored);
    
    // Validate queue structure
    if (!Array.isArray(queue)) {
      console.warn('Invalid sync queue format, resetting');
      return [];
    }
    
    // Filter out expired operations (older than 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const validOperations = queue.filter(op => op.queuedAt > sevenDaysAgo);
    
    if (validOperations.length !== queue.length) {
      console.log(`Removed ${queue.length - validOperations.length} expired operations`);
      await this.clearSyncQueue(queue.map(op => op.id).filter(id => 
        !validOperations.some(validOp => validOp.id === id)
      ));
    }
    
    return validOperations;
  } catch (error) {
    console.error('Failed to get sync queue:', error);
    return [];
  }
}

async clearSyncQueue(processedIds: string[]): Promise<void> {
  try {
    const queue = await this.getSyncQueue();
    const remaining = queue.filter(item => !processedIds.includes(item.id));
    
    await AsyncStorage.setItem(
      this.STORAGE_KEYS.SYNC_QUEUE, 
      JSON.stringify(remaining)
    );
    
    console.log(`Cleared ${processedIds.length} processed operations from queue`);
  } catch (error) {
    console.error('Failed to clear sync queue:', error);
  }
}
```

### 6. Advanced Features

#### Batch Operations
```typescript
async batchStoreScanData(scanDataList: UserScanData[]): Promise<BatchResult> {
  const results: DatabaseResponse<UserScanData>[] = [];
  
  try {
    // Get existing data once
    const existingData = await this.getScanHistory();
    
    // Combine all new data
    const allData = [...scanDataList, ...existingData];
    
    // Apply storage limits
    const cleanedData = await this.enforceStorageLimits(allData);
    
    // Store in single operation
    await AsyncStorage.setItem(
      this.STORAGE_KEYS.SCAN_HISTORY, 
      JSON.stringify(cleanedData)
    );
    
    // Create success results for all items
    scanDataList.forEach(scanData => {
      results.push({
        success: true,
        data: scanData,
        timestamp: Date.now()
      });
    });
    
    return {
      success: true,
      results,
      totalProcessed: scanDataList.length
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Batch operation failed',
      results: [],
      totalProcessed: 0
    };
  }
}
```

#### Data Export/Import
```typescript
async exportAllData(): Promise<ExportData> {
  try {
    const data: ExportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      scanHistory: await this.getScanHistory(),
      userVotes: await this.getUserVotes(),
      settings: await this.getSettings()
    };
    
    return data;
  } catch (error) {
    throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async importData(importData: ExportData): Promise<ImportResult> {
  try {
    const results: ImportResult = {
      success: true,
      imported: {
        scanHistory: 0,
        userVotes: 0,
        settings: 0
      },
      errors: []
    };
    
    // Import scan history
    if (importData.scanHistory && Array.isArray(importData.scanHistory)) {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.SCAN_HISTORY,
        JSON.stringify(importData.scanHistory)
      );
      results.imported.scanHistory = importData.scanHistory.length;
    }
    
    // Import user votes
    if (importData.userVotes && Array.isArray(importData.userVotes)) {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.USER_VOTES,
        JSON.stringify(importData.userVotes)
      );
      results.imported.userVotes = importData.userVotes.length;
    }
    
    // Import settings
    if (importData.settings && typeof importData.settings === 'object') {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.SETTINGS,
        JSON.stringify(importData.settings)
      );
      results.imported.settings = 1;
    }
    
    return results;
  } catch (error) {
    return {
      success: false,
      imported: { scanHistory: 0, userVotes: 0, settings: 0 },
      errors: [error instanceof Error ? error.message : 'Import failed']
    };
  }
}
```

## Integration & Usage

### Basic Integration
```typescript
import { LocalStorageService } from './services/LocalStorageService';

// Get service instance
const localStorage = LocalStorageService.getInstance();

// Initialize and validate data integrity
useEffect(() => {
  const initializeStorage = async () => {
    const isValid = await localStorage.validateDataIntegrity();
    if (isValid) {
      console.log('Local storage ready');
    } else {
      console.log('Storage required repair, now ready');
    }
  };
  
  initializeStorage();
}, []);
```

### Storing Scan Results
```typescript
const handleQRScan = async (scanResult: ScanResult) => {
  const scanData: UserScanData = {
    id: generateId(),
    timestamp: Date.now(),
    qrData: scanResult.data,
    virusTotalResult: scanResult.virusTotal,
    communityRating: scanResult.community,
    userRating: null,
    safetyStatus: scanResult.safety
  };
  
  const result = await localStorage.storeScanData(scanData);
  
  if (result.success) {
    console.log('Scan saved locally');
  } else {
    console.error('Failed to save scan:', result.error);
  }
};
```

### Retrieving Data
```typescript
const loadScanHistory = async () => {
  try {
    const history = await localStorage.getScanHistory();
    setScanHistory(history);
    
    // Get storage statistics
    const stats = await localStorage.getStorageStats();
    console.log(`Storage usage: ${stats.percentage.toFixed(1)}%`);
  } catch (error) {
    console.error('Failed to load scan history:', error);
  }
};
```

## Performance Considerations

### Memory Management
- **Lazy Loading**: Only load data when needed
- **Chunked Operations**: Process large datasets in batches
- **Memory Cleanup**: Clear unused cached data
- **Efficient Serialization**: Use optimized JSON operations

### Storage Optimization
- **Data Compression**: Consider compressing large datasets
- **Index Management**: Maintain indices for fast lookups
- **Cleanup Scheduling**: Regular maintenance to prevent bloat
- **Smart Caching**: Cache frequently accessed data in memory

## Error Handling Patterns

### Graceful Degradation
```typescript
const safeGetData = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.warn(`Failed to get ${key}, using fallback:`, error);
    return fallback;
  }
};
```

### Retry Logic
```typescript
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      console.warn(`Operation failed (attempt ${attempt}/${maxRetries}), retrying...`);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw new Error('Max retries exceeded');
};
```

## Security & Privacy

### Data Protection
- **No Sensitive Data**: Avoid storing passwords or tokens
- **Data Hashing**: Hash identifiable information
- **Encryption**: Consider encrypting sensitive user data
- **Access Control**: Validate all data access operations

### Privacy Compliance
- **Data Minimization**: Store only necessary data
- **Retention Policies**: Automatic cleanup of old data
- **User Control**: Allow users to delete their data
- **Transparency**: Clear data usage policies

## Summary

The LocalStorageService provides:

- **🏪 Robust Offline Storage**: Reliable data persistence without network dependency
- **📊 Intelligent Quota Management**: Automatic cleanup and optimization
- **🛡️ Data Integrity Protection**: Corruption detection and recovery
- **⚡ High Performance**: Optimized operations for mobile devices
- **🔄 Offline Operation Support**: Queue system for network-dependent operations
- **📱 Mobile Optimized**: Designed specifically for React Native AsyncStorage
- **🚨 Error Resilience**: Graceful handling of all failure scenarios

This implementation ensures that SafeScan provides excellent user experience even when completely offline, while maintaining data integrity and optimal performance.
````
