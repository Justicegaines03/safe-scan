/**
 * Interface for User Identity service
 * Part of Infrastructure Layer - defines contract for user identification
 */

export interface IUserIdentityService {
  /**
   * Get the current user's ID (creates one if doesn't exist)
   * @returns Promise with user ID string
   */
  getUserId(): Promise<string>;
}
