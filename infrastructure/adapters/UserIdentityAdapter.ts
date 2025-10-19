/**
 * User Identity Adapter
 * Infrastructure Layer - User Identity Integration
 *
 * Implements IUserIdentityService interface
 * Adapts existing UserIdentityService to Application layer interface
 */

import { IUserIdentityService } from '@/application/interfaces/IUserIdentityService';
import { userIdentityService } from '../UserIdentityService';

export class UserIdentityAdapter implements IUserIdentityService {
  /**
   * Get the current user's ID (creates one if doesn't exist)
   * @returns Promise with user ID string
   */
  async getUserId(): Promise<string> {
    try {
      return await userIdentityService.getUserId();
    } catch (error) {
      console.error('Error getting user ID:', error);
      // Generate fallback ID if service fails
      return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }
}
