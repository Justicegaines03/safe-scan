/**
 * User Identity Service
 * Handles persistent device-based user identification for rating system
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const USER_ID_KEY = '@safe_scan_device_user_id';
const USER_ID_BACKUP_KEY = '@safe_scan_device_backup_id';

export class UserIdentityService {
  private static instance: UserIdentityService;
  private cachedUserId: string | null = null;

  static getInstance(): UserIdentityService {
    if (!UserIdentityService.instance) {
      UserIdentityService.instance = new UserIdentityService();
    }
    return UserIdentityService.instance;
  }

  /**
   * Get or create a persistent device-based user ID
   */
  async getUserId(): Promise<string> {
    // Return cached ID if available
    if (this.cachedUserId) {
      return this.cachedUserId;
    }

    try {
      // Try multiple storage locations for redundancy
      let existingUserId = await AsyncStorage.getItem(USER_ID_KEY);
      
      // If primary key is missing, try backup
      if (!existingUserId) {
        existingUserId = await AsyncStorage.getItem(USER_ID_BACKUP_KEY);
        if (existingUserId) {
          // Restore primary key from backup
          await AsyncStorage.setItem(USER_ID_KEY, existingUserId);
          console.log('Restored user ID from backup:', existingUserId);
        }
      }
      
      if (existingUserId) {
        this.cachedUserId = existingUserId;
        console.log('Retrieved existing device user ID:', existingUserId);
        return existingUserId;
      }

      // Generate new device-based user ID if none exists
      const newUserId = await this.generateDeviceBasedUserId();
      
      // Store in both primary and backup locations
      await AsyncStorage.setItem(USER_ID_KEY, newUserId);
      await AsyncStorage.setItem(USER_ID_BACKUP_KEY, newUserId);
      
      this.cachedUserId = newUserId;
      
      console.log('Generated new persistent device-based user ID:', newUserId);
      return newUserId;
    } catch (error) {
      console.error('Error managing user ID:', error);
      // Fallback to session-based ID if storage fails
      if (!this.cachedUserId) {
        this.cachedUserId = await this.generateDeviceBasedUserId();
      }
      return this.cachedUserId;
    }
  }

  /**
   * Generate a device-based unique user identifier
   */
  private async generateDeviceBasedUserId(): Promise<string> {
    try {
      // Create a device fingerprint using available device characteristics
      const deviceFingerprint = await this.createDeviceFingerprint();
      
      // Add timestamp for uniqueness while keeping device consistency
      const timestamp = Date.now().toString(36);
      
      return `device_${deviceFingerprint}_${timestamp}`;
    } catch (error) {
      console.error('Error generating device-based ID:', error);
      // Fallback to simple random ID
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substr(2, 9);
      return `fallback_${timestamp}_${randomPart}`;
    }
  }

  /**
   * Create a device fingerprint for consistent identification
   */
  private async createDeviceFingerprint(): Promise<string> {
    try {
      // Collect device characteristics
      const characteristics = [
        Platform.OS,
        Platform.Version.toString(),
        // Screen dimensions (roughly consistent per device model)
        typeof window !== 'undefined' ? window.screen?.width?.toString() : '0',
        typeof window !== 'undefined' ? window.screen?.height?.toString() : '0',
        // User agent (for web) or simplified for native
        typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 50) : Platform.OS,
        // Timezone offset (roughly location-based)
        new Date().getTimezoneOffset().toString()
      ];

      // Create a hash from these characteristics
      const combined = characteristics.join('|');
      let hash = 0;
      
      for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return Math.abs(hash).toString(36);
    } catch (error) {
      console.error('Error creating device fingerprint:', error);
      // Fallback to random string
      return Math.random().toString(36).substr(2, 9);
    }
  }

  /**
   * Reset user ID (for testing or privacy purposes)
   */
  async resetUserId(): Promise<string> {
    try {
      await AsyncStorage.removeItem(USER_ID_KEY);
      await AsyncStorage.removeItem(USER_ID_BACKUP_KEY);
      this.cachedUserId = null;
      console.log('User ID reset - will generate new device-based ID on next request');
      return await this.getUserId(); // This will generate a new ID
    } catch (error) {
      console.error('Error resetting user ID:', error);
      throw error;
    }
  }

  /**
   * Check if user has a persistent ID
   */
  async hasPersistentId(): Promise<boolean> {
    try {
      const primaryId = await AsyncStorage.getItem(USER_ID_KEY);
      const backupId = await AsyncStorage.getItem(USER_ID_BACKUP_KEY);
      return !!(primaryId || backupId);
    } catch {
      return false;
    }
  }

  /**
   * Get debug info about current user ID
   */
  async getDebugInfo(): Promise<{
    cachedId: string | null;
    primaryStored: string | null;
    backupStored: string | null;
    hasPersistent: boolean;
  }> {
    try {
      const primaryStored = await AsyncStorage.getItem(USER_ID_KEY);
      const backupStored = await AsyncStorage.getItem(USER_ID_BACKUP_KEY);
      
      return {
        cachedId: this.cachedUserId,
        primaryStored,
        backupStored,
        hasPersistent: !!(primaryStored || backupStored)
      };
    } catch (error) {
      console.error('Error getting debug info:', error);
      return {
        cachedId: this.cachedUserId,
        primaryStored: null,
        backupStored: null,
        hasPersistent: false
      };
    }
  }
}

// Export singleton instance
export const userIdentityService = UserIdentityService.getInstance();
