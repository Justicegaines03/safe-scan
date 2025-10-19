/**
 * Firebase Scan History Adapter
 * Infrastructure Layer - Firebase Integration
 *
 * Implements IScanHistoryService interface
 * Adapts Firebase Firestore to Application layer interface
 */

import { IScanHistoryService, ScanData } from '@/application/interfaces/IScanHistoryService';
import { firebaseScanHistoryService } from '../FirebaseScanHistoryService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class FirebaseScanHistoryAdapter implements IScanHistoryService {
  private readonly STORAGE_KEY = '@safe_scan_history';

  /**
   * Save a scan to history
   * Uses Firebase as primary storage with AsyncStorage as fallback/cache
   *
   * @param scan - The scan data to save
   * @returns Promise that resolves when save is complete
   */
  async saveScan(scan: ScanData): Promise<void> {
    try {
      // Save to Firebase first
      await firebaseScanHistoryService.saveScan(scan);
      console.log('Scan saved to Firebase successfully');

      // Also save to AsyncStorage as cache (optional - depends on your caching decision)
      // This allows offline access to recent scans
      const existingHistory = await AsyncStorage.getItem(this.STORAGE_KEY);
      const history = existingHistory ? JSON.parse(existingHistory) : [];

      // Add to beginning of history array
      history.unshift(scan);

      // Keep only last 100 entries in cache
      const trimmedHistory = history.slice(0, 100);

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedHistory));
      console.log('Scan cached in AsyncStorage');
    } catch (error) {
      console.error('Error saving scan:', error);

      // Fallback: save to AsyncStorage if Firebase fails
      try {
        const existingHistory = await AsyncStorage.getItem(this.STORAGE_KEY);
        const history = existingHistory ? JSON.parse(existingHistory) : [];
        history.unshift(scan);
        const trimmedHistory = history.slice(0, 100);
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedHistory));
        console.log('Scan saved to AsyncStorage fallback');
      } catch (fallbackError) {
        console.error('Error saving to AsyncStorage fallback:', fallbackError);
        throw error; // Re-throw original error
      }
    }
  }

  /**
   * Get all scans from history
   * Tries Firebase first, falls back to AsyncStorage cache
   *
   * @returns Promise with array of scan data
   */
  async getScanHistory(): Promise<ScanData[]> {
    try {
      // Try Firebase first
      const firebaseHistory = await firebaseScanHistoryService.getScanHistory();
      console.log(`Retrieved ${firebaseHistory.length} scans from Firebase`);
      return firebaseHistory;
    } catch (error) {
      console.error('Error getting scan history from Firebase:', error);

      // Fallback to AsyncStorage cache
      try {
        const existingHistory = await AsyncStorage.getItem(this.STORAGE_KEY);
        const history = existingHistory ? JSON.parse(existingHistory) : [];
        console.log(`Retrieved ${history.length} scans from AsyncStorage fallback`);
        return history;
      } catch (fallbackError) {
        console.error('Error getting scan history from AsyncStorage:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Check if a QR code already exists in history
   * Checks both Firebase and AsyncStorage
   *
   * @param qrData - The QR code data to check
   * @returns Promise with boolean indicating if duplicate exists
   */
  async isDuplicate(qrData: string): Promise<boolean> {
    try {
      // Check Firebase first
      const firebaseDuplicate = await firebaseScanHistoryService.isDuplicate(qrData);
      if (firebaseDuplicate) {
        return true;
      }

      // Also check AsyncStorage cache
      const existingHistory = await AsyncStorage.getItem(this.STORAGE_KEY);
      const history = existingHistory ? JSON.parse(existingHistory) : [];

      return history.some((entry: ScanData) => {
        return entry.qrData === qrData || entry.url === qrData;
      });
    } catch (error) {
      console.error('Error checking for duplicate:', error);
      return false; // Allow processing if check fails
    }
  }
}
